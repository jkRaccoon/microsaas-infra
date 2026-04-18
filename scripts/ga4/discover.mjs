#!/usr/bin/env node
/**
 * 접근 가능한 GA4 계정·속성·스트림을 조회하고 현재 measurement ID 를 확인.
 *
 * 사용: node scripts/ga4/discover.mjs
 */
import { analyticsAdmin } from './lib.mjs';

const admin = analyticsAdmin();

async function main() {
  console.log(`→ Admin API 로 접근 가능한 GA4 자원 조회\n`);

  const accs = (await admin.accounts.list({ pageSize: 50 })).data.accounts || [];
  if (accs.length === 0) {
    console.log(`계정 없음. GA4 콘솔에서 계정을 먼저 만드세요.`);
    return;
  }

  for (const acc of accs) {
    console.log(`# Account: ${acc.displayName} (${acc.name})`);
    const props =
      (
        await admin.properties.list({
          filter: `parent:${acc.name}`,
          pageSize: 50,
        })
      ).data.properties || [];
    if (props.length === 0) {
      console.log(`  (속성 없음)`);
      continue;
    }
    for (const p of props) {
      console.log(
        `  - Property: ${p.displayName} (${p.name})  · 통화=${p.currencyCode} · TZ=${p.timeZone}`,
      );
      const streams =
        (
          await admin.properties.dataStreams.list({
            parent: p.name,
            pageSize: 50,
          })
        ).data.dataStreams || [];
      for (const s of streams) {
        const mid = s.webStreamData?.measurementId || '(no measurement id)';
        const uri = s.webStreamData?.defaultUri || '';
        console.log(`    · Stream: ${s.displayName} · ${mid} · ${uri}`);
      }

      const conv =
        (
          await admin.properties.conversionEvents.list({
            parent: p.name,
            pageSize: 50,
          })
        ).data.conversionEvents || [];
      if (conv.length > 0) {
        console.log(`    · Conversion Events:`);
        for (const c of conv) {
          console.log(`        ◦ ${c.eventName}${c.deletable ? '' : ' (default)'}`);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
