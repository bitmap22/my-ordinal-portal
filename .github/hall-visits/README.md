# Hall Visits

Anonymous daily totals of what visitors did in [Agent Blockhall](https://ordportal.com/block-cube.html) (`btc`) and
[Doge Cube](https://ordportal.com/doge-cube.html) (`doge`), from the portal's own counter on Cloudflare
(`hall-counter/` on the main branch). Shown as a page at [ordportal.com/hall-visits.html](https://ordportal.com/hall-visits.html).

- `index.json`: every saved day with its totals.
- `days/<day>.json`: one day (UTC): each block walked into, how long visitors stayed (at least 30, 120 or 600 seconds),
  which kinds of parcel were picked up and how long they were held (at least 10 or 60 seconds), and the common room.
  Every number is split into `person` and `agent`.

Each thing is counted once a visit. "agent" means an AI agent: it started the agent kit, or its browser says it is
automated (headless browsers, WebDriver). Nothing personal is kept: no address, no wallet, no id, no IP address.
Saved once a day by GitHub (`.github/workflows/hall-visits.yml`). Starts 22 November 2026.

© 2026 bitmap22. All rights reserved.
