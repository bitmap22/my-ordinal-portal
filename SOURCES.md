# Ord Portal: where its data comes from

© 2026 bitmap22. All rights reserved.

The Ord Portal (https://ordportal.com) and its free agent tool, Agent Blockhall (`io.github.bitmap22/agent-blockhall`), read only the sites below. Each site's own terms were read on **24 November 2026** and read again on **27 November 2026**, and the portal reads a site only when its terms allow this use. **The terms are checked once a day for changes.** A GitHub job (Terms Check) reads each site's terms every day and compares them with the day before. If they change, bitmap22 is told at once, and the new terms are read before the portal decides whether to keep reading that site. The record of every check is on the `terms-check` branch.

Every page asks these sites gently: a few asks at a time, and a site that asks the portal to slow down is rested.

## Read (their terms allow it)

| Site | What the portal reads from it | What the portal does to follow its terms |
| --- | --- | --- |
| mempool.space | Bitcoin blocks, transactions, fees, the live new-block feed, the past price of bitcoin | Asked gently; named as the source on every page that uses it |
| mempool.fra.mempool.space | The same, from mempool.space's own Frankfurt server, when mempool.space does not answer | The same as mempool.space |
| ordpool.space | The same as mempool.space (a back-up), and its ordinal tags (CAT-21, Labitbu, OpenTimestamps) | Its terms are the same as mempool.space's: the same rules are followed |
| blockstream.info | Bitcoin blocks and transactions, as a back-up and as a second check | Asked gently; named as the source |
| ordinals.com | Inscriptions, their files, parents and children, block hashes, rune pages | Asked gently; named as the source; risky files are linked to, never run |
| CoinGecko (api.coingecko.com) | The price of bitcoin now | "Powered by CoinGecko" is shown, with a link, wherever its price is used. Its free plan carries no commercial licence, so it is read only while the portal is free |

## Links only (nothing is read from them)

- **ordiscan.com**: a button or link opens an inscription's own page there (a back-up to ordinals.com's page). The portal reads no data from it.
- **UniSat**: the Play Together page's read-only wallet check uses the UniSat wallet that the player has in their own browser, if they choose to. The portal reads no data from UniSat's sites. Code Read warns when an inscription's code asks a wallet for things.

## No longer read (removed on 24 November 2026)

Removed because their terms don't allow this use, or don't clearly allow it:

- Kraken, Gemini, Coinbase, Bitstamp and Blockchain.com (blockchain.info): bitcoin prices
- stampchain.io: Stamp numbers, SRC-20 totals, SRC-721 pictures and SRC-101 names (no longer shown)
- api.counterparty.io: Counterparty details (no longer shown)
- Ordinals Wallet, ord.xverse.app, OrdinalsBot and ordiscan.com (as a data source): back-up ord sites
- mempool.emzy.de, mempool.ninja and mempool.bitaroo.net: copies of mempool.space
- Blockchair, BlockCypher, BitPay's Bitcore and 3xpl: back-up explorers
- Doggy Market: Doginal files

Removed on 27 November 2026:

- BNRP (api.bnrp.name): Bitcoin names (.sats, .btc and the like). Its own terms allow the portal's use, but its guide says it gets its answers from other indexers, UniSat among them, and the portal does not use UniSat. Names other than bitmaps are no longer looked up: ordinals.com has no way to find an inscription from a name. Bitmaps (840000.bitmap) and parcels are not touched: they are read from ordinals.com and the chain itself.

Never read (kept an eye on):

- **Alkanes**: Agent Blockhall, the Block Manifest and Blockspace Share spot Alkanes from each block's own bytes, under Alkanes' own rules, so no site is needed for that. Their names, balances and contract details are not shown: the public Alkanes readers we found need an account and key (Ordiscan, which the portal stopped reading) or are UniSat's, which the portal does not use. Alkanes is in the monthly review in case a reader whose terms allow it appears.

**These sites are looked at again once a month** (a GitHub job, Source Review), to see if any now allows the portal's use. It opens one GitHub issue a month listing each site and whether its terms changed. A site comes back only after its new terms are read and clearly allow it.

Because of this:

- **Doge Cube and the Dogecoin tools are paused.** There is no second Dogecoin source whose terms allow this use. The work is kept on the `doge-paused` branch.
- **The rare sats board is removed.** Only sites whose terms don't allow this use list rare sat prices.
- **The price of bitcoin now comes from 2 sources** (mempool.space and CoinGecko), not 6. A past day's price comes from mempool.space alone, and says so.

## Not data sites (their terms were read on 27 November 2026)

These are not sources of Bitcoin data: they host, count or carry. They are not in the daily Terms Check; their terms are read by hand.

| Site | What the portal uses it for | What its terms say, and what the portal does |
| --- | --- | --- |
| GitHub | Hosts the site and its own data files (made by its own jobs from the chain); runs the timed jobs | Pages: a site may be up to 1 GB (this one is well under) and may not be an online business; a tip button is allowed. Actions: for building and publishing this project, with no load on GitHub's machines out of proportion to the good it does. Since 27 November 2026 the keeper job waits without holding a machine |
| jsDelivr | A back-up copy of the portal's own data files | Free for personal and commercial use. Not to be used as general file storage: only the portal's own small data files are read through it |
| GoatCounter | Counting visits | Free for reasonable public use (personal sites and small businesses) |
| Cloudflare | The domain, and the portal's own visit counter (its free plan) | Its free network is for web pages, which is what the portal is; the counter stays inside the free plan's daily allowance |
| Google Fonts | The lettering on 2 pages | Allowed. Google sees a visitor's internet address when the lettering loads; the Terms page says so |
| Nostr relays: relay.primal.net, nostr.oxtr.dev, offchain.pub, relay.snort.social, relay.nostr.net | Play Together's messages between players | Each calls itself a public relay and publishes no rules. nostr-01.yakihonne.com was taken out on 27 November 2026: it says it is mainly for long form content creators |

**If the portal ever earns money**, two things must change first: GitHub Pages may not be used to run a business, and CoinGecko's free plan has no commercial licence.

Something wrong here? Report it: https://github.com/bitmap22/my-ordinal-portal/issues
