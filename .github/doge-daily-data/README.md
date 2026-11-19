# Doge Cube Daily Data

Every Dogecoin block of each UTC day, one file per day. Made each night by GitHub, for people and AI agents. It's the Dogecoin twin of [Agent Blockhall's Daily Data](https://github.com/bitmap22/my-ordinal-portal/tree/daily-data).

- `index.json`: every day, with its totals and links to its files.
- `days/YYYY-MM-DD.json`: each block of that day: its fees (in koinu: 1 DOGE = 100,000,000 koinu), who mined it (where its coinbase names a pool), its Doginals by file type, and its checks. Its hash is worked out from its own header and asked of a second site (Bitcore). Its list of transactions is proved by the merkle root in that header and matched with Bitcore's list. Its coinbase is read from its own bytes (Blockchair).
- `days/YYYY-MM-DD.csv`: the same day as a spreadsheet, one row per block.

Tokens (DRC-20, TAP) and dunes need every transaction's own bytes, so they aren't counted here. The [Doge Block Manifest](https://ordportal.com/doge-block-manifest.html) reads them for any block.

See them on the portal: https://ordportal.com/doge-daily.html. Without a browser, use the free Agent Blockhall MCP tool (`io.github.bitmap22/agent-blockhall`, its `dogeDailyData` tool).

Read from the free public sites thedoginalsexplorer.com, BitPay's Bitcore and Blockchair. Not made by, affiliated with, or endorsed by any of them.

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents. Not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)). Dogecoin's data is public and is not part of it.
