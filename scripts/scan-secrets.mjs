import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const executable = process.argv[2] || 'gitleaks';
const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8', windowsHide: true });
if (shallow.status !== 0 || shallow.stdout.trim() !== 'false') {
  console.error('Full-history scan requires a complete Git checkout. Fetch all branch histories first.');
  process.exit(2);
}
await mkdir('.local', { recursive: true });
const reportPath = path.resolve('.local/gitleaks-redacted.json');
// Offline detection only: never verify credentials against their providers.
const result = spawnSync(executable, [
  'git', '.', '--config', '.gitleaks.toml', '--log-opts=--all --full-history', '--redact=100',
  '--no-banner', '--log-level=error', '--ignore-gitleaks-allow',
  '--report-format=json', `--report-path=${reportPath}`,
], { encoding: 'utf8', windowsHide: true });
if (result.error || ![0, 1].includes(result.status)) {
  console.error('Secret scan could not complete. Install gitleaks 8.30.1; see README.md.');
  process.exit(2);
}
const findings = JSON.parse(await readFile(reportPath, 'utf8')).map(item => ({
  commit: item.Commit, file: item.File, line: item.StartLine, rule: item.RuleID,
}));
await writeFile('.local/secret-scan-locations.json', JSON.stringify(findings, null, 2) + '\n');
for (const finding of findings) console.log(`${finding.file}:${finding.line} commit=${finding.commit} rule=${finding.rule}`);
console.log(`Full-history secret scan: ${findings.length} findings (values redacted).`);
process.exit(result.status);
