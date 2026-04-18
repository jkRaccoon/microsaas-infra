import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authedClient } from '../gsc/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONTAINER_PATH = resolve(__dirname, './container.json');

export function loadContainerCfg() {
  return JSON.parse(readFileSync(CONTAINER_PATH, 'utf-8'));
}

export function tagmanager() {
  return google.tagmanager({ version: 'v2', auth: authedClient() });
}
