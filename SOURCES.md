# Ord Portal: where its data comes from

© 2026 bitmap22. All rights reserved.

The Ord Portal (https://ordportal.com) and its free agent tool, Agent Blockhall (`io.github.bitmap22/agent-blockhall`), read only the sites below. Each site's own terms were read on **24 November 2026**, and the portal reads a site only when its terms allow this use. If a site changes its terms, it is checked again before it is read again.

Every page asks these sites gently: a few asks at a time, and a site that asks the portal to slow down is rested.

## Read (their terms allow it)

| Site | What the portal reads from it | What the portal does to follow its terms |
| --- | --- | --- |
| mempool.space | Bitcoin blocks, transactions, fees, the live new-block feed, the past price of bitcoin | Asked gently; named as the source on every page that uses it |
| mempool.fra.mempool.space | The same, from mempool.space's own Frankfurt server, when mempool.space does not answer | The same as mempool.space |
| ordpool.space | The same as mempool.space (a back-up), and its ordinal tags (CAT-21, Labitbu, OpenTimestamps) | Its terms are the same as mempool.space's: the same rules are followed |
| blockstream.info | Bitcoin blocks and transactions, as a back-up and as a second check | Asked gently; named as the source |
| ordinals.com | Inscriptions, their files, parents and children, block hashes, rune pages | Asked gently; named as the source; risky files are linked to, never run |
| CoinGecko (api.coingecko.com) | The price of bitcoin now | "Powered by CoinGecko" is shown, with a link, wherever its price is used |
| BNRP (api.bnrp.name) | Bitcoin names (.sats) | Asked gently; named as the source |

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

Because of this:

- **Doge Cube and the Dogecoin tools are paused.** There is no second Dogecoin source whose terms allow this use. The work is kept on the `doge-paused` branch.
- **The rare sats board is removed.** Only sites whose terms don't allow this use list rare sat prices.
- **The price of bitcoin now comes from 2 sources** (mempool.space and CoinGecko), not 6. A past day's price comes from mempool.space alone, and says so.

## Not data sites

GitHub (the portal's own data files, made by its own jobs from the chain), jsDelivr (a back-up copy of those files), the portal's own visit counter on Cloudflare, nostr relays (Play Together's messages between players), YouTube (youtube-nocookie.com, on the big screens), Google Fonts and GoatCounter (counting visits).

Something wrong here? Report it: https://github.com/bitmap22/my-ordinal-portal/issues
