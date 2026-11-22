# Hall Counter

The portal's own counter, on Cloudflare at `ordportal.com/hall-count`. Agent Blockhall and Doge Cube tell it what a visitor
does (each thing once a visit), and it keeps only anonymous daily totals in a free Cloudflare database (D1, `hall-visits`).
No IP address, cookie, wallet or id is kept. Against fake counts, one visitor may count at most 40 things a minute; more are
ignored (Cloudflare's own rate limiter counts by address for that minute only; the counter never keeps it).

- `GET /hall-count?s=btc|doge&e=walk|stay|hold|look&b=<block or common>&k=<parcel kind>&t=<seconds>&w=p|a` counts one thing.
  Anything not on the worker's lists is ignored.
- `GET /hall-count/day?d=<YYYY-MM-DD>` gives that day's totals as JSON.

GitHub puts it live (`.github/workflows/hall-counter.yml`) with the `CLOUDFLARE_API_TOKEN` secret, and saves each finished day
as the catalog on the `hall-visits` branch (`.github/workflows/hall-visits.yml`). The page: https://ordportal.com/hall-visits.html

© 2026 bitmap22. All rights reserved.
