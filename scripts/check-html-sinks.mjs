import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const excluded = new Set(['node_modules', 'scripts', 'tests', 'dist', 'test-results', 'playwright-report']);
const sink = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)(?![\p{L}\p{N}_$])|\bdocument\s*(?:\.\s*write(?:ln)?\b|\[\s*['"]write(?:ln)?['"]\s*\])/gu;

export function findHtmlSinks(source, file) {
  return [...source.matchAll(sink)].map(match => ({
    file,
    line: source.slice(0, match.index).split('\n').length,
    sink: match[0].replace(/\s+/g, ''),
  }));
}

export async function checkHtmlSinks(root) {
  const findings = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && /\.(?:[cm]?js|html|svg)$/i.test(entry.name)) {
        findings.push(...findHtmlSinks(await readFile(file, 'utf8'), path.relative(root, file).replaceAll('\\', '/')));
      }
    }
  }
  await visit(root);
  if (findings.length) {
    // Only locations and sink names are printed, never source lines or credentials.
    throw new Error(findings.map(item => `${item.file}:${item.line}: forbidden ${item.sink}`).join('\n'));
  }
}
