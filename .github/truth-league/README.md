# Truth League: the record

Every few hours, GitHub's computers prove one Bitcoin block from its own bytes, then ask each free public data site that the Ord Portal's tools read a few facts about them, and mark each answer right or wrong against those bytes (never against another site). The last 30 days are kept here. The [Truth League page](https://ordportal.com/truth-league.html) and the free Agent Blockhall MCP tool (`truthLeague`) read it.

How a block proves itself:
- Bitcoin: its hash is worked out from its header and starts with at least 70 zero bits (its proof of work), its transactions are each worked out to their ids and lead to the header's merkle root (so the list is whole and in order), and its first transaction says its height.

- `latest.json`: the last check: the two proven blocks (`truth`), and each site's answers (`results`): what was asked (`asked`), the answer (`code`), and for a wrong answer what it said (`said`) and what the bytes say (`truth`).
- `league.json`: 30 days of checks, kept small. `sites` lists the sites in order and `facts` the facts each kind of site is asked, in order; each check (`t`, in seconds since 1970) has the proven blocks (`b` Bitcoin `[height, hash]`, and older checks `d`, a Dogecoin block `[height, hash, settled]`, from before Dogecoin was paused on 24 Nov 2026) and one string per site, a letter per fact: `R` right, `W` wrong, `M` it did not have it, `F` refused, `E` an error or an answer that could not be read, `N` no answer, `-` not asked. `wrong` keeps each wrong answer (up to 200).

The reader is [agent-blockhall-mcp/server/league.js](https://github.com/bitmap22/my-ordinal-portal/blob/main/agent-blockhall-mcp/server/league.js): `TruthLeague.summarise(record)` turns `league.json` into each site's counts, and `TruthLeague.rank(summary, sourceHealthSummary)` into the league. This branch is remade on each check, so it holds only the newest copy.

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)). What each site said is its own answer.
