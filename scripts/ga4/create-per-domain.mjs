#!/usr/bin/env node
/**
 * sites.json 의 7개 호스트 각각에 대해 GA4 "속성 + 웹 스트림 + 전환 이벤트" 를 자동 생성.
 * 이미 있는 속성(displayName 이 host 이름) 은 skip.
 *
 * 결과:
 *   properties.json.perDomain 에 host → measurement ID 맵을 기록.
 *
 * 사용 전제: GA4 계정은 "개인용" (accounts/391845578) 을 사용.
 *   필요하면 GA4_ACCOUNT_ID 환경변수로 override.
 */
import { analyticsAdmin } from './lib.mjs';
import { loadSites } from '../gsc/lib.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROPERTIES_PATH = resolve(__dirname, './properties.json');

const admin = analyticsAdmin();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DELAY = 1200;

const DEFAULT_ACCOUNT = process.env.GA4_ACCOUNT_ID || '391845578';
const CURRENCY = 'KRW';
const TZ = 'Asia/Seoul';
const CONVERSION_EVENTS = [
  'checklist_completed',
  'verdict_shown',
  'calculator_opened',
  'notice_copied',
  'notice_downloaded',
  'epost_clicked',
  'share_clicked',
  'tool_card_clicked',
];

async function main() {
  const accountPath = `accounts/${DEFAULT_ACCOUNT}`;
  const { apexDomain, subdomains } = loadSites();
  const hosts = [apexDomain, ...subdomains];

  console.log(`→ GA4 속성 자동 생성 (계정 ${accountPath}, ${hosts.length} 호스트)\n`);

  // 기존 속성 맵
  const existingProps =
    (
      await admin.properties.list({
        filter: `parent:${accountPath}`,
        pageSize: 100,
      })
    ).data.properties || [];
  const byName = new Map(existingProps.map((p) => [p.displayName, p]));

  const perDomain = {};

  for (const host of hosts) {
    console.log(`# ${host}`);
    let property = byName.get(host);

    if (property) {
      console.log(`  · property exists: ${property.name}`);
    } else {
      property = (
        await admin.properties.create({
          requestBody: {
            displayName: host,
            parent: accountPath,
            currencyCode: CURRENCY,
            timeZone: TZ,
          },
        })
      ).data;
      console.log(`  · property created: ${property.name}`);
      await sleep(DELAY);
    }

    // 스트림
    const streams =
      (await admin.properties.dataStreams.list({ parent: property.name, pageSize: 20 })).data
        .dataStreams || [];
    let webStream = streams.find((s) => s.type === 'WEB_DATA_STREAM' && s.webStreamData);
    if (!webStream) {
      webStream = (
        await admin.properties.dataStreams.create({
          parent: property.name,
          requestBody: {
            displayName: host,
            type: 'WEB_DATA_STREAM',
            webStreamData: { defaultUri: `https://${host}` },
          },
        })
      ).data;
      console.log(`  · stream created: ${webStream.webStreamData.measurementId}`);
      await sleep(DELAY);
    } else {
      console.log(`  · stream exists: ${webStream.webStreamData.measurementId}`);
    }
    const measurementId = webStream.webStreamData.measurementId;
    perDomain[host] = measurementId;

    // 전환 이벤트
    const existingConv =
      (
        await admin.properties.conversionEvents.list({
          parent: property.name,
          pageSize: 100,
        })
      ).data.conversionEvents || [];
    const have = new Set(existingConv.map((c) => c.eventName));

    for (const evt of CONVERSION_EVENTS) {
      if (have.has(evt)) {
        continue;
      }
      try {
        await admin.properties.conversionEvents.create({
          parent: property.name,
          requestBody: { eventName: evt },
        });
      } catch (e) {
        console.log(`    · conv event ${evt} 실패: ${e.message}`);
      }
      await sleep(500);
    }
    console.log(`  · conv events ensured: ${CONVERSION_EVENTS.length}`);
  }

  // properties.json 갱신
  const cfg = JSON.parse(readFileSync(PROPERTIES_PATH, 'utf-8'));
  cfg.perDomain = perDomain;
  writeFileSync(PROPERTIES_PATH, JSON.stringify(cfg, null, 2) + '\n');

  console.log(`\n✓ perDomain 매핑 저장 (${Object.keys(perDomain).length}개)`);
  for (const [h, id] of Object.entries(perDomain)) {
    console.log(`  ${h.padEnd(22)}  ${id}`);
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
