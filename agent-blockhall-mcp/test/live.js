// Uses the Agent Blockhall MCP tool the way an agent does: starts it, says hello over MCP, lists its tools, and calls each
// one on live Bitcoin data. Writes everything it got back to test/results.json. Run: node test/live.js
'use strict';
const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {stdio: ['pipe', 'pipe', 'inherit']});
let buf = '', next = 1;
const waiting = new Map();
server.stdout.setEncoding('utf8');
server.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); const w = waiting.get(m.id); if (w) { waiting.delete(m.id); w(m); } }
});
const ask = (method, params) => new Promise(res => { const id = next++; waiting.set(id, res); server.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); });
const call = async (name, args) => { const t0 = Date.now(); const m = await ask('tools/call', {name, arguments: args}); return {name, args, ms: Date.now() - t0, isError: !!(m.result && m.result.isError), error: m.error || null, out: m.result && (m.result.structuredContent || m.result.content[0].text)}; };

(async () => {
  const results = {when: new Date().toISOString(), node: process.version};
  const init = await ask('initialize', {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'live-test', version: '1'}});
  results.initialize = init.result;
  server.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  results.tools = (await ask('tools/list')).result.tools.map(t => t.name);
  const calls = [];
  calls.push(await call('about', {}));
  calls.push(await call('chain', {}));
  calls.push(await call('feeAdvice', {}));
  calls.push(await call('block', {height: 840000, limit: 5}));
  calls.push(await call('inscription', {id: '#0'}));
  calls.push(await call('inscription', {id: '#1000'}));
  calls.push(await call('children', {id: '#0'}));
  calls.push(await call('followBack', {id: '#1000'}));
  calls.push(await call('search', {query: '840000'}));
  calls.push(await call('search', {query: '#1000'}));
  calls.push(await call('search', {query: '12.840000.bitmap'}));
  const firstTx = calls.find(c => c.name === 'followBack' && c.out && c.out.steps);
  if (firstTx) calls.push(await call('search', {query: firstTx.out.steps[0].txid}));
  const holder = calls.find(c => c.name === 'inscription' && c.args.id === '#1000' && c.out && c.out.owner);
  if (holder) calls.push(await call('search', {query: holder.out.owner}));
  calls.push(await call('search', {query: 'satoshi.sats'}));
  calls.push(await call('rareSats', {}));
  // the Block Manifest: the halving block's rune etchings, the next page of the same block (no new reading), inscription 0's
  // block, a kind that is not there, a kind it does not know, and the newest block
  calls.push(await call('blockManifest', {height: 840000, kind: 'runes etched', limit: 5}));
  calls.push(await call('blockManifest', {height: 840000, from: 5, limit: 3}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'inscriptions'}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'runes etched'}));
  calls.push(await call('blockManifest', {height: 767430, kind: 'shoes'}));
  calls.push(await call('blockManifest', {height: 99999999}));
  const tip = calls.find(c => c.name === 'chain' && c.out && c.out.newestBlock);
  if (tip) calls.push(await call('blockManifest', {height: tip.out.newestBlock - 1, limit: 5}));
  // the Provenance Check: inscription 0, #1000, a child in a batch, a delegate, one stored packed, and one that does not exist
  for (const id of ['#0', '#1000', 'cdf08dc642ac8b8cc905417cc7b5cc4d4c2d77eb97941f0472e1ffae30ba012ei1', '2bb85f4b004be6da54f766c17c1e855187327112c231ef2ff35ebad0ea67c69ei0', 'd7f15bda17b289b59873857d03a00bd3ca90bfa3ac9bcf27cd2030cf3f1b6519i0', '#999999999'])
    calls.push(await call('provenanceCheck', {id}));
  results.provenance = calls.filter(c => c.name === 'provenanceCheck').map(c => c.args.id + ' (' + c.ms + ' ms): ' + (c.out && c.out.verdict ? c.out.verdict + ' | ' + Object.entries(c.out.checked).map(([k, v]) => k + '=' + v.agrees + (v.against ? '@' + v.against.replace('https://', '') : '')).join(' ') + ' | trail ' + c.out.trail.length : 'ERROR ' + c.out));
  // Watch: the next block from two blocks back, a fee level far above today's, an address, a kind, and a bad kind
  const tipNow = calls.find(c => c.name === 'chain' && c.out && c.out.newestBlock);
  const wb = await call('watch', {what: 'block'}); calls.push(wb);
  if (wb.out && wb.out.since) { const o = JSON.parse(Buffer.from(wb.out.since, 'base64').toString()); o.s.hash = null; o.s.tip -= 2; const t = Buffer.from(JSON.stringify(o)).toString('base64'); calls.push(await call('watch', {since: t})); }
  const wf = await call('watch', {what: 'fee', value: '500'}); calls.push(wf);
  if (wf.out && wf.out.since) { const o = JSON.parse(Buffer.from(wf.out.since, 'base64').toString()); o.s.under = false; calls.push(await call('watch', {since: Buffer.from(JSON.stringify(o)).toString('base64')})); }
  calls.push(await call('watch', {what: 'inscription', value: '#0'}));
  const wk = await call('watch', {what: 'kind', value: 'inscriptions'}); calls.push(wk);
  if (wk.out && wk.out.since) { const o = JSON.parse(Buffer.from(wk.out.since, 'base64').toString()); o.s.hash = null; o.s.tip -= 1; calls.push(await call('watch', {since: Buffer.from(JSON.stringify(o)).toString('base64')})); }
  calls.push(await call('watch', {what: 'kind', value: 'shoes'}));
  calls.push(await call('watch', {what: 'block', wait: 30}));
  results.watch = calls.filter(c => c.name === 'watch').map(c => JSON.stringify(c.args).slice(0, 60) + ' (' + c.ms + ' ms): ' + (c.out && c.out.watching ? c.out.watching + ' | ' + c.out.now + ' | looked ' + c.out.looked + ' | ' + c.out.events.map(e => e.title + (e.checked ? ' ' + JSON.stringify(Object.fromEntries(Object.entries(e.checked).map(([k, v]) => [k, v && v.agrees]))) : '')).join(' / ') : 'ERROR ' + c.out));
  // Daily Data: the list of days, one day, one block, and a day with no file
  for (const a of [{}, {day: '2026-11-13'}, {block: 975657}, {day: '2001-01-01'}]) calls.push(await call('dailyData', a));
  results.daily = calls.filter(c => c.name === 'dailyData').map(c => JSON.stringify(c.args) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + c.out : c.out.days ? c.out.days.length + ' days' : c.out.totals ? c.out.day + ': ' + c.out.totals.blocks + ' blocks, ' + c.out.blocks.length + ' listed' : c.out.height ? 'block ' + c.out.height + ', ' + c.out.transactions + ' txs' : JSON.stringify(c.out).slice(0, 100)));
  // Collection Check: a small, a middling and a big collection (the big one carried on over calls), a list of pieces without a parent, and mistakes
  const BIG = '219d87f0d44ab4a1bf79f87ee11ee5ce90ea9e4efaa263052b2fa309e119ff3fi0';
  for (const a of [{parent: '#126744012'}, {parent: 'd7dc12d0df773e1cbf9605ae8b1e09f38f7cde5f9fb797651fb698aa7964e794i0', limit: 3}, {parent: BIG, limit: 2}, {parent: BIG, limit: 2}, {parent: BIG, filter: 'notProven', limit: 2},
    {ids: '7f4d1f0087ad8d6a4fc6311f20588ab53e8694d2660268863bccc483fff12afdi0,27dac2dbc7e20bdbd4d36b5ef720773c5d64379ca5224e1228f05e135b49fb75i0,7a093647258f5bc65cba949df517cf67084f9350bcb1ae40d9636b4f241acb40i0,a6369134c840ccf4c4b65074bd3e50cea1b3ef2532ec3cd43307bf3e80194908i0'},
    {parent: '#0'}, {}]) calls.push(await call('collectionCheck', a));
  results.collection = calls.filter(c => c.name === 'collectionCheck').map(c => JSON.stringify(c.args).slice(0, 50) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + c.out : c.out.verdict + ' | ' + JSON.stringify(c.out.counts) + (c.out.trail ? ' | trail ' + JSON.stringify(c.out.trail) + ' | lists ' + JSON.stringify(c.out.lists) + ' | first ' + JSON.stringify((c.out.children || [])[0] || null) : ' | ' + JSON.stringify((c.out.pieces || []).map(p => [p.id.slice(0, 8), p.namesParents, p.ordParents, p.result]))) + (c.out.carryOn ? ' | ' + c.out.carryOn : '')));
  // Recursion Map: a recursive game, a viewer that builds its paths, an image that loads nothing, and a number with no inscription
  for (const a of [{id: '#127512326'}, {id: 'aa971d5dd1d6429076ad16aef35409f8363937e53786af37803c40923f9a4c2ei0'}, {id: '#0', depth: 1}, {id: '#999999999'}]) calls.push(await call('recursionMap', a));
  results.recursion = calls.filter(c => c.name === 'recursionMap').map(c => JSON.stringify(c.args).slice(0, 50) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + c.out : c.out.verdict + ' | allOnChain ' + c.out.allOnChain + ' | ' + JSON.stringify(c.out.counts) + ' | endpoints ' + c.out.endpoints.map(e => e.endpoint + ' ' + e.status).join(', ') + ' | nodes ' + c.out.nodes.map(n => n.number + ':' + n.usedBy.map(u => u.how).join('/') + ':' + JSON.stringify(n.checks)).slice(0, 8).join(' ') + ' | sources ' + JSON.stringify(c.out.sources)));
  // Second Opinion: true, false and rounded claims of each kind, a structured one, and one it can't read
  for (const a of [{claim: 'block 840000 has 3,050 transactions'}, {claim: 'block 840000 was mined by ViaBTC'}, {claim: 'block 840000 paid about 37.6 BTC in fees'}, {claim: 'block 767430 has 1 inscription'},
    {claim: 'block 840000\'s hash is 0000000000000000000320283a032748cef8227873ff4872689bf23f1cda83a5'}, {claim: '#1000 is a PNG'}, {claim: '#1000 was made in block 1'}, {claim: '#126750483 is a child of #126744012'},
    {claim: 'collection #126744012 has 2 children'}, {kind: 'ins.size', subject: '#1000', value: '793'}, {claim: 'the moon is cheese'},
    {claim: 'DOG•GO•TO•THE•MOON was etched in block 840,000'}, {claim: 'DOG•GO•TO•THE•MOON was etched in block 840,001'}, {claim: 'DOG•GO•TO•THE•MOON has 5 decimal places'}, {claim: 'UNCOMMON•GOODS is turbo'},
    {claim: 'UNCOMMON•GOODS\'s symbol is ⧉'}, {claim: 'DOG•GO•TO•THE•MOON\'s supply is 100,000,000,000'}, {claim: 'NOT•A•RUNE•AT•ALL•HERE was etched in block 840,000'}]) calls.push(await call('secondOpinion', a));
  results.opinion = calls.filter(c => c.name === 'secondOpinion').map(c => JSON.stringify(c.args).slice(0, 60) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 120) : c.out.answer + ' | ' + c.out.verdict + ' | ' + c.out.sources.map(s => s.source.replace('https://', '').slice(0, 40) + '=' + String(s.says).slice(0, 24) + ':' + s.agrees).join(', ')));
  // Source Health: every site now and the record, one chain, one site's hourly record (the record only), and a site it doesn't know
  for (const a of [{}, {chain: 'doge'}, {site: 'ordinals.com', now: false}, {site: 'nowhere.example'}]) calls.push(await call('sourceHealth', a));
  for (const a of [{}, {chain: 'doge', days: 30}, {site: 'ordinals.com'}, {site: 'nowhere.example'}]) calls.push(await call('truthLeague', a));
  results.league = calls.filter(c => c.name === 'truthLeague').map(c => JSON.stringify(c.args) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 120) : c.out.record && c.out.record.checks != null ? c.out.record.checks + ' checks; ' + (c.out.findings || []).slice(0, 2).map(f => f.says).join(' | ').slice(0, 200) : JSON.stringify(c.out.record).slice(0, 160)));
  results.health = calls.filter(c => c.name === 'sourceHealth').map(c => JSON.stringify(c.args) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 120) : (c.out.now ? JSON.stringify(c.out.now.counts) + ' newest ' + JSON.stringify(c.out.now.newest) + ' | ' + c.out.now.results.map(r => r.site + '=' + r.state + (r.behind >= 2 ? '(' + r.behind + ' behind)' : '') + ':' + r.ms).join(', ') : 'record only') +
    ' | record: ' + (c.out.record.error || c.out.record.checks + ' checks' + (c.out.record.hourly ? ', hourly ' + c.out.record.hourly.length : '')) + ' | findings: ' + c.out.findings.map(f => f.says).join(' / ')));
  results.manifestChecks = calls.filter(c => c.name === 'blockManifest' && c.out && c.out.checked).map(c => {
    const k = c.out.checked;
    return c.out.block.height + ' (' + c.ms + ' ms): hash ' + k.blockHash.fromItsOwnBytes + '/' + (k.blockHash.secondSite && k.blockHash.secondSite.agrees) + ', ids ' + k.transactions.matched + '/' + k.transactions.of +
      ', sizes ' + k.sizes.matched + '/' + k.sizes.of + ', kinds ' + (k.kinds ? k.kinds.agreed + '/' + k.kinds.of : '-') + ', inscriptions ' + (k.inscriptions ? k.inscriptions.agreed + '/' + k.inscriptions.of : '-') +
      (k.runesEtched ? ', etched ' + k.runesEtched.made + '/' + k.runesEtched.tried : '') + ', differences ' + k.differences.length + ', items ' + c.out.items.kind + ' ' + c.out.items.list.length + '/' + c.out.items.total + ', sources ' + JSON.stringify(c.out.sources);
  });
  // Doge Cube's tools, for Dogecoin: a block with the first Doginals, its next page (no new reading), the newest block, a kind
  // it does not know, a block not made yet; Doginal #0, #1,000 and one that does not exist; the watches, and a fee watch (there is none)
  const dstart = calls.length;
  calls.push(await call('dogeBlockManifest', {height: 4609723, kind: 'inscriptions', limit: 5}));
  calls.push(await call('dogeBlockManifest', {height: 4609723, from: 5, limit: 3}));
  calls.push(await call('dogeBlockManifest', {height: 'newest', limit: 5}));
  calls.push(await call('dogeBlockManifest', {height: 4609723, kind: 'shoes'}));
  calls.push(await call('dogeBlockManifest', {height: 99999999}));
  calls.push(await call('dogeBlockManifest', {height: 0}));   // (Dogecoin's first block: Blockchair has no bytes for its coinbase, BlockCypher has)
  for (const id of ['#0', '#1000', '#999999999']) calls.push(await call('dogeProvenanceCheck', {id}));
  const db = await call('dogeWatch', {what: 'block'}); calls.push(db);
  if (db.out && db.out.since) { const o = JSON.parse(Buffer.from(db.out.since, 'base64').toString()); o.s.hash = null; o.s.tip -= 2; calls.push(await call('dogeWatch', {since: Buffer.from(JSON.stringify(o)).toString('base64')})); }
  calls.push(await call('dogeWatch', {what: 'inscription', value: '#0'}));
  const dk = await call('dogeWatch', {what: 'kind', value: 'inscriptions'}); calls.push(dk);
  if (dk.out && dk.out.since) { const o = JSON.parse(Buffer.from(dk.out.since, 'base64').toString()); o.s.hash = null; o.s.tip -= 1; calls.push(await call('dogeWatch', {since: Buffer.from(JSON.stringify(o)).toString('base64')})); }
  calls.push(await call('dogeWatch', {what: 'fee', value: '1'}));
  for (const a of [{}, {day: '2026-11-13'}, {block: 6455172}, {day: '2001-01-01'}]) calls.push(await call('dogeDailyData', a));
  results.doge = calls.slice(dstart).map(c => c.name + ' ' + JSON.stringify(c.args).slice(0, 70) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + c.out : !c.out ? 'no answer' :
    c.out.manifest ? 'block ' + c.out.block.height + ': hash ' + c.out.checked.blockHash.fromItsOwnHeader + '/' + (c.out.checked.blockHash.secondSite && c.out.checked.blockHash.secondSite.agrees) + ', list proved ' + c.out.checked.transactionList.provedByMerkleRoot +
      ', second list ' + c.out.checked.secondList.matched + '/' + c.out.checked.secondList.of + ', own bytes ' + c.out.checked.ownBytes.read + '/' + c.out.checked.ownBytes.of + ', items ' + c.out.items.kind + ' ' + c.out.items.list.length + '/' + c.out.items.total + ', counts ' + JSON.stringify(c.out.counts) :
    c.out.check ? c.out.inscription.id + ': ' + c.out.verdict :
    c.out.watching ? c.out.watching + ' | ' + c.out.now + ' | looked ' + c.out.looked + ' | ' + c.out.events.map(e => e.title).join(' / ') :
    c.out.totals ? c.out.day + ': ' + c.out.totals.blocks + ' blocks, ' + c.out.totals.transactions + ' transactions | ' + (c.out.notes || []).join(' ') :
    c.out.days ? c.out.days.length + ' days' : JSON.stringify(c.out).slice(0, 200)));
  // the Media Reader, through both Provenance Checks: what is in the file
  results.media = calls.filter(c => /^(doge)?[pP]rovenanceCheck$/.test(c.name) && c.out && c.out.whatIsInIt).map(c => c.name + ' ' + c.args.id + ': ' + (c.out.whatIsInIt.says || c.out.whatIsInIt.none || c.out.whatIsInIt.error) + ' | read from ' + c.out.whatIsInIt.readFrom);
  results.calls = calls;
  results.summary = calls.map(c => c.name + ' ' + JSON.stringify(c.args) + ': ' + (c.error ? 'PROTOCOL ERROR ' + c.error.message : c.isError ? 'ERROR ' + c.out : 'ok') + ' (' + c.ms + ' ms)');
  const g0 = calls.find(c => c.name === 'dogeBlockManifest' && c.args.height === 0);
  results.dogeFirstBlock = g0 && g0.out && g0.out.checked ? JSON.stringify({hash: g0.out.block && g0.out.block.hash, ownBytes: g0.out.checked.ownBytes, bytesFrom: g0.out.sources && g0.out.sources.bytes}) : 'ERROR ' + (g0 && String(g0.out).slice(0, 200));
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 1));
  // Stuck Transaction Doctor: one waiting now, one mined (#1000's reveal), one not found, one not an ID
  for (const a of [{}, {txid: 'cbd62b57bc1b3ae8f6e0cfc402fbdbeb5ae4172f9200671f5f689f1af6d3332b'}, {txid: '0'.repeat(63) + '1'}, {txid: 'hello'}]) calls.push(await call('stuckTx', a));
  results.stuck = calls.filter(c => c.name === 'stuckTx').map(c => JSON.stringify(c.args).slice(0, 40) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 100) : c.out.state + ' | ' + c.out.verdict + (c.out.fees ? ' | aims ' + c.out.fees.aims.map(a => a.name + ' ' + a.feeRate).join(', ') : '') + (c.out.fixes ? ' | replace ' + c.out.fixes.replace.options.map(o => o.newFee).join('/') + ' | children ' + c.out.fixes.child.options.length : '')));
  // Code Read: a game, a globe that names outside sites, a picture, one that isn't there
  for (const a of [{id: '#127512326'}, {id: '#126744012'}, {id: '#0'}, {id: '#999999999'}]) calls.push(await call('codeRead', a));
  results.code = calls.filter(c => c.name === 'codeRead').map(c => JSON.stringify(c.args) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 100) : c.out.verdict.slice(0, 220) + ' | found ' + (c.out.kinds || []).filter(k => k.found).map(k => k.key + ' ' + k.count).join(', ') + ' | files ' + (c.out.files || []).length));
  // Rune Proof: a premined rune, one open to mint, UNCOMMON•GOODS, a try that made no rune, a mint, a name not etched yet, an ID that isn't there, not a name
  for (const a of [{rune: 'DOG•GO•TO•THE•MOON'}, {rune: 'satoshi.nakamoto'}, {rune: 'UNCOMMON•GOODS'}, {rune: 'c74d618c4b5035a3c5dba96618ca7184f989912c72cd18d0a2f445c15bb7d2c2'}, {rune: '1b12b6246a56aa6d95c715a95f596f8b274ee253d89f53f287534a1d6fb1f56a'}, {rune: 'DOGGY'}, {rune: '99999999:1'}, {rune: 'newest'}, {rune: 'not a name!'}]) calls.push(await call('runeProof', a));
  results.rune = calls.filter(c => c.name === 'runeProof').map(c => JSON.stringify(c.args).slice(0, 50) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 120) : c.out.answer + ' | ' + c.out.verdict.slice(0, 230) + (c.out.compare ? ' | same ' + c.out.compare.filter(x => x.same).length + '/' + c.out.compare.length : '') + (c.out.rules ? ' | rules kept ' + c.out.rules.filter(x => x.ok === true).length + '/' + c.out.rules.length : '')));
  // Doge Collection Check: a collection by name (first 6 pieces), by short name further on, a list of pieces, and one that isn't there
  for (const a of [{collection: 'Doginal Frogs', limit: 6}, {collection: 'doginal-dogs', from: 0, limit: 8}, {ids: ['#61345204', '91e0019e10a4a711f4af99820231be8f084b724bee8a0ba63a66a4b5331fd392i0']}, {collection: 'no such collection here'}]) calls.push(await call('dogeCollectionCheck', a));
  results.dogecollection = calls.filter(c => c.name === 'dogeCollectionCheck').map(c => JSON.stringify(c.args).slice(0, 60) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 160) : c.out.verdict.slice(0, 200) + ' | ' + JSON.stringify(c.out.counts).slice(0, 200) + ' | ' + (c.out.pieces || []).filter(p => p.ok !== true).map(p => p.why).slice(0, 3).join(' / ')));
  // Citable checks: take the cite link from checks above and check them again; then one with a doctored fact (the holder), and one that is not a link
  const cites = calls.filter(c => !c.isError && c.out && c.out.cite && c.out.cite.link).map(c => c.out.cite.link);
  const pick = [...new Set([cites.find(l => /block-manifest/.test(l)), cites.find(l => /provenance-check/.test(l)), cites.find(l => /collection-check/.test(l)), cites.find(l => /recursion-map/.test(l)), cites.find(l => /second-opinion/.test(l)), cites.find(l => /\/daily\.html/.test(l)), cites.find(l => /doge-block-manifest/.test(l)), cites.find(l => /doge-provenance-check/.test(l)), cites.find(l => /doge-daily/.test(l)), cites.find(l => /stuck-transaction/.test(l)), cites.find(l => /code-read/.test(l)), cites.find(l => /rune-proof/.test(l)), cites.find(l => /doge-collection-check/.test(l))].filter(Boolean))];
  const prov = cites.find(l => /provenance-check/.test(l));
  if (prov) { const u = new URL(prov), f = JSON.parse(Buffer.from(u.searchParams.get('f').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); f.holder = 'bc1qpretendthiswastheholderthen'; f.moves = (f.moves || 0) - 1; u.searchParams.set('f', Buffer.from(JSON.stringify(f)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); pick.push(u.toString()); }
  for (const link of pick.concat(['https://bitmap22.github.io/my-ordinal-portal/provenance-check.html?id=%230'])) calls.push(await call('checkAgain', {link}));
  results.cite = calls.filter(c => c.name === 'checkAgain').map(c => String(c.args.link).replace('https://bitmap22.github.io/my-ordinal-portal/', '').slice(0, 70) + ' (' + c.ms + ' ms): ' + (c.isError ? 'ERROR ' + String(c.out).slice(0, 100) : c.out.answer + ' | ' + c.out.words));
  console.log(results.summary.join('\n'));
  if (results.manifestChecks.length) console.log('Block Manifest checks:\n' + results.manifestChecks.join('\n'));
  console.log('Provenance checks:\n' + results.provenance.join('\n'));
  console.log('Watch:\n' + results.watch.join('\n'));
  console.log('Daily Data:\n' + results.daily.join('\n'));
  console.log('Doge Cube (Dogecoin):\n' + results.doge.join('\n'));
  console.log('Doge first block: ' + results.dogeFirstBlock);
  console.log('What is in the file (Media Reader):\n' + results.media.join('\n'));
  console.log('Collection Check:\n' + results.collection.join('\n'));
  console.log('Recursion Map:\n' + results.recursion.join('\n'));
  console.log('Second Opinion:\n' + results.opinion.join('\n'));
  console.log('Source Health:\n' + results.health.join('\n'));
  console.log('Stuck Transaction Doctor:\n' + results.stuck.join('\n'));
  console.log('Code Read:\n' + results.code.join('\n'));
  console.log('Rune Proof:\n' + results.rune.join('\n'));
  console.log('Doge Collection Check:\n' + results.dogecollection.join('\n'));
  console.log('Citable checks:\n' + results.cite.join('\n'));
  server.kill();
  process.exit(0);
})().catch(e => { console.error(e); server.kill(); process.exit(1); });
