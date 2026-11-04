import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { writeFile, rm } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const sdk = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.1/dist/umd/supabase.js';
const frameServer = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(`<iframe src="${base}/eternity/eliminar-cuenta.html"></iframe>`);
});
await new Promise(resolve => frameServer.listen(0, '127.0.0.1', resolve));
const crossOrigin = `http://127.0.0.1:${frameServer.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
let ownsLocalOverride = false;
try {
  const context = await browser.newContext();
  const actions = [], authCalls = [], scriptErrors = [];
  // Fulfill every Supabase request in-process: no production connection or local DB is used.
  const handleBackend = async route => {
    const request = route.request(), target = new URL(request.url());
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (target.pathname === '/auth/v1/token') {
      authCalls.push('sign-in');
      if (authCalls.length === 1) return route.fulfill({ status: 400, headers, body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
      const user = { id: '44444444-4444-4444-8444-444444444444', email: 'synthetic@example.invalid', is_anonymous: false };
      const fixtureSession = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'synthetic-signature'].join('.');
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ access_token: fixtureSession, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user }) });
    }
    if (target.pathname === '/auth/v1/logout') {
      authCalls.push('sign-out');
      return route.fulfill({ status: 204, headers });
    }
    assert.equal(target.pathname, '/functions/v1/privacy', 'Only Auth and privacy contracts are allowed');
    const command = request.postDataJSON();
    actions.push(command);
    const value = command.action === 'get_state' ? { status: 'eligible' }
      : command.action === 'challenge' ? { challenge: 'synthetic-session-proof' }
      : { requestId: '55555555-5555-4555-8555-555555555555', status: 'pending', pendingSteps: ['auth', 'confirm'] };
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ ok: true, value }) });
  };
  await context.route('https://*.supabase.co/**', handleBackend);
  await context.route('http://127.0.0.1:55321/**', handleBackend);
  await context.addInitScript(() => {
    window.policyViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.policyViolations.push(event.effectiveDirective));
  });
  const page = await context.newPage();
  page.on('pageerror', error => scriptErrors.push(error.message));
  await page.goto(`${base}/eternity/eliminar-cuenta.html`);
  await page.locator('#sign-in:not([disabled])').waitFor();
  assert(await page.locator('#login-form').isVisible());
  assert.equal(await page.locator(`script[src="${sdk}"]`).getAttribute('integrity'), 'sha384-7R35uvsRMxI91PEqx2dijM/SZmh0TrM+r+kZ/+Jd2D5yaDSH9w3FxJQmxxsY509e');
  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('synthetic-incorrect');
  await page.locator('#sign-in').click();
  await page.getByText('No pudimos confirmar tu sesión.', { exact: false }).waitFor();
  assert.equal(await page.locator('#password').inputValue(), '');
  await page.locator('#password').fill('synthetic-correct');
  await page.locator('#sign-in').click();
  await page.locator('#confirmation-form:not([hidden])').waitFor();
  assert.deepEqual(actions.map(command => command.action), ['get_state']);
  await page.locator('#request-deletion').click();
  assert.equal(actions.length, 1, 'Explicit confirmation is required');
  await page.locator('#confirm-deletion').check();
  await page.locator('#request-deletion').click();
  await page.getByText('Solicitud recibida.', { exact: false }).waitFor();
  assert.deepEqual(actions.map(command => command.action), ['get_state', 'challenge', 'delete_account']);
  assert.equal(actions[2].challenge, 'synthetic-session-proof');
  assert.match(actions[2].commandId, /^[a-f0-9-]{36}$/);
  assert(authCalls.includes('sign-out'));
  assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookies: document.cookie })), { local: [], session: [], cookies: '' });
  assert.deepEqual(await page.evaluate(() => window.policyViolations), []);
  assert.deepEqual(scriptErrors, []);
  await page.reload();
  await page.locator('#sign-in:not([disabled])').waitFor();
  assert(await page.locator('#login-form').isVisible());
  console.log('PASS: real SRI-pinned SDK, fixture Auth → challenge → deletion → sign-out; confirmation, cleared password, no stored session; zero backend traffic.');

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.injectedScriptRan = true';
    document.head.append(script);
    return fetch('https://forbidden.example.invalid/').catch(() => {});
  });
  await page.waitForFunction(() => window.policyViolations.length >= 2);
  assert.equal(await page.evaluate(() => window.injectedScriptRan), undefined);
  const violations = await page.evaluate(() => window.policyViolations);
  assert(violations.includes('script-src-elem'));
  assert(violations.includes('connect-src'));
  console.log('PASS: CSP blocks injected inline script and an unapproved connection.');

  await context.route(`${base}/frame-test.html`, route => route.fulfill({ contentType: 'text/html', body: `<iframe src="${base}/eternity/eliminar-cuenta.html"></iframe>` }));
  for (const origin of [base, crossOrigin]) {
    const before = authCalls.length;
    await page.goto(`${origin}/frame-test.html`);
    const frame = page.frameLocator('iframe');
    await frame.locator('h1').waitFor();
    await frame.locator('.theme-toggle:not([hidden])').waitFor();
    assert.equal(await frame.locator('#flow').isVisible(), false);
    assert.equal(await frame.locator('#sign-in').isDisabled(), true);
    // Dispatching synthetic submits must not reach Auth, even without a visible control.
    assert.equal(await frame.locator('#login-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))), true, 'No submission handler may be attached in a frame');
    assert.equal(authCalls.length, before);
  }
  console.log('PASS: same-origin and cross-origin frames cannot display or initialize the deletion form.');

  // Exercise the development override with synthetic public configuration only.
  await writeFile('config.local.js', 'export const config = {supabaseUrl:"http://127.0.0.1:55321",supabaseKey:"synthetic-public-config"};\n', { flag: 'wx' });
  ownsLocalOverride = true;
  await page.goto(`${base}/eternity/eliminar-cuenta.html`);
  await page.locator('#sign-in:not([disabled])').waitFor();
  await page.locator('#email').fill('synthetic@example.invalid');
  await page.locator('#password').fill('synthetic-local');
  await page.locator('#sign-in').click();
  await page.locator('#confirmation-form:not([hidden])').waitFor();
  await page.locator('#confirm-deletion').check();
  await page.locator('#request-deletion').click();
  await page.getByText('Solicitud recibida.', { exact: false }).waitFor();
  assert.deepEqual(actions.slice(-3).map(command => command.action), ['get_state', 'challenge', 'delete_account']);
  assert.deepEqual(await page.evaluate(() => window.policyViolations), []);
  await rm('config.local.js');
  ownsLocalOverride = false;
  console.log('PASS: local 55321 override supports the same deletion contract; production CSP in dist is unchanged.');
  await context.close();
  const noScripts = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScripts.newPage();
  await noScriptPage.goto(`${base}/eternity/eliminar-cuenta.html`);
  assert.equal(await noScriptPage.locator('#login-form').isVisible(), false);
  assert(await noScriptPage.locator('.noscript').isVisible());
  await noScripts.close();
  console.log('PASS: the form remains closed when JavaScript is disabled.');
} finally {
  if (ownsLocalOverride) await rm('config.local.js');
  await browser.close();
  await new Promise(resolve => frameServer.close(resolve));
}
