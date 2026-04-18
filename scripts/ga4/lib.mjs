import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authedClient } from '../gsc/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const GA_SITES_PATH = resolve(__dirname, './properties.json');

/** Load GA4 property map (editable). */
export function loadGa4Properties() {
  return JSON.parse(readFileSync(GA_SITES_PATH, 'utf-8'));
}

export function analyticsAdmin() {
  return google.analyticsadmin({ version: 'v1beta', auth: authedClient() });
}

export function analyticsData() {
  return google.analyticsdata({ version: 'v1beta', auth: authedClient() });
}
