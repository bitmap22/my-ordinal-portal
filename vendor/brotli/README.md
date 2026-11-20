# Brotli decoder (Google), used by the Ord Portal

`decode.min.js` is Google's Brotli decoder for JavaScript, copied unchanged from
https://github.com/google/brotli (file `js/decode.min.js`, commit 6a14c0798233769cef147cf9bafaefe147b8ddc3, 13 Nov 2026).

Copyright (c) 2009, 2010, 2013-2016 by the Brotli Authors. MIT licence: see `LICENSE` in this folder.

The portal's pages (the Provenance Check and the Trade Check) load it only when an inscription's file is stored packed with
Brotli, which ord allows, so a browser can unpack that file and compare it with the copy a site shows. The free Agent
Blockhall MCP tool does the same with Node.js's own Brotli, so it does not use this file.
