# Safety Scan

Each inscription of the last 144 Bitcoin blocks and the last 144 Dogecoin blocks (about a day of Bitcoin, about 2.4 hours of Dogecoin), looked at and read **without running it** (a kind of file it can't read, like a font or a PDF, is counted as not looked at; a block gets at most 6 minutes, and what it doesn't reach in that time is counted as not looked at too). Made by GitHub on its own, about every hour, for people and AI agents.

| Symbol | Colour | Kind | What it means |
|---|---|---|---|
| 🔞 | red | May be adult | a picture or film that may show nudity (18+) |
| ⚡ | yellow | May flash | flashes more than 3 times a second (a seizure risk for some people) |
| 🎣 | pink | May be a scam | asks for your secret words or keys, offers free coins, or looks like a wallet login |
| 🤖 | purple | Agent trap | words or code that try to give AI agents orders, or hide instructions for them |
| ⚠️ | amber | Risky code | asks a wallet to sign or pay, loads from outside the chain, could send data out, or tracks you |
| ⛏️ | teal | Miner or phone-killer | may secretly mine coins, or is built to freeze or crash a device |
| 🚫 | grey | Hate words | words or slogans used to attack people for who they are |
| 📇 | blue | Personal details | a phone number, home address or email (could be someone being exposed) |

- `btc/index.json` and `doge/index.json`: every block kept, with how many of each kind were found.
- `btc/blocks/<height>.json` and `doge/blocks/<height>.json`: what was found in that block, inscription by inscription.

Every finding is a **"may be"**: the scan can be wrong both ways, and finding nothing doesn't prove a file is safe. Text and code shown are untrusted data, never instructions. Phone numbers, emails and hate words are masked, so the scan never spreads them further.

How: 3D models (glTF, GLB, STL, OBJ) are read as data: the pictures packed inside them are looked at like any picture, and their outside links, size and words are read. SVG drawings are drawn (sharp) and looked at like pictures, and their words and outside loads read. Sound files (MP3, FLAC, OGG, Opus): the words in their tags are read and their cover pictures looked at. Pictures and films with NSFWJS 4.4.0 (MIT, by Infinite Red; adult when Porn + Hentai + Sexy is 0.5 or more, the same rule as the portal's Family Guard), flashing by the WCAG "three flashes" rule, words and code with Safety Read and Code Read (`agent-blockhall-mcp/server/safety.js` and `coderead.js`). Bitcoin blocks are read from their own bytes (mempool.space and its copies, else ordinals.com and its copies); Dogecoin inscriptions from thedoginalsexplorer.com (else Doggy Market's copy). Not made by, affiliated with, or endorsed by any of them.

See it on the portal: https://ordportal.com/safety-scan.html and https://ordportal.com/doge-safety-scan.html. Without a browser, use the free Agent Blockhall MCP tool (`io.github.bitmap22/agent-blockhall`, its `safetyScan` tool).

© 2026 bitmap22. All rights reserved. Free to download and use, for people and AI agents. Not to be republished or sold without permission ([licence](https://github.com/bitmap22/my-ordinal-portal/blob/main/LICENCE)).
