#!/usr/bin/env node
/**
 * sites.json 에 정의된 도메인·서브도메인을 Google Search Console 에 등록하고
 * 각 사이트의 sitemap.xml 을 제출한다.
 *
 * - APEX 도메인은 "도메인 속성"(sc-domain:bal.pe.kr) 으로 등록
 * - 서브도메인은 "URL 접두사"(https://xxx.bal.pe.kr/) 로 등록
 * - 모두 idempotent: 이미 등록돼 있으면 skip
 */
import { google } from 'googleapis';
import { authedClient, loadSites } from './lib.mjs';

const webmasters = google.webmasters({ version: 'v3', auth: authedClient() });

async function addSite(siteUrl) {
  try {
    await webmasters.sites.get({ siteUrl });
    return `already registered`;
  } catch (e) {
    if (e.code !== 404) throw e;
  }
  await webmasters.sites.add({ siteUrl });
  return `added`;
}

async function submitSitemap(siteUrl, sitemapUrl) {
  try {
    await webmasters.sitemaps.submit({ siteUrl, feedpath: sitemapUrl });
    return `submitted`;
  } catch (e) {
    if (e.code === 400 && String(e.message || '').includes('already')) {
      return 'already submitted';
    }
    throw e;
  }
}

async function main() {
  const { apexDomain, subdomains } = loadSites();

  console.log(`→ Google Search Console sync 시작`);
  console.log(`  APEX: ${apexDomain}`);
  console.log(`  서브도메인 ${subdomains.length}개\n`);

  // 1) APEX 도메인 속성
  const apexSite = `sc-domain:${apexDomain}`;
  try {
    const result = await addSite(apexSite);
    console.log(`[APEX] ${apexSite} → ${result}`);
  } catch (e) {
    console.error(`[APEX] ${apexSite} → 실패: ${e.message}`);
    if (String(e.message || '').includes('not a verified owner')) {
      console.error(
        `  ⚠️ TXT 검증이 구글 쪽에 아직 반영되지 않았거나, 해당 Google 계정이 검증 소유자가 아닙니다.`,
      );
      console.error(
        `  → https://search.google.com/search-console 에서 한 번 수동으로 "도메인 속성" 추가 → "확인" 클릭 후 다시 실행하세요.`,
      );
    }
  }

  // 2) 각 서브도메인 → URL 접두사 속성 + 사이트맵 제출
  for (const host of subdomains) {
    const siteUrl = `https://${host}/`;
    try {
      const addResult = await addSite(siteUrl);
      console.log(`[SUB] ${siteUrl} → ${addResult}`);
    } catch (e) {
      console.error(`[SUB] ${siteUrl} → add 실패: ${e.message}`);
      if (String(e.message || '').includes('not a verified owner')) {
        console.error(`  ⚠️ 이 서브도메인에 대한 검증이 부족합니다.`);
        console.error(`  → APEX TXT 가 정상 반영됐다면 자동으로 서브도메인까지 커버됩니다.`);
        console.error(`  → 또는 각 서브도메인 HTML meta 태그에 google-site-verification 값을 넣어 주세요.`);
      }
      continue;
    }

    const sitemapUrl = `https://${host}/sitemap.xml`;
    try {
      const smResult = await submitSitemap(siteUrl, sitemapUrl);
      console.log(`      └ ${sitemapUrl} → ${smResult}`);
    } catch (e) {
      console.error(`      └ ${sitemapUrl} → sitemap 실패: ${e.message}`);
    }
  }

  // 3) APEX 도메인 속성에도 sitemap 제출 (공통 sitemap 이 있으면 유용)
  const apexSitemap = `https://${apexDomain}/sitemap.xml`;
  try {
    const smResult = await submitSitemap(apexSite, apexSitemap);
    console.log(`[APEX] ${apexSitemap} → ${smResult}`);
  } catch (e) {
    console.error(`[APEX] ${apexSitemap} → sitemap 실패: ${e.message}`);
  }

  console.log(`\n✓ GSC sync 완료`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
