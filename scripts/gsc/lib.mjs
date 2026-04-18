import { google } from 'googleapis';
import { config } from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ENV_PATH = resolve(__dirname, '../../.env.gsc');
export const SITES_PATH = resolve(__dirname, './sites.json');
export const PORT = 53771;
export const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/adsense.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
  'https://www.googleapis.com/auth/tagmanager.readonly',
];

export function loadEnv() {
  if (existsSync(ENV_PATH)) config({ path: ENV_PATH });
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;
  if (!clientId || !clientSecret) {
    throw new Error(
      `GSC_CLIENT_ID / GSC_CLIENT_SECRET 가 ${ENV_PATH} 에 있어야 합니다. ` +
        `예: GSC_CLIENT_ID=... \n GSC_CLIENT_SECRET=...`,
    );
  }
  return { clientId, clientSecret, refreshToken };
}

export function saveEnv(updates) {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf-8') : '';
  const lines = existing.split('\n').filter(Boolean);
  const out = new Map();
  for (const line of lines) {
    const [k, ...rest] = line.split('=');
    if (k) out.set(k.trim(), rest.join('=').trim());
  }
  for (const [k, v] of Object.entries(updates)) out.set(k, String(v));
  const body = [...out.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(ENV_PATH, body);
}

export function makeOAuth(clientId, clientSecret) {
  return new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${PORT}/callback`);
}

export function authedClient() {
  const { clientId, clientSecret, refreshToken } = loadEnv();
  if (!refreshToken) {
    throw new Error('GSC_REFRESH_TOKEN 이 없습니다. 먼저 `node scripts/gsc/auth.mjs` 를 실행하세요.');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function loadSites() {
  return JSON.parse(readFileSync(SITES_PATH, 'utf-8'));
}
