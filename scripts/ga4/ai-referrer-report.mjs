#!/usr/bin/env node
/**
 * AI 추천 트래픽(ChatGPT / Perplexity / Claude / Gemini / Copilot / You.com / Phind)
 * 7일·30일 baseline 리포트.
 *
 * - GA4 Data API 의 hostName × sessionSource × sessionMedium 차원으로 세션·users 집계
 * - AI referrer 도메인 화이트리스트로 필터
 * - 마크다운 테이블 + (옵션) HTML 1 파일 출력
 *
 * 사용:
 *   node scripts/ga4/ai-referrer-report.mjs                   # 콘솔 출력
 *   node scripts/ga4/ai-referrer-report.mjs --html            # HTML 도 같이 저장
 *   node scripts/ga4/ai-referrer-report.mjs --out report.md   # 마크다운 파일로 저장
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyticsData, loadGa4Properties } from './lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const WANT_HTML = args.includes('--html');
const OUT_IDX = args.indexOf('--out');
const OUT_MD = OUT_IDX >= 0 ? args[OUT_IDX + 1] : null;

/** AI referrer 도메인 화이트리스트 (sessionSource 값) */
const AI_SOURCES = [
  'chatgpt.com',
  'perplexity.ai',
  'www.perplexity.ai',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'you.com',
  'phind.com',
];

/** 호스트 이름을 짧게 (bal.pe.kr 제거) */
function shortHost(host) {
  if (!host) return '(unknown)';
  return host.replace(/\.bal\.pe\.kr$/, '').replace(/^bal\.pe\.kr$/, '(apex)');
}

/** GA4 가 source 를 정규화하므로 비교 시 lower-case 로 */
function isAiSource(src) {
  if (!src) return false;
  const s = src.toLowerCase();
  return AI_SOURCES.some((a) => s === a || s.endsWith(`.${a}`));
}

/**
 * GA4 Data API 호출.
 * @param {string} startDate YYYY-MM-DD or e.g. '7daysAgo'
 * @param {string} endDate
 */
async function runReport(propertyId, startDate, endDate) {
  const data = analyticsData();
  const res = await data.properties.runReport({
    property: propertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'hostName' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
      limit: 100000,
    },
  });
  return res.data.rows || [];
}

/** rows -> {host: {users, sessions, sources: Map<source, users>}} */
function aggregate(rows) {
  const byHost = new Map();
  let totalUsers = 0;
  for (const row of rows) {
    const [host, source, medium] = row.dimensionValues.map((d) => d.value);
    if (!isAiSource(source)) continue;
    // referral / organic 모두 포함 (medium 다양)
    const users = Number(row.metricValues[0].value || 0);
    const sessions = Number(row.metricValues[1].value || 0);
    if (!users && !sessions) continue;
    if (!byHost.has(host)) byHost.set(host, { users: 0, sessions: 0, sources: new Map() });
    const h = byHost.get(host);
    h.users += users;
    h.sessions += sessions;
    h.sources.set(source, (h.sources.get(source) || 0) + users);
    totalUsers += users;
  }
  return { byHost, totalUsers };
}

/** 모든 host (트래픽 있는 것 전부) - AI 0건 사이트 식별용 */
async function listAllHosts(propertyId, startDate, endDate) {
  const data = analyticsData();
  const res = await data.properties.runReport({
    property: propertyId,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'hostName' }],
      metrics: [{ name: 'totalUsers' }],
      limit: 1000,
    },
  });
  const out = new Map();
  for (const row of res.data.rows || []) {
    const host = row.dimensionValues[0].value;
    const users = Number(row.metricValues[0].value || 0);
    out.set(host, users);
  }
  return out;
}

function formatSourcesShort(sourcesMap) {
  return [...sourcesMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s, u]) => `${s.replace(/^www\./, '')}:${u}`)
    .join(', ');
}

function buildMarkdown({ propertyId, period7, period30, allHosts30 }) {
  const lines = [];
  lines.push(`# AI 추천 유입 베이스라인 (GA4)`);
  lines.push('');
  lines.push(`- Property: \`${propertyId}\``);
  lines.push(`- 생성: ${new Date().toISOString()}`);
  lines.push(`- AI 소스 화이트리스트: ${AI_SOURCES.join(', ')}`);
  lines.push('');
  lines.push(`## 요약`);
  lines.push('');
  lines.push(`- 7일 AI 유입 총 users: **${period7.totalUsers}**`);
  lines.push(`- 30일 AI 유입 총 users: **${period30.totalUsers}**`);
  lines.push(`- AI 유입 1+ 사이트: **${period30.byHost.size}**`);
  lines.push(`- 30일 트래픽 있으나 AI 0건 사이트: **${
    [...allHosts30.keys()].filter((h) => !period30.byHost.has(h)).length
  }**`);
  lines.push('');

  // TOP 10 (30일 기준)
  const top10 = [...period30.byHost.entries()]
    .sort((a, b) => b[1].users - a[1].users)
    .slice(0, 10);

  lines.push(`## TOP 10 AI 유입 사이트 (30일 기준)`);
  lines.push('');
  lines.push('| # | host | 7d users | 30d users | 30d sessions | 주요 AI 소스 |');
  lines.push('|---|------|---------:|----------:|-------------:|--------------|');
  top10.forEach(([host, agg30], i) => {
    const agg7 = period7.byHost.get(host);
    const u7 = agg7 ? agg7.users : 0;
    lines.push(
      `| ${i + 1} | ${shortHost(host)} | ${u7} | ${agg30.users} | ${agg30.sessions} | ${formatSourcesShort(
        agg30.sources,
      )} |`,
    );
  });
  lines.push('');

  // 전체 AI 1+ 호스트 표
  lines.push(`## AI 유입 1+ 사이트 전체 (30일 기준, users desc)`);
  lines.push('');
  lines.push('| host | 7d users | 30d users | 30d sessions | 주요 AI 소스 |');
  lines.push('|------|---------:|----------:|-------------:|--------------|');
  const allRows = [...period30.byHost.entries()].sort((a, b) => b[1].users - a[1].users);
  for (const [host, agg30] of allRows) {
    const agg7 = period7.byHost.get(host);
    const u7 = agg7 ? agg7.users : 0;
    lines.push(
      `| ${shortHost(host)} | ${u7} | ${agg30.users} | ${agg30.sessions} | ${formatSourcesShort(
        agg30.sources,
      )} |`,
    );
  }
  lines.push('');

  // AI 0건 사이트 (트래픽은 있는데 AI 가 없음)
  const zeroHosts = [...allHosts30.entries()]
    .filter(([h]) => !period30.byHost.has(h))
    .sort((a, b) => b[1] - a[1]);
  lines.push(`## AI 유입 0건 (30일 트래픽 있음)`);
  lines.push('');
  lines.push('| host | 30d users (전체) |');
  lines.push('|------|-----------------:|');
  for (const [host, users] of zeroHosts.slice(0, 50)) {
    lines.push(`| ${shortHost(host)} | ${users} |`);
  }
  if (zeroHosts.length > 50) {
    lines.push(`| … 외 ${zeroHosts.length - 50}개 더 | |`);
  }
  lines.push('');

  return lines.join('\n');
}

function buildHtml({ propertyId, period7, period30, allHosts30 }) {
  const top10 = [...period30.byHost.entries()]
    .sort((a, b) => b[1].users - a[1].users)
    .slice(0, 10);
  const allRows = [...period30.byHost.entries()].sort((a, b) => b[1].users - a[1].users);
  const zeroHosts = [...allHosts30.entries()]
    .filter(([h]) => !period30.byHost.has(h))
    .sort((a, b) => b[1] - a[1]);

  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );

  const topRows = top10
    .map(([host, agg30], i) => {
      const agg7 = period7.byHost.get(host);
      const u7 = agg7 ? agg7.users : 0;
      return `<tr><td>${i + 1}</td><td>${escape(shortHost(host))}</td><td class="num">${u7}</td><td class="num">${agg30.users}</td><td class="num">${agg30.sessions}</td><td>${escape(formatSourcesShort(agg30.sources))}</td></tr>`;
    })
    .join('\n');

  const allRowsHtml = allRows
    .map(([host, agg30]) => {
      const agg7 = period7.byHost.get(host);
      const u7 = agg7 ? agg7.users : 0;
      return `<tr><td>${escape(shortHost(host))}</td><td class="num">${u7}</td><td class="num">${agg30.users}</td><td class="num">${agg30.sessions}</td><td>${escape(formatSourcesShort(agg30.sources))}</td></tr>`;
    })
    .join('\n');

  const zeroRowsHtml = zeroHosts
    .slice(0, 100)
    .map(
      ([host, users]) =>
        `<tr><td>${escape(shortHost(host))}</td><td class="num">${users}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>AI 추천 유입 베이스라인 — bal.pe.kr</title>
<meta name="generated" content="${new Date().toISOString()}" />
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 1080px; margin: 24px auto; padding: 0 16px; color: #0f172a; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  h2 { margin-top: 32px; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 12px 0 24px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat .value { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:hover { background: #f8fafc; }
  details { margin: 12px 0; }
  summary { cursor: pointer; color: #0369a1; font-weight: 600; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>
<h1>AI 추천 유입 베이스라인</h1>
<div class="meta">Property <code>${escape(propertyId)}</code> · 생성 ${new Date().toISOString()} · 화이트리스트: ${escape(AI_SOURCES.join(', '))}</div>

<div class="stats">
  <div class="stat"><div class="label">7d AI users</div><div class="value">${period7.totalUsers}</div></div>
  <div class="stat"><div class="label">30d AI users</div><div class="value">${period30.totalUsers}</div></div>
  <div class="stat"><div class="label">AI 1+ 사이트</div><div class="value">${period30.byHost.size}</div></div>
  <div class="stat"><div class="label">AI 0건 사이트</div><div class="value">${zeroHosts.length}</div></div>
</div>

<h2>TOP 10 AI 유입 사이트 (30일)</h2>
<table>
  <thead><tr><th>#</th><th>host</th><th>7d users</th><th>30d users</th><th>30d sessions</th><th>주요 AI 소스</th></tr></thead>
  <tbody>${topRows}</tbody>
</table>

<h2>AI 1+ 사이트 전체 (${allRows.length})</h2>
<details open>
  <summary>표 펼치기/접기</summary>
  <table>
    <thead><tr><th>host</th><th>7d users</th><th>30d users</th><th>30d sessions</th><th>주요 AI 소스</th></tr></thead>
    <tbody>${allRowsHtml}</tbody>
  </table>
</details>

<h2>AI 0건 (30일 트래픽 있음, ${zeroHosts.length})</h2>
<details>
  <summary>표 펼치기 (상위 100)</summary>
  <table>
    <thead><tr><th>host</th><th>30d users (전체)</th></tr></thead>
    <tbody>${zeroRowsHtml}</tbody>
  </table>
</details>
</body>
</html>
`;
}

async function main() {
  const props = loadGa4Properties();
  const propertyId = props.propertyId; // properties/533557200

  console.error(`→ GA4 ${propertyId} · 7일 / 30일 AI 유입 조회 중...`);

  const [rows7, rows30, all30] = await Promise.all([
    runReport(propertyId, '7daysAgo', 'yesterday'),
    runReport(propertyId, '30daysAgo', 'yesterday'),
    listAllHosts(propertyId, '30daysAgo', 'yesterday'),
  ]);

  const period7 = aggregate(rows7);
  const period30 = aggregate(rows30);

  const md = buildMarkdown({ propertyId, period7, period30, allHosts30: all30 });
  if (OUT_MD) {
    writeFileSync(resolve(process.cwd(), OUT_MD), md);
    console.error(`✓ markdown saved: ${OUT_MD}`);
  } else {
    process.stdout.write(md);
  }

  if (WANT_HTML) {
    const html = buildHtml({ propertyId, period7, period30, allHosts30: all30 });
    const htmlPath = resolve(__dirname, './ai-referrer-latest.html');
    writeFileSync(htmlPath, html);
    console.error(`✓ html saved: ${htmlPath}`);
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
