#!/usr/bin/env node
/**
 * 모든 도메인의 /ads.txt 서빙 상태 검증.
 */
import { loadSites } from '../gsc/lib.mjs';

async function checkAdsTxt(host) {
  const url = `https://${host}/ads.txt`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    const hasPubLine = /pub-\d{16}/.test(text);
    return { ok: hasPubLine, status: res.status, text: text.trim() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  const { apexDomain, subdomains } = loadSites();
  const hosts = [apexDomain, ...subdomains];
  console.log(`→ ${hosts.length} 도메인의 ads.txt 검증\n`);
  for (const host of hosts) {
    const r = await checkAdsTxt(host);
    if (r.ok) {
      console.log(`  ✓ ${host}  ${r.text}`);
    } else {
      console.log(`  ✗ ${host}  status=${r.status || '-'}${r.error ? ' (' + r.error + ')' : ''}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
