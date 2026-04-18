#!/usr/bin/env node
/** 접근 가능한 GTM 계정·컨테이너·워크스페이스·태그 조회. */
import { tagmanager, loadContainerCfg } from './lib.mjs';

const gtm = tagmanager();

async function main() {
  const cfg = loadContainerCfg();
  console.log(`→ GTM discover (컨테이너 ${cfg.publicId} 포커스)\n`);

  const accs = (await gtm.accounts.list({ pageSize: 20 })).data.account || [];
  if (accs.length === 0) {
    console.log(`계정 없음.`);
    return;
  }

  for (const acc of accs) {
    console.log(`# Account: ${acc.name} (${acc.path})`);
    const conts =
      (await gtm.accounts.containers.list({ parent: acc.path, pageSize: 50 })).data.container ||
      [];
    for (const c of conts) {
      const match = c.publicId === cfg.publicId ? ' ← target' : '';
      console.log(`  · Container: ${c.name} (${c.publicId})${match}`);
      if (c.publicId === cfg.publicId) {
        const ws =
          (await gtm.accounts.containers.workspaces.list({ parent: c.path })).data.workspace || [];
        for (const w of ws) {
          console.log(`    Workspace: ${w.name} (${w.workspaceId})`);
          const tags =
            (await gtm.accounts.containers.workspaces.tags.list({ parent: w.path })).data.tag ||
            [];
          console.log(`      Tags (${tags.length}):`);
          for (const t of tags) console.log(`        · ${t.name} [${t.type}]`);
          const trgs =
            (await gtm.accounts.containers.workspaces.triggers.list({ parent: w.path })).data
              .trigger || [];
          console.log(`      Triggers (${trgs.length}):`);
          for (const t of trgs) console.log(`        · ${t.name} [${t.type}]`);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
