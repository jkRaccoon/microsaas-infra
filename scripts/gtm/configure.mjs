#!/usr/bin/env node
/**
 * GTM 컨테이너 자동 구성. triggers/tags 를 캐시해 API quota 절약.
 * Idempotent: 이미 존재하면 update 또는 skip, 없으면 create.
 */
import { tagmanager, loadContainerCfg } from './lib.mjs';

const gtm = tagmanager();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = 1500;

async function retryable(fn, label) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      const code = e.response?.status || e.code;
      if (code === 429 || code === 'RESOURCE_EXHAUSTED') {
        const wait = 15000 * attempt;
        console.log(`    · rate limit at ${label}, backoff ${wait}ms (attempt ${attempt})`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`retries exhausted: ${label}`);
}

async function getTargetContainer(publicId) {
  const accs = (await gtm.accounts.list({ pageSize: 20 })).data.account || [];
  for (const acc of accs) {
    const conts =
      (await gtm.accounts.containers.list({ parent: acc.path, pageSize: 50 })).data.container ||
      [];
    for (const c of conts) {
      if (c.publicId === publicId) return { account: acc, container: c };
    }
  }
  return null;
}

async function getDefaultWorkspace(containerPath) {
  const ws =
    (await gtm.accounts.containers.workspaces.list({ parent: containerPath })).data.workspace ||
    [];
  return ws.find((w) => w.name === 'Default Workspace') || ws[0];
}

function paramsEqual(a, b) {
  // 파라미터 구성이 사실상 동일한지 얕은 비교 (key + type + value)
  if (!a || !b || a.length !== b.length) return false;
  const key = (p) => `${p.type || ''}:${p.key || ''}:${p.value || ''}`;
  const ka = a.map(key).sort().join('|');
  const kb = b.map(key).sort().join('|');
  return ka === kb;
}

async function main() {
  const cfg = loadContainerCfg();
  console.log(`→ GTM ${cfg.publicId} 자동 구성 (이벤트 ${cfg.customEvents.length}개)\n`);

  const target = await getTargetContainer(cfg.publicId);
  if (!target) throw new Error(`컨테이너 ${cfg.publicId} 접근 권한이 없습니다.`);
  const { container } = target;
  const ws = await getDefaultWorkspace(container.path);
  console.log(`✓ 컨테이너: ${container.name} · 워크스페이스: ${ws.name}\n`);

  // 전체 triggers · tags 를 1번만 load 해서 캐시
  const triggers =
    (await gtm.accounts.containers.workspaces.triggers.list({ parent: ws.path })).data.trigger ||
    [];
  const tags =
    (await gtm.accounts.containers.workspaces.tags.list({ parent: ws.path })).data.tag || [];
  const trgMap = new Map(triggers.map((t) => [t.name, t]));
  const tagMap = new Map(tags.map((t) => [t.name, t]));

  async function ensureTrigger(name, body) {
    const found = trgMap.get(name);
    if (found) return { trigger: found, action: 'existing' };
    const created = await retryable(
      () =>
        gtm.accounts.containers.workspaces.triggers.create({
          parent: ws.path,
          requestBody: { name, ...body },
        }),
      `trigger create ${name}`,
    );
    trgMap.set(name, created.data);
    return { trigger: created.data, action: 'created' };
  }

  async function ensureTag(name, body) {
    const found = tagMap.get(name);
    if (found) {
      // 파라미터가 동일하면 update skip
      const sameParams = paramsEqual(found.parameter, body.parameter);
      const sameTrg = JSON.stringify(found.firingTriggerId || []) === JSON.stringify(body.firingTriggerId || []);
      if (sameParams && sameTrg && found.type === body.type) {
        return { tag: found, action: 'skip' };
      }
      const updated = await retryable(
        () =>
          gtm.accounts.containers.workspaces.tags.update({
            path: found.path,
            requestBody: { ...found, ...body, name },
          }),
        `tag update ${name}`,
      );
      tagMap.set(name, updated.data);
      return { tag: updated.data, action: 'updated' };
    }
    const created = await retryable(
      () =>
        gtm.accounts.containers.workspaces.tags.create({
          parent: ws.path,
          requestBody: { name, ...body },
        }),
      `tag create ${name}`,
    );
    tagMap.set(name, created.data);
    return { tag: created.data, action: 'created' };
  }

  // 1) All Pages trigger
  const allPages = await ensureTrigger('All Pages', { type: 'pageview' });
  console.log(`  Trigger "All Pages" → ${allPages.action}`);

  // 2) GA4 Configuration 태그
  const ga4Cfg = await ensureTag('GA4 Configuration', {
    type: 'googtag',
    parameter: [
      { type: 'template', key: 'tagId', value: cfg.ga4MeasurementId },
      { type: 'list', key: 'configSettingsTable', list: [] },
      { type: 'list', key: 'eventSettingsTable', list: [] },
    ],
    firingTriggerId: [allPages.trigger.triggerId],
  });
  console.log(`  Tag "GA4 Configuration" (${cfg.ga4MeasurementId}) → ${ga4Cfg.action}`);

  await sleep(DELAY);

  // 3) 커스텀 이벤트별 트리거 + 태그
  let created = 0,
    updated = 0,
    skipped = 0;
  for (const evt of cfg.customEvents) {
    const trgName = `CE - ${evt}`;
    const trg = await ensureTrigger(trgName, {
      type: 'customEvent',
      customEventFilter: [
        {
          type: 'equals',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{_event}}' },
            { type: 'template', key: 'arg1', value: evt },
          ],
        },
      ],
    });

    const tagName = `GA4 - ${evt}`;
    const tag = await ensureTag(tagName, {
      type: 'gaawe',
      parameter: [
        { type: 'template', key: 'eventName', value: evt },
        { type: 'template', key: 'measurementIdOverride', value: cfg.ga4MeasurementId },
      ],
      firingTriggerId: [trg.trigger.triggerId],
    });

    if (tag.action === 'created') created += 1;
    else if (tag.action === 'updated') updated += 1;
    else skipped += 1;

    console.log(`  Event "${evt}" → trg=${trg.action}, tag=${tag.action}`);
    await sleep(DELAY);
  }

  console.log(`\n  요약: ${created} created · ${updated} updated · ${skipped} skipped`);

  // 4) Version + Publish
  const version = await retryable(
    () =>
      gtm.accounts.containers.workspaces.create_version({
        path: ws.path,
        requestBody: {
          name: `auto ${new Date().toISOString().slice(0, 19)}`,
          notes: 'Auto-published by microsaas-infra/scripts/gtm/configure.mjs',
        },
      }),
    'version create',
  );
  const cv = version.data.containerVersion;
  console.log(`\n✓ Version 생성: ${cv?.name}`);
  if (cv) {
    await retryable(
      () => gtm.accounts.containers.versions.publish({ path: cv.path }),
      'version publish',
    );
    console.log(`✓ 게시 완료`);
  }

  console.log(`\n✓ GTM configure 완료`);
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
