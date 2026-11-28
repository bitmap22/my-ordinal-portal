# Source Health: the hourly record

About once an hour, GitHub's computers ask each free public data site that the Ord Portal's tools read one small thing (most: the newest block's height), and keep a week of the answers here. The [Source Health page](https://ordportal.com/source-health.html) and the free Agent Blockhall MCP tool (`sourceHealth`) read it.

- `latest.json`: the last check, site by site: whether it answered (`state`: answers, slow, refused, error, no answer or wrong answer), how long it took (`ms`), what it said (`says`) and how many blocks behind the others it was (`behind`).
- `week.json`: a week of checks, kept small. `sites` lists the sites in order; each check (`t`, in seconds since 1970) has one entry per site: `[state, ms, blocks behind]`, where the state is `a` answers, `s` slow (2.5 seconds or more), `r` refused, `e` an error, `n` no answer and `w` an answer that wasn't what was asked. A blocks-behind of -1 means a file copy that didn't match.

The reader is [agent-blockhall-mcp/server/health.js](https://github.com/bitmap22/my-ordinal-portal/blob/main/agent-blockhall-mcp/server/health.js): `SourceHealth.summarise(record)` turns `week.json` into each site's last day and week. This branch is remade on each check, so it holds only the newest copy.

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)). What each site said is its own answer.
