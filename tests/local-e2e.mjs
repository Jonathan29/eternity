// Local-only integration test. Caller must hold the shared Supabase lock.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const app = path.resolve(process.argv[2] || '');
assert(process.argv[2], 'Provide the APP worktree path');
assert(process.env.SUPABASE_LOCAL_LOCK_DIR,'Caller must hold the shared lock');
const owner = await readFile(path.join(process.env.SUPABASE_LOCAL_LOCK_DIR,'OWNER'),'utf8');
assert(owner.startsWith('impl/web-deletion '),'Local lock is not owned by this branch');
const cli = path.join(app,'node_modules/supabase/bin/supabase.exe');
const status = JSON.parse(execFileSync(cli,['status','-o','json'],{cwd:app,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url = new URL(status.API_URL);
assert.equal(url.origin,'http://127.0.0.1:55321','Only the local 553xx stack is allowed');
const requireApp = createRequire(path.join(app,'package.json'));
const { Client } = requireApp('pg');
const db = new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55322/postgres'});
const log = await open('.local/edge.log','w');
const edge = spawn(cli,['functions','serve','privacy','--env-file','supabase/functions/.env'],{cwd:app,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
let browser;
try {
  await writeFile('config.local.js',`// LOCAL TEST ONLY — ignored by Git.\nexport const config = ${JSON.stringify({supabaseUrl:url.origin,supabaseKey:status.ANON_KEY})};\n`);
  let ready = false;
  for (let attempt=0;attempt<45;attempt++) {
    await new Promise(resolve => setTimeout(resolve,1000));
    const response = await fetch(`${url.origin}/functions/v1/privacy`,{method:'OPTIONS',signal:AbortSignal.timeout(2000)}).catch(() => null);
    if (response?.ok && response.headers.get('Access-Control-Allow-Origin') === '*') { ready=true;break; }
  }
  assert(ready,'Local Edge Function did not start');
  console.log('Local privacy function ready; production traffic is blocked in the browser.');
  await db.connect();
  const email = `site-deletion-${randomUUID()}@example.invalid`, password = randomBytes(32).toString('hex');
  const response = await fetch(`${url.origin}/auth/v1/admin/users`,{method:'POST',headers:{apikey:status.SERVICE_ROLE_KEY,Authorization:`Bearer ${status.SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true}),signal:AbortSignal.timeout(10000)});
  assert(response.ok,`Local synthetic user creation failed: ${response.status}`);
  const user = await response.json();
  browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const productionRequests = [], commands = [], routes = [];
  await context.route('**/*',async route => {
    const request = route.request(), target = new URL(request.url());
    if (target.hostname.endsWith('.supabase.co')) { productionRequests.push(target.hostname); return route.abort(); }
    if (target.hostname === '127.0.0.1' && target.port === '55321') {
      routes.push(target.pathname);
      assert(target.pathname.startsWith('/auth/v1/') || target.pathname === '/functions/v1/privacy','Browser must use Auth and privacy, never table writes');
      if(target.pathname === '/functions/v1/privacy' && request.method() === 'POST') commands.push(request.postDataJSON());
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/eternity/eliminar-cuenta.html');
  await page.locator('#sign-in:not([disabled])').waitFor();
  // Exercise a real Auth failure before the successful login.
  await page.locator('#email').fill(email); await page.locator('#password').fill('incorrect-local-password');
  await page.locator('#sign-in').click();
  await page.getByText('No pudimos confirmar tu sesión.',{exact:false}).waitFor();
  assert.equal(await page.locator('#password').inputValue(),'');
  await page.locator('#password').fill(password); await page.locator('#sign-in').click();
  await page.locator('#confirmation-form:not([hidden])').waitFor({timeout:20000});
  assert.equal(commands.some(command => command.action === 'delete_account'),false,'Sign-in alone must not request deletion');
  await page.locator('#request-deletion').click();
  assert.equal(commands.some(command => command.action === 'delete_account'),false,'Unchecked confirmation must not send deletion');
  await page.locator('#confirm-deletion').check();
  await page.locator('#request-deletion').click();
  await page.getByText('Solicitud recibida.',{exact:false}).waitFor({timeout:20000});
  const receipt = await page.locator('.receipt').textContent();
  const requestId = receipt.match(/[a-f0-9-]{36}/)?.[0]; assert(requestId);
  assert.deepEqual(commands.map(command=>command.action),['get_state','challenge','delete_account']);
  const deletion = commands.at(-1); assert(deletion.challenge && deletion.commandId);
  const rows = await db.query('select s.status,s.allowed,j.request_id,j.kind,j.status as job_status from private.user_privacy_state s join private.privacy_jobs j on j.user_id=s.user_id where s.user_id=$1 and j.request_id=$2',[user.id,requestId]);
  assert.equal(rows.rowCount,1); assert.equal(rows.rows[0].status,'deletion_pending'); assert.equal(rows.rows[0].kind,'deletion');
  assert(Object.values(rows.rows[0].allowed).every(value=>value===false));
  assert.equal((await db.query('select count(*)::int as count from private.privacy_job_steps where request_id=$1',[requestId])).rows[0].count,8);
  assert(routes.includes('/auth/v1/logout'),'Session must be signed out after acceptance');
  assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),cookies:document.cookie})),{local:[],session:[],cookies:''});
  await page.screenshot({path:'test-results/local-deletion-receipt.png',fullPage:true});
  // Refresh has no stored credentials and must require a fresh sign-in.
  await page.reload(); await page.locator('#sign-in:not([disabled])').waitFor();
  assert(await page.locator('#login-form').isVisible());
  assert.equal(await page.locator('#password').inputValue(),'');
  assert.deepEqual(productionRequests,[]);
  await writeFile('test-results/local-e2e.json',JSON.stringify({result:'PASS',target:url.origin,origin:'http://127.0.0.1:4173',actions:['signInWithPassword','get_state','challenge','delete_account','signOut'],serverState:'deletion_pending',pendingSteps:8,requestId,checks:['invalid password','explicit confirmation required','all capabilities false','no table writes from browser','no cookies or persistent session','refresh requires login','zero production requests']},null,2)+'\n');
  console.log('PASS: real local browser sign-in → confirmation → session challenge → deletion receipt → sign-out. DB: deletion_pending, eight queued steps, all capabilities false; zero production requests.');
} finally {
  if(browser) await browser.close();
  await db.end().catch(()=>{});
  edge.kill();
  await log.close();
  await rm('config.local.js',{force:true});
}
