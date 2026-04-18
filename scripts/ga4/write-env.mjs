#!/usr/bin/env node
/**
 * 현재 작업 디렉토리에 .env 파일을 생성.
 * properties.json (SSoT) 을 참조해 slug 기반으로 VITE_* 값을 채움.
 *
 * 사용:
 *   node write-env.mjs <slug>
 *   예: node write-env.mjs jeonse
 *
 * CI 사용 예 (각 레포 deploy.yml):
 *   - run: node infra/microsaas-infra/scripts/ga4/write-env.mjs <slug>
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(__dirname, './properties.json'), 'utf-8'));

const slug = process.argv[2];
if (!slug) {
  console.error('usage: write-env.mjs <slug>');
  process.exit(2);
}
const site = cfg.sites[slug];
if (!site) {
  console.error(`unknown slug: ${slug}. available: ${Object.keys(cfg.sites).join(', ')}`);
  process.exit(2);
}

const envContent =
  [
    `VITE_GA_MEASUREMENT_ID=${cfg.measurementId}`,
    `VITE_NAVER_ANALYTICS_ID=${cfg.naverWa}`,
    `VITE_SITE_ID=${site.siteId}`,
    `VITE_SITE_CATEGORY=${site.category}`,
  ].join('\n') + '\n';

const outPath = resolve(process.cwd(), '.env');
writeFileSync(outPath, envContent);
console.log(`✓ ${outPath}`);
console.log(envContent);
