import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const pages = ['index.html', 'privacidad.html', 'terminos.html', 'normas.html', 'eliminar-cuenta.html', '404.html'];
const files = [...pages, 'styles.css', 'theme.js', 'config.js', 'deletion.js', 'deletion-client.js', 'robots.txt', '.nojekyll', 'assets'];

test('build publishes an exact allowlist and removes stale output', async () => {
  await mkdir('dist', { recursive: true });
  await writeFile('dist/private-backup.txt', 'Synthetic stale output');
  execFileSync(process.execPath, ['scripts/build-static.mjs']);
  assert.deepEqual((await readdir('dist')).sort(), files.sort());
  assert.deepEqual(await readdir('dist/assets'), ['seed.svg']);
});

test('every published page restricts resources before loading them and preserves legal text', async () => {
  for (const file of pages) {
    const html = await readFile(`dist/${file}`, 'utf8');
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    assert(policy, `${file}: CSP missing`);
    assert(html.indexOf(policy[0]) < html.indexOf('<link'), `${file}: CSP must precede resources`);
    for (const directive of ["default-src 'none'", "script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.1/dist/umd/supabase.js", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "frame-src 'none'"]) {
      assert(policy[1].includes(directive), `${file}: missing ${directive}`);
    }
    assert(!/unsafe-inline|unsafe-eval|frame-ancestors|\*/.test(policy[1]));
    assert.match(policy[1], /connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co;/);
    if (['privacidad.html', 'terminos.html', 'normas.html'].includes(file)) {
      const source = await readFile(file, 'utf8');
      assert.equal(html.slice(html.indexOf('<body>')), source.slice(source.indexOf('<body>')));
    }
  }
  const deletion = await readFile('dist/eliminar-cuenta.html', 'utf8');
  assert.match(deletion, /integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"/);
  assert.match(deletion, /id="login-form" hidden/);
});
