#!/usr/bin/env node
/**
 * GTM 컨테이너를 자동 설정:
 *   1. GA4 Configuration 태그 (Measurement ID + All Pages 트리거) 생성/업데이트
 *   2. 커스텀 이벤트별 GA4 Event 태그 생성 (container.json 의 customEvents)
 *   3. 변경을 새 버전으로 게시
 *
 * Idempotent: 이미 존재하면 update, 없으면 create.
 */
import { tagmanager, loadContainerCfg } from './lib.mjs';

const gtm = tagmanager();

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

async function getOrCreateTrigger(workspacePath, name, body) {
  const trgs =
    (await gtm.accounts.containers.workspaces.triggers.list({ parent: workspacePath })).data
      .trigger || [];
  const found = trgs.find((t) => t.name === name);
  if (found) return { trigger: found, action: 'existing' };
  const created = (
    await gtm.accounts.containers.workspaces.triggers.create({
      parent: workspacePath,
      requestBody: { name, ...body },
    })
  ).data;
  return { trigger: created, action: 'created' };
}

async function upsertTag(workspacePath, name, body) {
  const tags =
    (await gtm.accounts.containers.workspaces.tags.list({ parent: workspacePath })).data.tag || [];
  const found = tags.find((t) => t.name === name);
  if (found) {
    const updated = (
      await gtm.accounts.containers.workspaces.tags.update({
        path: found.path,
        requestBody: { ...found, ...body, name },
      })
    ).data;
    return { tag: updated, action: 'updated' };
  }
  const created = (
    await gtm.accounts.containers.workspaces.tags.create({
      parent: workspacePath,
      requestBody: { name, ...body },
    })
  ).data;
  return { tag: created, action: 'created' };
}

async function main() {
  const cfg = loadContainerCfg();
  console.log(`→ GTM ${cfg.publicId} 자동 구성\n`);

  const target = await getTargetContainer(cfg.publicId);
  if (!target) throw new Error(`컨테이너 ${cfg.publicId} 접근 권한이 없습니다.`);
  const { container } = target;
  const ws = await getDefaultWorkspace(container.path);
  console.log(`✓ 컨테이너: ${container.name} · 워크스페이스: ${ws.name}\n`);

  // 1) All Pages trigger (built-in 이 아닌 경우 대비)
  const allPagesTrg = await getOrCreateTrigger(ws.path, 'All Pages', {
    type: 'pageview',
  });
  console.log(`  Trigger "All Pages" → ${allPagesTrg.action}`);

  // 2) GA4 Configuration 태그
  const ga4ConfigTag = await upsertTag(ws.path, 'GA4 Configuration', {
    type: 'googtag',
    parameter: [
      { type: 'template', key: 'tagId', value: cfg.ga4MeasurementId },
      {
        type: 'list',
        key: 'configSettingsTable',
        list: [],
      },
      {
        type: 'list',
        key: 'eventSettingsTable',
        list: [],
      },
    ],
    firingTriggerId: [allPagesTrg.trigger.triggerId],
  });
  console.log(`  Tag "GA4 Configuration" (${cfg.ga4MeasurementId}) → ${ga4ConfigTag.action}`);

  // 3) 커스텀 이벤트별 트리거 + GA4 Event 태그
  for (const evt of cfg.customEvents) {
    const trgName = `CE - ${evt}`;
    const trg = await getOrCreateTrigger(ws.path, trgName, {
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
    const tag = await upsertTag(ws.path, tagName, {
      type: 'gaawe',
      parameter: [
        { type: 'template', key: 'eventName', value: evt },
        { type: 'tagReference', key: 'measurementIdOverride', value: cfg.ga4MeasurementId },
      ],
      firingTriggerId: [trg.trigger.triggerId],
    });
    console.log(`  Event "${evt}" → trigger ${trg.action}, tag ${tag.action}`);
  }

  // 4) Version + Publish
  const version = (
    await gtm.accounts.containers.workspaces.create_version({
      path: ws.path,
      requestBody: {
        name: `auto ${new Date().toISOString().slice(0, 19)}`,
        notes: 'Auto-published by microsaas-infra/scripts/gtm/configure.mjs',
      },
    })
  ).data;
  console.log(`\n✓ Version 생성: ${version.containerVersion?.name}`);

  if (version.containerVersion) {
    await gtm.accounts.containers.versions.publish({ path: version.containerVersion.path });
    console.log(`✓ 게시 완료`);
  }

  console.log(`\n✓ GTM configure 완료`);
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
