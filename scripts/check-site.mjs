import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const files = ['index.html','privacidad.html','terminos.html','normas.html','eliminar-cuenta.html','404.html'];
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
await mkdir('test-results',{recursive:true});
try {
  let checks = 0;
  for (const dark of [false,true]) {
    const context = await browser.newContext({colorScheme:dark ? 'dark' : 'light',viewport:{width:360,height:800}});
    // Hard boundary: browsing the static pages must never reach the production backend.
    await context.route('https://*.supabase.co/**', route => { throw new Error('Production backend blocked during tests'); });
    const page = await context.newPage();
    const scriptErrors = [];
    page.on('pageerror', error => scriptErrors.push(error.message));
    for (const file of files) {
      await page.goto(`http://127.0.0.1:4173/eternity/${file}`);
      await page.locator('.theme-toggle:not([hidden])').waitFor();
      assert.equal(await page.locator('h1').count(),1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${file} horizontal overflow`);
      const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      assert.deepEqual(results.violations.map(item => ({id:item.id,nodes:item.nodes.map(node => node.target)})),[],`${file} ${dark?'dark':'light'} accessibility`);
      if (['index.html','eliminar-cuenta.html','privacidad.html'].includes(file)) await page.screenshot({path:`test-results/${file.replace('.html','')}-${dark?'dark':'light'}-360.png`,fullPage:true});
      // All local links must resolve, including remapped Markdown and document anchors.
      for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
        if (href.startsWith('#')) assert(await page.locator(href).count(),`Missing anchor ${href}`);
        else if (href.startsWith('./') || href.startsWith('/eternity/')) assert((await page.request.get(new URL(href,page.url()).href)).ok(),`Broken link ${href}`);
      }
      checks++;
    }
    assert.deepEqual(scriptErrors,[]);
    await page.goto('http://127.0.0.1:4173/eternity/');
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:`test-results/home-${dark?'dark':'light'}-1440.png`,fullPage:true});
    await page.getByRole('button',{name:dark?'Cambiar a tema claro':'Cambiar a tema oscuro'}).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),dark?'light':'dark');
    await context.close();
  }
  console.log('PASS: 12 page/theme checks; 360px overflow, WCAG AA axe, links, theme toggle, screenshots.');
} finally { await browser.close(); }
