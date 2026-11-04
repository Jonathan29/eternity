import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkHtmlSinks, findHtmlSinks } from '../scripts/check-html-sinks.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

test('preserves Spanish prose and safe DOM updates', () => {
  assert.deepEqual(findHtmlSinks('No evalúan tu fe. element.textContent = value;', 'fixture.html'), []);
});

for (const source of ['element.innerHTML = value', 'element.outerHTML = value', 'element.insertAdjacentHTML("beforeend", value)', 'document.write(value)', 'document ["write"](value)', 'document.writeln(value)', 'eval(value)', '(0, window.eval)(value)', 'element["innerHTML"] = value']) {
  test(`rejects ${source.split(/[=(]/)[0].trim()}`, () => {
    const findings = findHtmlSinks(`// first line\n${source}`, 'fixture.js');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 2);
  });
}

test('checks nested site files and reports locations without source values', async () => {
  await mkdir('.local', { recursive: true });
  const root = await mkdtemp(path.resolve('.local/sinks-'));
  try {
    await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'assets/widget.js'), 'element.innerHTML = "synthetic-sensitive-content"');
    await assert.rejects(checkHtmlSinks(root), error => {
      assert.equal(error.message, 'assets/widget.js:1: forbidden innerHTML');
      return true;
    });
    await writeFile(path.join(root, 'assets/widget.js'), 'element.textContent = value; element.replaceChildren()');
    await checkHtmlSinks(root);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the site-check command fails on an injected site file', async () => {
  const file = `assets/security-regression-${randomUUID()}.js`;
  await writeFile(file, 'element.innerHTML = "synthetic-marker"; eval("synthetic-marker");', { flag: 'wx' });
  try {
    const result = spawnSync(process.execPath, ['scripts/check-site.mjs', '--static'], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 1);
    const output = result.stdout + result.stderr;
    assert(output.includes(`${file}:1: forbidden innerHTML`));
    assert(output.includes(`${file}:1: forbidden eval`));
    assert(!output.includes('synthetic-marker'));
  } finally { await rm(file); }
});
