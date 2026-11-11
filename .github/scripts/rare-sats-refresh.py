#!/usr/bin/env python3
"""Daily refresh of rare-sats.json for the rare sats board in Block Cube.

Reads https://ordiscan.com/rare-sats once (a few slow retries if the read looks wrong)
and writes the "price per sat" of each kind into rare-sats.json, exactly as the page shows it.

It never guesses. If the page cannot be read, a kind is missing, or the page's own
time stamp is old, it changes nothing and ends with an error.
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

URL = "https://ordiscan.com/rare-sats"
FILE = "rare-sats.json"
UA = "bitmap22-rare-sats-refresh/1.0 (+https://github.com/bitmap22/my-ordinal-portal)"
VALUE_OK = re.compile(r"^[<$0-9., —]{1,14}$")   # the same rule the game uses
DASH = "—"
MAX_AGE_HOURS = 6      # the page's own time stamp must be newer than this
MIN_PRICED = 9         # a page with almost no prices is a broken page, not real news
TRIES = 4
WAIT_SECONDS = 30
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


class Rows(HTMLParser):
    """Collects the text of every table row, cell by cell."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.row, self.cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=40) as r:
        if r.status != 200:
            raise ValueError("the page answered with status %s" % r.status)
        return r.read().decode("utf-8", "replace")


def read_page(keys):
    """Returns {KEY: price string} for the wanted keys, or raises ValueError saying why not."""
    body = fetch()

    # 1. the table, exactly as shown
    p = Rows()
    p.feed(body)
    head = next((r for r in p.rows if r and r[0] == "Satribute"), None)
    if not head or len(head) < 2 or head[1] != "Price per sat":
        raise ValueError("the table no longer has 'Price per sat' as its second column")
    shown = {}
    for r in p.rows:
        if len(r) >= 2 and r[0] != "Satribute":
            shown[r[0].upper()] = DASH if r[1] in ("N/A", "", "-", DASH) else r[1]
    missing = [k for k in keys if k not in shown]
    if missing:
        raise ValueError("kinds missing from the page: " + ", ".join(missing))
    prices = {k: shown[k] for k in keys}
    bad = [k for k, v in prices.items() if not VALUE_OK.match(v)]
    if bad:
        raise ValueError("prices in a shape the game would ignore: " + ", ".join("%s=%r" % (k, prices[k]) for k in bad))
    priced = sum(1 for v in prices.values() if v != DASH)
    if priced < MIN_PRICED:
        raise ValueError("only %d of %d kinds show a price (looks like an empty page)" % (priced, len(keys)))

    # 2. the page's own data: how fresh it is, and does it agree with the table
    m = re.search(r'(?s)<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', body)
    if not m:
        raise ValueError("the page's own data block is missing, so its age cannot be checked")
    try:
        q = json.loads(m.group(1))["props"]["pageProps"]["trpcState"]["json"]["queries"]
        state = next(x["state"] for x in q if "getAllSatributeStats" in json.dumps(x.get("queryKey")))
        data, stamp = state["data"], state["dataUpdatedAt"] / 1000.0
    except Exception as e:
        raise ValueError("the page's own data block could not be understood (%s)" % e)
    age_h = (time.time() - stamp) / 3600.0
    if not (-0.25 <= age_h <= MAX_AGE_HOURS):
        raise ValueError("the page's data is %.1f hours old (an old copy)" % age_h)
    for k, v in prices.items():
        usd = (data.get(k.replace(" ", "_")) or {}).get("priceInUsd")
        if v == DASH:
            ok = usd is None
        elif usd is None:
            ok = False
        elif v.startswith("<"):
            ok = usd < float(v.replace("<", "").replace("$", "").replace(",", ""))
        else:
            n = float(v.replace("$", "").replace(",", ""))
            ok = abs(n - usd) <= (1.0 if "." not in v else 0.0101)
        if not ok:
            raise ValueError("%s: the table shows %r but the page's data says %r" % (k, v, usd))
    return prices, stamp


def main():
    with open(FILE, encoding="utf-8") as f:
        old_text = f.read()
    old = json.loads(old_text)
    keys = list(old["prices"].keys())
    if len(keys) != 18:
        raise SystemExit("rare-sats.json should have 18 kinds, found %d. Nothing changed." % len(keys))

    # already read today (an earlier run got it): nothing to do
    now = datetime.datetime.now(ZoneInfo("Europe/London"))
    if old.get("read") == "%d %s %d" % (now.day, MONTHS[now.month - 1], now.year) and os.environ.get("FORCE") != "1":
        print("Already read today. Nothing to do.")
        return

    prices = why = None
    for n in range(TRIES):
        if n:
            time.sleep(WAIT_SECONDS)
        try:
            prices, stamp = read_page(keys)
            break
        except (ValueError, urllib.error.URLError, OSError) as e:
            why = str(e)
            print("read %d did not pass: %s" % (n + 1, why))
    if prices is None:
        # the day has more tries left (the job runs again a few hours on): only the day's last try counts as a failure
        if os.environ.get("LAST_TRY") != "1":
            print("Could not get a good, fresh read of the page this time (%s). Nothing changed. It will try again later today." % why)
            return
        raise SystemExit("Could not get a good, fresh read of the page (%s). Nothing changed." % why)

    now = datetime.datetime.now(ZoneInfo("Europe/London"))
    today = "%d %s %d" % (now.day, MONTHS[now.month - 1], now.year)

    # keep the file's exact shape: only swap the values inside it
    text = old_text
    def swap(key, value, t):
        t2, n = re.subn(r'("%s"\s*:\s*)"[^"]*"' % re.escape(key), lambda mm: mm.group(1) + json.dumps(value, ensure_ascii=False), t)
        if n != 1:
            raise SystemExit('Could not find "%s" exactly once in rare-sats.json. Nothing changed.' % key)
        return t2
    text = swap("read", today, text)
    for k in keys:
        text = swap(k, prices[k], text)
    new = json.loads(text)
    assert list(new.keys()) == list(old.keys()) and list(new["prices"].keys()) == keys
    assert new["prices"] == prices and new["read"] == today and new["source"] == old["source"]

    changed = [(k, old["prices"][k], prices[k]) for k in keys if old["prices"][k] != prices[k]]
    lines = ["Rare sats read %s (page data from %s UTC)." % (today, datetime.datetime.fromtimestamp(stamp, datetime.timezone.utc).strftime("%H:%M"))]
    lines += ["%s: %s -> %s" % c for c in changed] or ["No price changed."]
    print("\n".join(lines))
    if text != old_text:
        with open(FILE, "w", encoding="utf-8", newline="") as f:
            f.write(text)
    with open(os.environ.get("RARE_SATS_NOTE", os.devnull), "w", encoding="utf-8") as f:
        f.write("Rare sats: prices read %s (%s)\n\n" % (today, "%d changed" % len(changed) if changed else "no price changed"))
        f.write("\n".join(lines[1:]) + "\n")


if __name__ == "__main__":
    main()
