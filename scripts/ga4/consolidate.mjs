#!/usr/bin/env node
/**
 * GA4 속성 정리 (개인용 계정):
 *   1. KEEP 속성의 displayName → NEW_PROPERTY_NAME
 *   2. KEEP 속성의 Web Stream displayName → NEW_STREAM_NAME + defaultUri → APEX
 *   3. 나머지 "bal 포트폴리오" 관련 속성 일괄 삭제 (35일 복구 가능)
 *
 * 실행:
 *   node scripts/ga4/consolidate.mjs           # dry-run (변경 안 함)
 *   node scripts/ga4/consolidate.mjs --apply   # 실제 적용
 */
import { analyticsAdmin } from './lib.mjs';

const APPLY = process.argv.includes('--apply');
const ACCOUNT_ID = process.env.GA4_ACCOUNT_ID || '391845578'; // 개인용
const KEEP_PROPERTY_ID = 'properties/533557200'; // jeonse.bal.pe.kr
const NEW_PROPERTY_NAME = 'bal.pe.kr 포트폴리오';
const NEW_STREAM_NAME = 'portfolio-web';
const NEW_STREAM_URI = 'https://bal.pe.kr';

// 삭제 대상 display name 패턴 (이들만 삭제하도록 안전장치)
const DELETE_NAME_PATTERNS = [
  /\.bal\.pe\.kr/,
  /^bal\.pe\.kr$/,
  /pogalwage/,
];

const admin = analyticsAdmin();

function log(...a) {
  console.log(...a);
}

async function main() {
  const accountPath = `accounts/${ACCOUNT_ID}`;
  log(`# Account: ${accountPath}  (mode=${APPLY ? 'APPLY' : 'dry-run'})`);

  const props =
    (
      await admin.properties.list({
        filter: `parent:${accountPath}`,
        pageSize: 100,
      })
    ).data.properties || [];

  if (props.length === 0) {
    log('속성 없음. 종료.');
    return;
  }

  const keep = props.find((p) => p.name === KEEP_PROPERTY_ID);
  if (!keep) {
    log(`⚠️ KEEP 속성 ${KEEP_PROPERTY_ID} 을 찾을 수 없음.`);
    process.exit(1);
  }

  // 1. KEEP 이름 변경
  log(`\n[KEEP] ${keep.displayName} (${keep.name})`);
  if (keep.displayName !== NEW_PROPERTY_NAME) {
    log(`  → rename to "${NEW_PROPERTY_NAME}"`);
    if (APPLY) {
      await admin.properties.patch({
        name: keep.name,
        updateMask: 'displayName',
        requestBody: { displayName: NEW_PROPERTY_NAME },
      });
    }
  } else {
    log(`  · 이미 "${NEW_PROPERTY_NAME}"`);
  }

  // 2. Stream 이름 + URI 조정
  const streams =
    (await admin.properties.dataStreams.list({ parent: keep.name, pageSize: 20 })).data
      .dataStreams || [];
  const webStream = streams.find((s) => s.type === 'WEB_DATA_STREAM' && s.webStreamData);
  if (webStream) {
    const curName = webStream.displayName;
    const curUri = webStream.webStreamData.defaultUri;
    const maskFields = [];
    const requestBody = {};
    if (curName !== NEW_STREAM_NAME) {
      maskFields.push('displayName');
      requestBody.displayName = NEW_STREAM_NAME;
    }
    if (curUri !== NEW_STREAM_URI) {
      maskFields.push('webStreamData.defaultUri');
      requestBody.webStreamData = { defaultUri: NEW_STREAM_URI };
    }
    if (maskFields.length > 0) {
      log(`  · stream "${curName}" (${curUri}) → "${NEW_STREAM_NAME}" (${NEW_STREAM_URI})`);
      if (APPLY) {
        await admin.properties.dataStreams.patch({
          name: webStream.name,
          updateMask: maskFields.join(','),
          requestBody,
        });
      }
    } else {
      log(`  · stream 이미 정돈됨`);
    }
  } else {
    log(`  ⚠️ web stream 없음`);
  }

  // 3. 나머지 속성 삭제
  const toDelete = props.filter((p) => {
    if (p.name === KEEP_PROPERTY_ID) return false;
    return DELETE_NAME_PATTERNS.some((re) => re.test(p.displayName));
  });

  log(`\n[DELETE] ${toDelete.length}개 속성:`);
  for (const p of toDelete) {
    log(`  - ${p.displayName} (${p.name})`);
    if (APPLY) {
      try {
        await admin.properties.delete({ name: p.name });
        log(`    ✓ deleted (35일 복구 가능)`);
      } catch (e) {
        const msg = e.response?.data?.error?.message || e.message;
        log(`    ✗ failed: ${msg}`);
      }
    }
  }

  if (!APPLY) {
    log(`\n(dry-run) 실제 적용은: node scripts/ga4/consolidate.mjs --apply`);
  } else {
    log(`\n✓ consolidate 완료`);
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
