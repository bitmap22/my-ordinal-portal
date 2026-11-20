// Checks the Ord Portal Agent Skill: the copy the website serves (.well-known/agent-skills/)
// is the same bytes as the one in the MCP tool, and the discovery index's digest and words match it.
// Run from the repo's root: node agent-blockhall-mcp/test/skill.js [--write]
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', '..');
const src = path.join(root, 'agent-blockhall-mcp', 'skills', 'ord-portal', 'SKILL.md');
const web = path.join(root, '.well-known', 'agent-skills', 'ord-portal', 'SKILL.md');
const idx = path.join(root, '.well-known', 'agent-skills', 'index.json');
const bytes = fs.readFileSync(src), text = bytes.toString('utf8');
const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
if (!fm) throw new Error('SKILL.md has no frontmatter');
const field = k => { const m = new RegExp('^' + k + ': (.*)$', 'm').exec(fm[1]); return m ? m[1].trim() : null; };
const name = field('name'), description = field('description');
const digest = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const want = {$schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: [{name, type: 'skill-md', description, url: '/.well-known/agent-skills/ord-portal/SKILL.md', digest}]};
if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(web), {recursive: true});
  fs.writeFileSync(web, bytes);
  fs.writeFileSync(idx, JSON.stringify(want, null, 2) + '\n');
}
const bad = [];
if (name !== 'ord-portal') bad.push('name is ' + name);
if (!description || description.length > 1024) bad.push('description missing or over 1024 characters');
if (!fs.existsSync(web) || !fs.readFileSync(web).equals(bytes)) bad.push('the website copy differs from the MCP tool copy');
const got = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '';
if (got !== JSON.stringify(want, null, 2) + '\n') bad.push('index.json does not match the skill (run with --write)');
if (bad.length) { console.error('Skill check failed: ' + bad.join('; ')); process.exit(1); }
console.log('Skill check passed: ord-portal, ' + bytes.length + ' bytes, ' + digest);
module.exports = {digest, name, description, bytes};
