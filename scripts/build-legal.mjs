import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import { page, escapeHtml, siteUrl } from './layout.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Uso: node scripts/build-legal.mjs <directorio documentos>');
// Explicit publication allowlist: commerce and retired guardian material stay private.
const documents = [
  ['politica-de-privacidad.md', 'privacidad.html', 'Política de Privacidad', 'Cómo cuidamos tus datos y cómo ejercer tus derechos.'],
  ['terminos-y-condiciones.md', 'terminos.html', 'Términos y condiciones', 'Las condiciones de uso de Eternity y de su beta.'],
  ['normas-de-la-comunidad.md', 'normas.html', 'Normas de la comunidad', 'Un espacio para aprender con respeto y cuidar a los demás.'],
];
const destinations = Object.fromEntries(documents.map(([source, output]) => [source, output]));
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
md.renderer.rules.table_open = () => '<div class="table-scroll" role="region" aria-label="Tabla del documento; desplaza para ver todas las columnas" tabindex="0"><table>\n';
md.renderer.rules.table_close = () => '</table></div>\n';
const linkOpen = md.renderer.rules.link_open ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index], href = token.attrGet('href');
  if (destinations[href]) token.attrSet('href', `./${destinations[href]}`);
  if (href?.endsWith('.md') && !destinations[href]) throw new Error(`Documento enlazado sin publicar: ${href}`);
  return linkOpen(tokens, index, options, env, self);
};
const manifest = [];
for (const [source, output, title, description] of documents) {
  const original = (await readFile(path.resolve(sourceDirectory, source), 'utf8')).replace(/^\uFEFF/, '');
  const version = original.match(/\*\*Versión\s+([^\s—]+)/)?.[1];
  const effectiveDate = original.match(/\*\*Entrada en vigor:\*\*\s*([^.*]+)\./)?.[1]?.trim();
  if (!version || !effectiveDate) throw new Error(`Falta versión o fecha: ${source}`);
  const policyVersion = version.startsWith('ve-') ? version : `ve-${version}`;
  const substituted = original
    .replaceAll('[URL EXTERNA DE ELIMINACIÓN]', `[esta página de eliminación](${siteUrl}eliminar-cuenta.html)`)
    .replaceAll('[URL PÚBLICA DE DOCUMENTOS]', `[los documentos públicos de Eternity](${siteUrl})`);
  const headingStart = substituted.search(/^# /m);
  if (headingStart < 0) throw new Error(`Falta título: ${source}`);
  // Preserve editorial caveats in a disclosure after the complete legal text.
  const editorial = substituted.slice(0, headingStart).trim();
  const body = substituted.slice(headingStart).replace(/^# [^\n]+\n/, '');
  const tokens = md.parse(body, {}), contents = [];
  let section = 0;
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type === 'heading_open') {
      const id = `seccion-${++section}`;
      tokens[index].attrSet('id', id);
      if (tokens[index].tag === 'h3') contents.push([id, tokens[index + 1].content]);
    }
  }
  const content = `<div class="page-heading"><p class="eyebrow">Eternity · Documentos de la beta</p><h1>${escapeHtml(title)}</h1><p class="meta">Política ${escapeHtml(policyVersion)}<br>Texto legal ${escapeHtml(version)} · Vigente desde el ${escapeHtml(effectiveDate)}</p></div>
  <div class="note warm"><p><strong>Beta en Venezuela · desde los 13 años.</strong> Revisión jurídica pendiente. El contacto info@eternity.app que figura en el texto sigue siendo provisional y aún no está operativo. Para solicitar la baja con correo y contraseña, usa <a href="./eliminar-cuenta.html">Eliminar cuenta</a>.</p></div>
  <div class="legal-grid"><aside class="contents" aria-label="Contenido del documento"><h2>En este documento</h2><ol>${contents.map(([id, label]) => `<li><a href="#${id}">${escapeHtml(label.replace(/^\d+\.\s*/, ''))}</a></li>`).join('')}</ol></aside>
  <article class="legal-body" aria-label="Texto completo de ${escapeHtml(title)}">${md.renderer.render(tokens, md.options, {})}${editorial ? `<details class="note warm"><summary>Pendientes declarados en el documento fuente</summary>${md.render(editorial)}</details>` : ''}</article></div>`;
  await writeFile(path.join(root, output), page({ title, description, file: output, content }));
  manifest.push({ source, output, legalVersion: version, policyVersion, effectiveDate, sourceSha256: createHash('sha256').update(original).digest('hex') });
}
await writeFile(path.join(root, 'legal-build.json'), JSON.stringify({ documents: manifest, substitutions: { publicDocuments: siteUrl, accountDeletion: `${siteUrl}eliminar-cuenta.html` } }, null, 2) + '\n');
console.log(`Generados ${manifest.length} documentos legales. Compras y documentos de representantes excluidos.`);
