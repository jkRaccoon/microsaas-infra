#!/usr/bin/env node
/**
 * 로컬 개발 편의: properties.json 의 sites 전체를 순회하며 각 레포 루트에 .env 를 생성.
 * CI 는 write-env.mjs <slug> 를 사용. 이 스크립트는 개발 환경에서만.
 */
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK = resolve(__dirname, '../../..');
const cfg = JSON.parse(readFileSync(resolve(__dirname, './properties.json'), 'utf-8'));

for (const [slug, site] of Object.entries(cfg.sites)) {
  const projectDir = resolve(WORK, slug);
  if (!existsSync(projectDir)) {
    console.log(`  · ${slug}: 디렉토리 없음, skip`);
    continue;
  }
  const envContent =
    [
      `VITE_GA_MEASUREMENT_ID=${cfg.measurementId}`,
      `VITE_NAVER_ANALYTICS_ID=${cfg.naverWa}`,
      `VITE_SITE_ID=${site.siteId}`,
      `VITE_SITE_CATEGORY=${site.category}`,
    ].join('\n') + '\n';
  writeFileSync(resolve(projectDir, '.env'), envContent);
  console.log(`  ✓ ${slug}/.env  (site_id=${site.siteId}, category=${site.category})`);
}
