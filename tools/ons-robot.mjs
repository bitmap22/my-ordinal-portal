// The 0NS name list for the Block Cube, kept by a robot: .github/workflows/ons-list.yml runs this once an hour.
// The engine is ons-core.mjs; this file only gives it the files (in the folder named on the command line) and the internet.
// usage: node tools/ons-robot.mjs <list folder>
import fs from 'node:fs';
import path from 'node:path';
import {onsUpdate} from './ons-core.mjs';

const OUT = process.argv[2] || 'ons-out';
const UA = 'block-cube-0ns-list (github.com/bitmap22/my-ordinal-portal)';
const file = p => path.join(OUT, p);
const io = {
  fetch: url => fetch(url, {headers: {'user-agent': UA}, signal: AbortSignal.timeout(20000)}),
  nap: ms => new Promise(r => setTimeout(r, ms)),
  read: (p, d) => { try { return JSON.parse(fs.readFileSync(file(p), 'utf8')); } catch (e) { return d; } },
  write: (p, v) => { fs.mkdirSync(path.dirname(file(p)), {recursive: true}); fs.writeFileSync(file(p), JSON.stringify(v)); },
  writeText: (p, s) => { fs.mkdirSync(path.dirname(file(p)), {recursive: true}); fs.writeFileSync(file(p), s); },
  remove: p => { try { fs.unlinkSync(file(p)); } catch (e) {} },
  shardNames: () => { try { return fs.readdirSync(file('n')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)); } catch (e) { return []; } },
};

onsUpdate(io).then(
  r => console.log(`0NS list: up to block ${r.tip}, ${r.count} names, ${r.added} new or changed, ${r.waiting} still waiting, ${r.asked} questions asked`),
  e => { console.error('0NS list: stopped, nothing saved this time:', e && e.message || e); process.exit(1); });
