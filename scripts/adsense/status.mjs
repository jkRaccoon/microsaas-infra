#!/usr/bin/env node
/**
 * AdSense Management API v2 로 계정·사이트·광고단위·ads.txt 상태 일괄 조회.
 */
import { google } from 'googleapis';
import { authedClient } from '../gsc/lib.mjs';

const adsense = google.adsense({ version: 'v2', auth: authedClient() });

async function main() {
  console.log(`→ AdSense 상태 조회\n`);

  const accounts = (await adsense.accounts.list({ pageSize: 20 })).data.accounts || [];
  if (accounts.length === 0) {
    console.log(`계정 없음.`);
    return;
  }

  for (const acc of accounts) {
    console.log(`# Account: ${acc.displayName} (${acc.name})`);
    console.log(`  · State: ${acc.state} · TZ: ${acc.timeZone?.id} · Currency: ${acc.currencyCode}`);

    // Sites
    try {
      const sites = (await adsense.accounts.sites.list({ parent: acc.name, pageSize: 100 })).data
        .sites || [];
      console.log(`  · Sites (${sites.length}):`);
      for (const s of sites) {
        console.log(
          `    - ${s.domain} · state=${s.state}${
            s.autoAdsEnabled ? ' · auto-ads' : ''
          }`,
        );
      }
    } catch (e) {
      console.log(`  · Sites 조회 실패: ${e.message}`);
    }

    // Ad clients
    try {
      const clients = (
        await adsense.accounts.adclients.list({ parent: acc.name, pageSize: 20 })
      ).data.adClients || [];
      for (const c of clients) {
        console.log(`  · AdClient: ${c.reportingDimensionId} (${c.name}) state=${c.state}`);
        try {
          const units =
            (
              await adsense.accounts.adclients.adunits.list({
                parent: c.name,
                pageSize: 50,
              })
            ).data.adUnits || [];
          console.log(`    - Ad units (${units.length}):`);
          for (const u of units) {
            console.log(
              `      · ${u.displayName} (${u.reportingDimensionId}) state=${u.state} type=${u.contentAdsSettings?.type || '-'}`,
            );
          }
        } catch (e) {
          console.log(`    · ad units 조회 실패: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`  · AdClient 조회 실패: ${e.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
