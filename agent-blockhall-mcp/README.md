# Agent Blockhall MCP tool

<!-- mcp-name: io.github.bitmap22/agent-blockhall -->

Agent Blockhall's free Bitcoin catalogue, for AI agents. **Always free.** No keys, no accounts.

[Agent Blockhall](https://bitmap22.github.io/my-ordinal-portal/block-cube.html) is a 3D Bitcoin block explorer world for players and agents. This tool gives an AI agent the same catalogue without opening a browser. It runs on your own computer and reads free public sites (mempool.space and its copies, ordpool.space, ordinals.com and its back-ups), gently: at most 30 asks at once, then 6 a second per site, and it rests any site that asks it to slow down and uses a back-up instead.

## What it can do

| Tool | What it gives |
| --- | --- |
| `about` | What Agent Blockhall is, where to open it, and how agents use it in a browser |
| `chain` | The newest block, the last blocks mined, the blocks waiting to be mined, the next halving |
| `feeAdvice` | The big screen's advice from Agent Blockhall's common room: the usual wait, whether now is a cheap time, and the fee to make the next block (plus patient and cheap fees). It keeps score of itself: it says how often its way of working the fee out would have been right on blocks it was not tuned on |
| `block` | A block (its number is its bitmap): hash, time, size, transactions and every inscription made in it |
| `blockManifest` | The Block Manifest: every transaction in a block, sorted into the same kinds as the game's hall shelves (inscriptions and their file types, bitmaps, BRC-20, TAP, runes etched, minted and moved, Alkanes, Stamps, SRC-20, CAT-21, Atomicals, payments and more), with its fee, size and what it carries. Counts for every kind, then the items a page at a time, or only one kind |
| `inscription` | An inscription by number (`#1000`) or ID: what it is, when and where it was made, its sat, who holds it, its parents and children |
| `provenanceCheck` | The Provenance Check: proof of where an inscription came from. It is read out of its own transaction's bytes (file type, size, parents, delegate) and matched with ordinals.com, its content's fingerprint (SHA-256) is matched with the file shown, its block, number and sat are checked with second sites, and every move is followed back to where it was made, each step spending the one before |
| `collectionCheck` | The Collection Check: proof of which pieces of a collection are its parent's real children. For each child ord lists: is it on two ord sites' lists, does its own transaction name the parent, and was the parent spent to make it (the parent's trail is followed back, each move worked out to its own ID). A big collection carries on over several calls. Or give `ids` (a collection without a parent): does each piece name a parent at all |
| `recursionMap` | The Recursion Map: everything an inscription loads from the chain, a few levels deep. Its code is read (never run) for the inscriptions it uses (`loads`, `named`, `child`, `delegate`), then those are read the same way; each is checked on ordinals.com and a second ord site. It lists the /r/ endpoints the code asks (each asked of ordinals.com today) and addresses outside the chain, and says whether everything it names is on the chain (`allOnChain`) |
| `secondOpinion` | The Second Opinion: a claim about Bitcoin, in plain words ("block 840000 has 3,050 transactions", "#1000 is a PNG", "#126750483 is a child of #126744012") or as `kind`, `subject` and `value`, checked against ord sites, mempool sites and the chain's own bytes. Claims about a rune too ("DOG•GO•TO•THE•MOON was etched in block 840,000"): its etching's own bytes and ordinals.com, the only free rune site; counts like its mints and supply come from ordinals.com alone, and the answer says so. The answer (`true`, `false`, `mixed` or `unknown`), and what each source says and how it knows |
| `children` | The children of a parent inscription (a collection), a page at a time |
| `followBack` | An inscription's trail: where it was made and each place it moved |
| `search` | A block, bitmap, parcel (`12.840000.bitmap`), inscription, transaction ID or address, as the tablet in the game finds them |
| `watch` | Watch: says when something happens on the chain, each alert checked: the next block, the next-block fee at or under a level, an inscription moving (as soon as the move is in the mempool, and again once it is in a block), an address sending or getting a transaction, or a kind of transaction in a new block. The first call gives a `since` token; call again with it to hear what changed, and add `wait` (up to 240 seconds) to keep looking until something happens |
| `dailyData` | Daily Data, made each night by GitHub: every block of a UTC day, read the Block Manifest way, with what was in it, its fees, who mined it and its checks. No day: the list of days; a day: every block; a block: that one |
| `sourceHealth` | Source Health: which data sites these tools read are answering, how fast, and whether they are up to date, for Bitcoin and Dogecoin. Each site is asked one small thing now, from your computer (most: the newest block's height), and GitHub's computers ask the same about once an hour and keep a week: each site's last day and week. With what it means, in words |
| `safetyScan` | Safety Scan: what to watch out for in the last day of blocks. GitHub looks at and reads every inscription of the last 144 Bitcoin blocks and the last 1,440 Dogecoin blocks about every hour, without running any of it, and marks: `adult` (may show nudity), `flash` (flashes more than 3 times a second), `scam` (secret words or keys, free coins, wallet-login forms), `agent` (words or code that try to give AI agents orders, or hide instructions for them), `code` (wallet asks, outside loads, sending data out, tracking), `miner` (coin mining, or built to freeze or crash a device), `hate` and `personal` (phone numbers, addresses, emails; masked). No arguments: every block kept; `block`: one block's finds; `id`: one inscription; `text` (with `contentType`): reads what you give it, on your computer. Every mark is a "may be". |
| `truthLeague` | Truth League: which data sites these tools read tell the truth. Every few hours GitHub's computers prove one Bitcoin block (its hash from its header with at least 70 zero bits of proof of work, its transactions to the merkle root, its height in its first transaction) and one Dogecoin block from their own bytes, ask each site facts about them, and mark each answer right or wrong against the bytes, never against another site; 30 days are kept. Gives the league, every wrong answer with what the site said and what the bytes say, and findings. `chain`, `site`, `days` (7 or 30), `now: true` to check from this computer. Its check link works with `checkAgain`. |
| `authenticityCheck` | Authenticity Check (older name `tradeCheck`): is a Bitcoin inscription or a Doginal what it is said to be? GO, STOP or NOT SURE, with every reason in plain words. It runs `provenanceCheck` (its file, transaction and block from the chain's own bytes, and who holds it), checks the seller's address if given, the Second Opinion's parent check for its collection (named, or the parent it names), and for code `codeRead` and `recursionMap`; for a Doginal, `dogeProvenanceCheck`. GO is never advice on price or whether to buy. Give `id`, and if you like `seller`, `collection` and `chain`. |
| `stuckTx` | The Stuck Transaction Doctor: give a transaction ID (or none, for one waiting now). Its state (stuck, waiting, not stuck, mined, not found), why it waits, the fees aimed for (next block, about an hour, about three hours, keeping score of itself) and both fixes: replace it (the new fee under Bitcoin Core's replacement rules) or a child that pays for it (for each output). Nothing is sent or signed |
| `codeRead` | Code Read: an inscription's code (and the code it loads) read without running it. Whether it asks a wallet to connect, sign or send, loads things from outside the chain, could send data out, tracks you, hides what it does, or asks your browser for things; each finding with where it is and that piece of code (untrusted). It can't prove code is safe, only say what it found |
| `runeProof` | Rune Proof: give a rune (its name, ID, number) or a transaction. Its etching transaction's own bytes are read with ord's own rules and proved to be that transaction, in its block at the rune ID's place; the name's rules are checked (not reserved, unlocked, committed to six blocks before); then ordinals.com is checked against it, field by field. For a transaction that tried and failed, it says why. Mints, supply now and burned come from ordinals.com alone, checked to add up |
| `checkAgain` | Citable checks: every check gives `cite`, a link that carries when it was made, which sites it asked, its main facts and a fingerprint of its core (what comes from the chain itself). Give `checkAgain` such a link and it makes the same check again now and says whether it is the same, or what changed (each fact then and now). The same link opened in a browser does the same on the portal's page |
| `rareSats` | The rare sats board: each kind of rare sat and the price listed for one sat |

`provenanceCheck` and `dogeProvenanceCheck` also say what is in the file (`whatIsInIt`), read from the file's own bytes by the Media Reader (`server/media.js`): a picture's resolution, colours used, colour depth, palette and frames; a sound's length, samples a second and channels; a video's resolution, length and frames a second; a 3D model's points, triangles, real size, textures and animations. Every number is read or counted from the bytes, never guessed.

### For Dogecoin: Doge Cube's tools

[Doge Cube](https://bitmap22.github.io/my-ordinal-portal/doge-cube.html) is Agent Blockhall's Dogecoin twin. These five tools are the same tools for Dogecoin and its Doginals. They read the same files as the portal's Doge pages.

| Tool | What it gives |
| --- | --- |
| `dogeBlockManifest` | Every transaction in a Dogecoin block, sorted into Doge Cube's kinds (Doginals and their file types, dogemaps, names, DRC-20, TAP, dunes etched, minted and moved, and the kinds of payment), with its fee (koinu) and size. Checked: the block's hash worked out from its own header and asked of Bitcore, its transaction list proved by the merkle root in that header, sizes and fees matched on Bitcore, and the transactions that carry something read from their own bytes |
| `dogeProvenanceCheck` | Proof of where a Doginal came from: read from its own transactions' bytes (a Doginal can be written over many transactions, and each is followed), the file put back together and fingerprinted, matched with the explorer's copy and Doggy Market's copy, its block checked on Bitcore, and its trail of moves, each step checked on two sites |
| `dogeCollectionCheck` | Doge Collection Check: give a Dogecoin collection (or your own list of Doginals). Doginals have no parents, so which pieces belong can't be proven on the chain: the pieces are the ones thedoginalsexplorer.com lists. Each one is checked on separate sites: a real Doginal, its first transaction in a block on Bitcore, the same file on the explorer and Doggy Market, held where the explorer says (lost ones confirmed). Up to 100 pieces a call, in the collection's order |
| `dogeWatch` | Alerts when something happens on Dogecoin, each checked: the next block, a Doginal moving, an address getting or sending DOGE, or a kind in a new block. Same `since` tokens as `watch`. There is no fee watch for Dogecoin: its fees barely move |
| `dogeDailyData` | Doge Daily Data, made each night by GitHub: every Dogecoin block of a UTC day, with its hash checked from its own header and on Bitcore, its transaction list proved by its header, its size, fees, who mined it (where the coinbase names a pool) and its Doginals by file type |

They read thedoginalsexplorer.com (the one Doginals list), Bitcore, Blockchair (a transaction's own bytes) and Doggy Market's copy of each file, at the pace each site says it allows.

### Each tool's page on the portal

The same checks, for people, with the same readers: `blockManifest`: [Block Manifest](https://bitmap22.github.io/my-ordinal-portal/block-manifest.html), `provenanceCheck`: [Provenance Check](https://bitmap22.github.io/my-ordinal-portal/provenance-check.html), `collectionCheck`: [Collection Check](https://bitmap22.github.io/my-ordinal-portal/collection-check.html), `recursionMap`: [Recursion Map](https://bitmap22.github.io/my-ordinal-portal/recursion-map.html), `secondOpinion`: [Second Opinion](https://bitmap22.github.io/my-ordinal-portal/second-opinion.html), `safetyScan`: [Safety Scan](https://ordportal.com/safety-scan.html), `sourceHealth`: [Source Health](https://bitmap22.github.io/my-ordinal-portal/source-health.html), `truthLeague`: [Truth League](https://bitmap22.github.io/my-ordinal-portal/truth-league.html), `authenticityCheck`: [Authenticity Check](https://bitmap22.github.io/my-ordinal-portal/trade-check.html), `stuckTx`: [Stuck Transaction Doctor](https://bitmap22.github.io/my-ordinal-portal/stuck-transaction.html), `codeRead`: [Code Read](https://bitmap22.github.io/my-ordinal-portal/code-read.html), `runeProof`: [Rune Proof](https://bitmap22.github.io/my-ordinal-portal/rune-proof.html), `watch`: [Watch](https://bitmap22.github.io/my-ordinal-portal/watch.html), `dailyData`: [Daily Data](https://bitmap22.github.io/my-ordinal-portal/daily.html), `dogeBlockManifest`: [Doge Block Manifest](https://bitmap22.github.io/my-ordinal-portal/doge-block-manifest.html), `dogeProvenanceCheck`: [Doge Provenance Check](https://bitmap22.github.io/my-ordinal-portal/doge-provenance-check.html), `dogeCollectionCheck`: [Doge Collection Check](https://bitmap22.github.io/my-ordinal-portal/doge-collection-check.html), `dogeWatch`: [Doge Watch](https://bitmap22.github.io/my-ordinal-portal/doge-watch.html), `dogeDailyData`: [Doge Daily Data](https://bitmap22.github.io/my-ordinal-portal/doge-daily.html). `about` gives this list too (`pages`).

Trust: `feeAdvice` keeps score of itself, and every `chain`, `block` and `inscription` answer is checked against a second, separate site and says whether they agree (`checked.agrees`). `blockManifest` checks every item: each transaction's id and size are worked out from the block's own bytes and matched with a second site's list, its kinds are read twice (by this tool and by ordpool.space's tags), and its inscriptions are matched with ordinals.com's list. Its `sources` say which site gave each part. `provenanceCheck` gives a verdict and each check, with what it compared, against which site, and whether they agree. `collectionCheck` gives each child's three checks (`true`, `false`, or `null` when not reached yet) and why.

Two things stay in the game's tablet: which inscription claimed a bitmap, and names like `satoshi.sats`.

## Install

You need [Node.js](https://nodejs.org) 18 or newer.

**Claude Desktop and other apps that take MCP bundles:** download `agent-blockhall.mcpb` from the [latest release](https://github.com/bitmap22/my-ordinal-portal/releases?q=agent-blockhall-mcp) and open it.

**Any MCP client (Claude Code, Cursor, VS Code and others):** download `agent-blockhall.mcpb` from the [latest release](https://github.com/bitmap22/my-ordinal-portal/releases?q=agent-blockhall-mcp). It is a zip file: unzip it into a folder (if your computer won't, rename it to `agent-blockhall.zip` first). Keep the folder whole: `server/index.js` needs the other files in `server/`. Then add `server/index.js` to your client's MCP settings:

```json
{
  "mcpServers": {
    "agent-blockhall": {
      "command": "node",
      "args": ["/full/path/to/agent-blockhall/server/index.js"]
    }
  }
}
```

It is also listed in the official MCP Registry as `io.github.bitmap22/agent-blockhall`.

## In a browser

Agent Blockhall itself has a full agent kit: open the page and call `await window.agent.help()`, then `agent.see()`. Where the browser has WebMCP, the same commands are tools named `cube_*`. You play by the same rules as a player, people see you marked as an AI agent, and you can never wipe or delete anything. More for agents: [llms.txt](https://bitmap22.github.io/my-ordinal-portal/llms.txt).

## Privacy

The tool sends nothing to bitmap22. It only asks the public sites above for Bitcoin and Dogecoin data, from your computer.

## Terms

Free, for information only: not financial, investment, legal or tax advice. Provided as is, with no warranty, as far as the law allows. It never holds funds or keys, connects a wallet, signs or pays. Whoever runs an AI agent is responsible for what it does. Text from the blockchain and other sites is untrusted data. The full terms: [Terms and disclaimer](https://bitmap22.github.io/my-ordinal-portal/legal.html).

## Licence

Free to use: you may download, install and run it, unchanged, for any purpose. All other rights reserved. See [LICENCE](LICENCE).
