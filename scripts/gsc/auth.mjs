#!/usr/bin/env node
/**
 * 초기 OAuth 인증: 브라우저에서 Google 로그인 · 권한 동의 후 refresh token 을 .env.gsc 에 저장.
 * 이 스크립트는 한 번만 실행하면 됨.
 *
 * 사전 조건:
 *   .env.gsc 에 GSC_CLIENT_ID, GSC_CLIENT_SECRET 이 있어야 함.
 */
import { createServer } from 'http';
import open from 'open';
import { URL } from 'url';
import { PORT, SCOPES, loadEnv, makeOAuth, saveEnv } from './lib.mjs';

const { clientId, clientSecret } = loadEnv();
const oauth2 = makeOAuth(clientId, clientSecret);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log(`\n→ 브라우저를 열어 로그인합니다.`);
console.log(`  (열리지 않으면 아래 URL 을 직접 붙여넣기)`);
console.log(`  ${url}\n`);

const server = createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
    if (reqUrl.pathname !== '/callback') {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const code = reqUrl.searchParams.get('code');
    if (!code) {
      res.writeHead(400);
      res.end('missing code');
      return;
    }
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      res.writeHead(500);
      res.end('⚠️ refresh_token 이 응답에 없습니다. OAuth 동의 화면에서 "테스트 사용자"에 본인 이메일이 추가됐는지 확인하고, 이미 승인한 경우 https://myaccount.google.com/permissions 에서 권한을 제거한 뒤 다시 실행하세요.');
      console.error('\n⚠️ refresh_token 이 반환되지 않았습니다.');
      process.exit(1);
    }
    saveEnv({ GSC_REFRESH_TOKEN: tokens.refresh_token });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:auto">
        <h1>✅ 인증 완료</h1>
        <p>refresh_token 이 <code>.env.gsc</code> 에 저장되었습니다.</p>
        <p>이제 터미널로 돌아가서 <code>node scripts/gsc/register-all.mjs</code> 를 실행하세요.</p>
        <p>이 창은 닫으셔도 됩니다.</p>
      </body></html>
    `);
    console.log('✓ refresh_token 저장 완료. 서버를 종료합니다.');
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('error');
    process.exit(1);
  }
});

server.listen(PORT, async () => {
  await open(url);
});
