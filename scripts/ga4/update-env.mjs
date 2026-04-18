#!/usr/bin/env node
/**
 * properties.json 의 perDomain 매핑을 각 프로젝트 .env 의 VITE_GA_MEASUREMENT_ID 에 반영.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadGa4Properties } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORK = resolve(__dirname, '../../..');

// host → 프로젝트 디렉토리 이름 (WORK 기준)
const HOST_TO_PROJECT = {
  'bal.pe.kr': 'bal-hub',
  'pogalwage.bal.pe.kr': 'pogalwage',
  'dsr.bal.pe.kr': 'dsr',
  'jeonse.bal.pe.kr': 'jeonse',
  'yangdose.bal.pe.kr': 'yangdose',
  'naeyong.bal.pe.kr': 'naeyong',
  'jigeup.bal.pe.kr': 'jigeup',
};

function upsertLine(content, key, value) {
  const lines = content.split(/\r?\n/);
  let found = false;
  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  return out.filter((l, i, arr) => !(l === '' && i === arr.length - 1)).join('\n') + '\n';
}

function main() {
  const cfg = loadGa4Properties();
  if (!cfg.perDomain) {
    console.error('perDomain 매핑 없음. 먼저 create-per-domain.mjs 실행 필요.');
    process.exit(1);
  }

  for (const [host, id] of Object.entries(cfg.perDomain)) {
    const project = HOST_TO_PROJECT[host];
    if (!project) {
      console.log(`  · ${host}: mapping 없음, skip`);
      continue;
    }
    const envPath = resolve(WORK, project, '.env');
    const content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
    const next = upsertLine(content, 'VITE_GA_MEASUREMENT_ID', id);
    writeFileSync(envPath, next);
    console.log(`  ✓ ${project}/.env ← ${id}`);
  }
}

main();
