// Keeps the dates in sitemap.xml right, so search engines know which pages changed.
// For each page in the sitemap, <lastmod> becomes today's date (UTC) if that page is in the list of changed files.
// Usage: node .github/checks/sitemap-dates.js changed.txt   (one file name per line, as git diff --name-only gives them)
// Free: it only edits sitemap.xml. © 2026 bitmap22. All rights reserved.
'use strict';
const fs = require('fs');

const changed = new Set(fs.readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean));
const today = new Date().toISOString().slice(0, 10);
const SITE = 'https://ordportal.com/';
let n = 0;
const xml = fs.readFileSync('sitemap.xml', 'utf8').replace(
  /<loc>([^<]*)<\/loc><lastmod>([^<]*)<\/lastmod>/g,
  (whole, loc, date) => {
    const file = loc.startsWith(SITE) ? (loc.slice(SITE.length) || 'index.html') : null;
    if (!file || !changed.has(file) || date === today) return whole;
    n++;
    return `<loc>${loc}</loc><lastmod>${today}</lastmod>`;
  });
fs.writeFileSync('sitemap.xml', xml);
console.log(`sitemap dates: ${n} page(s) set to ${today}`);
