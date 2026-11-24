# Terms Check

Once a day, GitHub reads the terms (and licences) of every site the Ord Portal reads (see SOURCES.md on the main branch), and compares them with the day before.

- `state.json`: each page, when it was last read, and since when it has been the same.
- `texts/`: what each page said at the last check. This branch's history keeps every earlier wording.

If a page changed, a GitHub issue labelled `terms-check` says what changed. If a needed page can't be read 3 checks in a row, an issue says that too. The check only tells: it never stops the portal reading a site. A person reads the new terms and decides.

Live numbers on a page (prices, counts) are not compared, only the words.

© 2026 bitmap22. All rights reserved.
