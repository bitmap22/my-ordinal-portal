# Security policy

This covers the Ord Portal (https://ordportal.com, also at bitmap22.github.io/my-ordinal-portal) and everything in this repository: Agent Blockhall, Doge Cube, Block Paint City, the Play Together pages, the tools, the agent kits on each page, the GitHub workflows, and the Agent Blockhall MCP tool (`io.github.bitmap22/agent-blockhall`, in `agent-blockhall-mcp/`).

## Supported versions

| What | Supported |
|---|---|
| The live site, ordportal.com (this repository's `main` branch) | Yes |
| The newest release of the Agent Blockhall MCP tool | Yes |
| Older releases of the MCP tool | No: please update to the newest |

## How to report a vulnerability

Please report it privately, not in a public issue:

1. **GitHub (best):** open this repository's **Security** tab and press **Report a vulnerability**. Only bitmap22 sees it.
2. **Or** send a direct message to [@BitmapPlotz on X](https://x.com/BitmapPlotz).

Please say:

- which page, tool or file it is in
- what an attacker could do
- the steps to show it, and the browser or setup you used

bitmap22 will reply as soon as possible, tell you what will be done, and credit you when it is fixed, if you would like that.

Please don't run tests that could harm other people: no attacks on other players or their wallets, no flooding of the public data sites the portal reads, and no tricking people into anything.

## In scope

- The portal's own pages, games and tools, and their agent kits (`window.agent`) and WebMCP tools
- The Agent Blockhall MCP tool
- This repository's GitHub workflows (the timed jobs and the MCP publish job)

## Not in scope

- **Inscriptions on Bitcoin or Dogecoin**, including bitmap22's own: once inscribed they can't be changed. If one is unsafe, tell us anyway, and the portal will stop showing or linking it.
- **Other sites** the portal reads from or links to, such as ordinals.com, ordiscan.com, mempool.space, UniSat and the Doginals explorer. Please report those to their owners.
- Problems that need someone to give away their own seed words, keys or passwords.

## How the portal keeps people safe

- **An inscription's code never runs** in Agent Blockhall, Doge Cube or the Sentinel ID Viewer. A web page, a script or a file whose type can't be checked is not opened: its own page on ordinals.com (or ordiscan.com, the back-up) is linked instead. Pictures, sound, film and plain text show in frames where nothing can run.
- **The Ordinal View Tester** only runs a file you load into it yourself, in a locked frame with no reach into the portal, your saved data or a wallet.
- **No keys:** the portal never asks for, sees or keeps seed words, private keys or passwords. Connecting a wallet only reads which address and inscriptions it holds.
- **Agents never sign, mint or pay.** Only a person does that, in their own wallet. What comes from the blockchain or other players is marked as untrusted data, never instructions.
- **Chat** shows messages as plain text only, so no code in a message can run.
- **Safety headers** on every page (set at Cloudflare): always HTTPS (`Strict-Transport-Security`, 6 months), no file-type guessing (`X-Content-Type-Options: nosniff`), only ordportal.com may show its pages in a frame (`X-Frame-Options: SAMEORIGIN`), other sites only see the site name (`Referrer-Policy: strict-origin-when-cross-origin`), and camera, location, payment and USB are switched off, with the microphone and screen share allowed only for the portal's own pages (`Permissions-Policy`).
- **The MCP publish job** uses a fixed version of `mcp-publisher`, checked against its published fingerprint before it runs.
- **The `main` branch** only takes changes through pull requests.

## Free security scans

On 19 November 2026 the Agent Blockhall MCP tool (version 1.15.0) was scanned with free, open-source scanners. They were run by bitmap22's own setup, not by an outside firm:

| Scanner | What it checked | Result |
|---|---|---|
| [Cisco AI Defense mcp-scanner](https://github.com/cisco-ai-defense/mcp-scanner) 4.8.7 (YARA and schema checks) | All 28 tools, as an agent sees them over MCP | No findings |
| [njsscan](https://github.com/ajinabraham/njsscan) 1.0.2, with Semgrep 1.172.0 | The tool's code | 14 findings, each checked by hand: 3 uses of `Math.random` in the Truth League (fixed, below); 11 pattern warnings that were false alarms (each pattern only matches fixed shapes). Its pattern check timed out on the 3 biggest files, so those were checked by hand and timed: that found the SVG check below |
| Dependencies | Outside packages the tool uses | None: it uses only Node.js's own built-in modules |
| [detect-secrets](https://github.com/Yelp/detect-secrets) 1.5.0 | Every text file in this repository, for keys or passwords | None real (only inscription IDs, hashes and public addresses) |

Fixed in version 1.15.1:

- **A file that could freeze the tool:** the check that tells whether a file is an SVG picture got exponentially slower with each `<!-- -->` comment at the start of a file, so an inscription made on purpose could freeze it. Each comment now ends at its own first `-->`, so it stays fast. The same check in Block Paint City was fixed too.
- **Guessable quiz blocks:** the Truth League picked the block and transaction it quizzes data sites about with `Math.random`, which is not made for this. It now uses proper random numbers (`crypto.getRandomValues`), so no site can guess its next question.

Every network request the tool makes goes to its own fixed list of sites. Addresses found inside an inscription are only listed, never fetched.

Not run: Snyk Agent Scan (it needs a Snyk account) and Cisco's behavioural check (it needs a paid AI model key).

More in the [Terms and disclaimer](https://ordportal.com/legal.html).

© 2026 bitmap22. All rights reserved.
