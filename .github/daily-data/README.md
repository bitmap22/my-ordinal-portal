# Agent Blockhall Daily Data

Every Bitcoin block of each UTC day, read the [Block Manifest](https://bitmap22.github.io/my-ordinal-portal/block-manifest.html) way, one file per day. Made each night by GitHub, for people and AI agents.

- `index.json`: every day, with its totals and links to its files.
- `days/YYYY-MM-DD.json`: each block of that day. You get what's in it (counts of Agent Blockhall's hall kinds), its fees and who mined it, and its checks. Its hash is worked out from its own bytes and asked of a second site. Each transaction's id and size are worked out from the bytes and checked against mempool.space's list. Its kinds are checked against ordpool.space's tags, and its inscriptions against ordinals.com's list. Pairs are `[matched, of]`, and `null` means a site did not answer.
- `days/YYYY-MM-DD.csv`: the same day as a spreadsheet, one row per block.

See them on the portal: https://bitmap22.github.io/my-ordinal-portal/daily.html. Without a browser, use the free Agent Blockhall MCP tool (`io.github.bitmap22/agent-blockhall`, its `dailyData` tool).

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents. Not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)). Bitcoin's own data is public. The data comes from the free public sites mempool.space (and its copies), ordpool.space and ordinals.com (and its back-ups), asked gently.
