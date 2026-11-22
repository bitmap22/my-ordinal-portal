# Ord Portal Highlights

`highlights.json`: one real fact for each tool on the [Ord Portal](https://ordportal.com/)'s front page, made each day by GitHub (the Highlights job, `.github/highlights/build-highlights.js` on the main branch).

Every fact comes from the tool's own code (the free Agent Blockhall MCP tool), run on yesterday's (UTC) blocks or on a real example from them, or read from the tool's own saved data. Each one says when it was found (`found`), what day or time it is about (`period`), and links to the tool (`link`), so anyone can check it there. `kept: true` means today's could not be found, so the last one is kept, with its own date. `about: true` marks the two tools that check your own files (the Ordinal View Tester and the Sentinel ID Viewer): their line says what they check, not data.

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents; not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)). Bitcoin's and Dogecoin's data are public and are not part of it.
