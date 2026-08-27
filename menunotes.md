# Navigation Migration — Validation Notes

Notes on the header/nav migration for the Citibank EDS pilot, focused on why the
automated **LIVE parity gates** cannot be driven against the live source, and how
they could be made to pass in the future.

## Summary

- **Migrated header is correct and complete.** The two-row Citi header (utility bar
  + main nav with five hover megamenus) is implemented in `blocks/header/header.js`,
  `blocks/header/header.css`, and `content/nav.plain.html`. Every panel's links,
  quick-links, and icons match the live source 1:1 (verified — see table below).
- **The automated source-side capture is a false negative.** The LIVE comparison
  scripts (`live-compare-panels.js`, `live-compare-panel-text.js`,
  `compare-panel-screenshot.js`, etc.) cannot open `www.citi.com`'s megamenu panels
  in a headless browser, so on the SOURCE side they capture the wrong DOM. The
  MIGRATED side is captured perfectly by the same scripts.

## Verified desktop parity (independent, manual)

Captured by driving the live source myself at 1440×900 (hover opens each panel;
programmatic DOM extraction of every `li.mainListItem` sub-panel) and comparing to
the migrated panels captured cleanly by `live-compare-panels.js`.

| Panel | Source primary + quick = total | Migrated (links / images) | Match |
|---|---|---|---|
| Credit Cards | 9 + 3 = 12 | 12 / 3 | ✅ |
| Banking | 6 + 3 = 9 | 9 / 3 | ✅ |
| Lending | 7 + 5 = 12 | 12 / 5 | ✅ |
| Investing | 4 + 3 = 7 | 7 / 3 | ✅ |
| Wealth Management | 3 + 2 = 5 | 5 / 2 | ✅ |

- **Header structure:** 2 rows on source at ≥900px — row 1 = logo + FDIC line +
  ATM/BRANCH + ESPAÑOL; row 2 = Credit Cards / Banking / Lending / Investing /
  Wealth Management + Open an Account + How can we help?. Matches migrated.
- **Trigger type:** hover on desktop (hovering a nav button sets `aria-expanded=true`
  and opens the panel). Matches migrated `header.js` hover behavior.

(Machine-readable version of this table: `migration-work/navigation-validation/manual-panel-verification.json`.)

## Root causes (why the automated gates mis-capture the source)

`www.citi.com` renders its header nav via **client-side Angular**, not server-side
HTML. Two concrete failures result:

1. **Panel container class is case-sensitive-missed.** The real megamenu panel is
   `<div class="subMenuMainContainer">`. The scripts' panel selector list uses the
   attribute substring selector `[class*="submenu"]` (lowercase), which does **not**
   match the capital-M `subMenu…` class. So the real panel is never selected.
2. **The "largest visible panel" fallback grabs the wrong element.** Because the
   panel isn't matched, the fallback sweeps in the homepage **body** link strip
   `.lob-items-container` — the six doubled-text LOB icon links
   ("Credit Cards / Checking Accounts / Mortgage / Personal Loans / Investing
   Options / Small Business") at ~1296px wide — and reports those as the "source
   panel" for every trigger.
3. **Synthetic hover doesn't hold the panel open.** citi.com's panel stays open only
   under a live pointer; a headless synthetic `mouseenter`/`pointerover` (and even a
   programmatic `mouse.move`) does not keep it expanded long enough to read, and it
   collapses as soon as focus moves. This is the deeper reason a generic
   hover-then-scrape cannot work on this source.

Net effect: MIGRATED capture = perfect; SOURCE capture = wrong DOM ⇒ the gate reports
`0/5` even though the two are actually identical.

## Possible solutions (future work)

1. **Site-specific source adapter (most faithful).** Add a small citi.com capture
   helper that, per trigger: dispatches a real pointer hover, waits for
   `a[aria-expanded="true"]` on the nav button, and extracts links/images from the
   matching `li.mainListItem .subMenuMainContainer` — feeding a correct source
   snapshot into the comparison. Keeps the gate genuinely automated.
2. **Broaden the shared script's panel selector (upstream fix).** Make the panel
   match case-insensitive (`[class*="submenu" i]`) and/or add
   `[class*="subMenu"]`, and exclude body regions like `.lob-items-container` from
   the "largest visible panel" heuristic. This is an upstream change to the
   Navigation Orchestrator scripts (shared marketplace — must be proposed there, not
   edited locally).
3. **Snapshot the source once, compare against the snapshot.** Capture the correct
   source panels once (as done here) into a fixture JSON and have the gate compare
   the migrated capture against that fixture instead of re-scraping the live Angular
   app on every run.
4. **Manual/attended verification (current state).** Accept the independently
   verified parity evidence above; do not fabricate script markers. This is what was
   done for desktop before proceeding to mobile.

## Mobile (Phase 4)

- **Source mobile behavior (verified live at 375×812):** header collapses to the
  utility bar + a **"Menu"** hamburger. Opening it lists the 5 categories +
  ATM/BRANCH + ESPAÑOL + Open an Account. Tapping a category uses a **slide-in
  sub-panel** — the top-level list is replaced by that category's panel (primary
  links + Quick Links) headed by the category label acting as back/close. Not an
  accordion.
- **Migrated mobile now matches:** converted the mobile menu from accordion to
  slide-in (`nav-subpanel-open` state hides sibling items; each panel has a
  `.nav-panel-back` header that returns to the list). Full-width-flush list
  (items span 0→375px), 16px/600 labels. All 5 categories verified: correct
  sub-item counts (12/9/12/7/5), slide-in replaces list, back returns.
- **Fixed a mobile toggle bug:** the desktop `btn` click handler also fired on
  mobile, double-toggling `aria-expanded` and cancelling the open. Guarded it to
  desktop-only so the delegated mobile handler owns click.

### Mobile dimensional gate — 17/18 pass, 1 documented exception

`mobile-dimensional-gate.js` passes 17/18. The one remaining failure is a
**gate generic-threshold false positive**, not a defect:

- **"Secondary nav (`ul.nav-utility-links`) width equals viewport (375px)" —
  actual 210px.** The utility links (ATM/BRANCH + ESPAÑOL) are a compact
  right-aligned group in the top utility bar on BOTH the source and the migration
  — they are not a full-width secondary bar. The source doesn't even show a
  persistent secondary nav on mobile (ATM/ESPAÑOL live inside the opened menu).
  Forcing these to 375px would DIVERGE from the source, so the design is left as
  the faithful match and this check is treated as N/A.

## Status

- Desktop content + structure + hover-behavior parity: **verified** (manual +
  clean migrated capture).
- Automated desktop LIVE markers: **not generated** (scripts structurally cannot
  drive this client-side source headlessly; documented rather than faked).
- Next: proceed to **mobile** analysis, implementation, and validation.
