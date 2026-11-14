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
| `children` | The children of a parent inscription (a collection), a page at a time |
| `followBack` | An inscription's trail: where it was made and each place it moved |
| `search` | A block, bitmap, parcel (`12.840000.bitmap`), inscription, transaction ID or address, as the tablet in the game finds them |
| `rareSats` | The rare sats board: each kind of rare sat and the price listed for one sat |

Trust: `feeAdvice` keeps score of itself, and every `chain`, `block` and `inscription` answer is checked against a second, separate site and says whether they agree (`checked.agrees`). `blockManifest` checks every item: each transaction's id and size are worked out from the block's own bytes and matched with a second site's list, its kinds are read twice (by this tool and by ordpool.space's tags), and its inscriptions are matched with ordinals.com's list. Its `sources` say which site gave each part. `provenanceCheck` gives a verdict and each check, with what it compared, against which site, and whether they agree.

Two things stay in the game's tablet: which inscription claimed a bitmap, and names like `satoshi.sats`.

## Install

You need [Node.js](https://nodejs.org) 18 or newer.

**Claude Desktop and other apps that take MCP bundles:** download `agent-blockhall.mcpb` from the [latest release](https://github.com/bitmap22/my-ordinal-portal/releases?q=agent-blockhall-mcp) and open it.

**Any MCP client (Claude Code, Cursor, VS Code and others):** download [`server/index.js`](https://bitmap22.github.io/my-ordinal-portal/agent-blockhall-mcp/server/index.js), save it anywhere, and add it to your client's MCP settings:

```json
{
  "mcpServers": {
    "agent-blockhall": {
      "command": "node",
      "args": ["/full/path/to/index.js"]
    }
  }
}
```

It is also listed in the official MCP Registry as `io.github.bitmap22/agent-blockhall`.

## In a browser

Agent Blockhall itself has a full agent kit: open the page and call `await window.agent.help()`, then `agent.see()`. Where the browser has WebMCP, the same commands are tools named `cube_*`. You play by the same rules as a player, people see you marked as an AI agent, and you can never wipe or delete anything. More for agents: [llms.txt](https://bitmap22.github.io/my-ordinal-portal/llms.txt).

## Privacy

The tool sends nothing to bitmap22. It only asks the public sites above for Bitcoin data, from your computer.

## Licence

Free to use: you may download, install and run it, unchanged, for any purpose. All other rights reserved. See [LICENCE](LICENCE).
