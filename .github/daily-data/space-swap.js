/* Agent Blockhall's Blockspace Share: swaps a full recount into place, by bitmap22. Always free.
   Every day in <data>/<from>/days is copied over <data>/space/days (a day only in space stays), the index is made again, and
   the recount's folder is removed. Run by GitHub at the end of a recount (the Blockspace Share fill-in workflow).
   Usage: node space-swap.js <data folder> <recount folder>
   © 2026 bitmap22. All rights reserved. */
'use strict';
const fs = require('fs'), path = require('path');
const SP = require(path.join(__dirname, '..', '..', 'agent-blockhall-mcp', 'server', 'space.js'));
const [data, from] = process.argv.slice(2);
if (!data || !from || from === 'space') { console.log('Usage: node space-swap.js <data folder> <recount folder>'); process.exit(1); }
const src = path.join(data, from, 'days'), dst = path.join(data, 'space', 'days');
const files = fs.existsSync(src) ? fs.readdirSync(src).filter(n => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort() : [];
if (!files.length) { console.log('Nothing to swap in: ' + src + ' has no days.'); process.exit(0); }
fs.mkdirSync(dst, {recursive: true});
for (const n of files) fs.copyFileSync(path.join(src, n), path.join(dst, n));
// the index, made again from every day in space (writeDay does that when it saves the last day once more)
const last = JSON.parse(fs.readFileSync(path.join(dst, files[files.length - 1]), 'utf8')); delete last.data; delete last.licence;
delete process.env.SPACE_DIR; SP.writeDay(data, last);
fs.rmSync(path.join(data, from), {recursive: true, force: true});
console.log('Swapped in ' + files.length + ' days (' + files[0].slice(0, 10) + ' to ' + files[files.length - 1].slice(0, 10) + ') from ' + from + '.');
