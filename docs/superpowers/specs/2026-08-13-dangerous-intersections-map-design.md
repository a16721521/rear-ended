# Dangerous Intersections Map — Design Spec

**Status:** Approved, pending implementation plan
**Date:** 2026-08-13

## 1. Purpose

A single page, `/dangerous-intersections-los-angeles`, presenting an interactive map and ranked list of LA County's most dangerous intersections, backed by real crash data. It serves four goals simultaneously:

- **Link bait / press** — a rigorously sourced, original ranking that LA news, neighborhood blogs, and safety advocates want to cite and link to.
- **Lead generation** — a visitor who was hurt at one of these intersections recognizes it and converts, routed to the practice page matching what actually happens there.
- **AEO/GEO citability** — server-rendered, extractable prose and `Dataset`/`FAQPage`/`HowTo` schema that AI answer engines (ChatGPT, Perplexity, AI Overviews) can quote directly.
- **Local SEO** — internal link equity into existing city and practice pages, ranking for intersection/neighborhood safety queries.

Scope: **Los Angeles County, top 25 intersections** by injury-and-fatal crash count, single page (not split into per-intersection sub-pages — see § 7 for why and what would change that).

## 2. Data Source

**TIMS/SWITRS (UC Berkeley SafeTREC), not the LAPD Socrata API.**

The obvious automatable source — `data.lacity.org`'s "Traffic Collision Data from 2010 to Present" (`d5tf-ez2w`) — was evaluated and rejected. Verified 2026-08-13:
- Most recent record is 2025-03-08 — the feed has been effectively dead for ~17 months.
- Annual collision counts drop from ~57,000 (2018–2019) to ~16,000–18,000 (2021 onward) — a reporting-methodology change, not a real 70% drop in collisions. Ranking off this data invites a trivial fact-check failure.
- It's LAPD jurisdiction only, not LA County.

TIMS geocodes CHP's statewide SWITRS database, covers all of LA County, and is what Vision Zero programs and academics actually cite. It requires a free account and manual export (no live API) — **this export must be performed by the user**, then committed to the repo. Refresh cadence: annual, one manual export + two script runs.

**Export parameters:**
- Geography: Los Angeles County
- Date range: 5 most recent complete years available at export time
- Severity: injury and fatal only (all `COLLISION_SEVERITY` values except property-damage-only)
- Format: crash-level CSV
- Fields needed: `PRIMARY_RD`, `SECONDARY_RD`, `INTERSECTION`, `POINT_X`, `POINT_Y`, `COLLISION_SEVERITY`, `NUMBER_KILLED`, `NUMBER_INJURED`, `TYPE_OF_COLLISION`, `PCF_VIOL_CATEGORY`, `PEDESTRIAN_ACCIDENT`, `BICYCLE_ACCIDENT`, `MOTORCYCLE_ACCIDENT`, `TRUCK_ACCIDENT`, `ALCOHOL_INVOLVED`

Committed to the repo as `data/raw/tims-la-county-YYYY-YYYY.csv` for reproducibility.

## 3. Aggregation: crashes → intersections

SWITRS has no intersection ID, so intersections are derived:

1. Keep rows where `INTERSECTION = Y`.
2. Normalize street names: uppercase, strip directional prefixes (N/S/E/W), canonicalize suffix variants (`AV`/`AVE`/`AVENUE` → one form).
3. Sort each street pair alphabetically so `A & B` and `B & A` collapse into one group.
4. Spatially validate: points in a group should cluster within ~100m. Bimodal clusters (two streets crossing twice, which happens in LA) are split into separate intersections rather than merged.
5. Assign each intersection's map coordinate as the **median** of its cluster's points, not the mean — resistant to single bad geocodes.

## 4. Ranking methodology

**Rank by raw count of injury-and-fatal crashes over the 5-year window.** No weighted composite "danger score."

Rationale: a weighted score invites "where did your weights come from," which can unravel a page whose entire value proposition is being trustworthy. "We counted injury crashes at each intersection over five years" is a claim nobody can meaningfully dispute.

Each intersection additionally displays, as separate fields (not folded into the rank):
- Killed count
- Severe-injury count
- Total injured count
- Dominant `TYPE_OF_COLLISION`
- Mode flags (pedestrian / bicycle / motorcycle / truck involvement)
- Alcohol involvement rate

This lets a reader see e.g. that #7 is less frequent but deadlier than #3, without the ranking itself being a value judgment.

**Explicitly out of scope:** crashes-per-vehicle-volume (the academically "correct" danger measure). Requires per-intersection traffic count data that doesn't reliably exist for all 25 locations; a half-done version is worse than clearly stating the limitation. The methodology section states this limitation in plain language.

**Framing guardrail:** the page states these intersections *recorded the most injury crashes in state data over the period* — never that the location is inherently dangerous, and never anything implying fault on the part of a nearby property owner or business.

## 5. LADOT High Injury Network overlay

Each ranked intersection is checked for proximity (~50m) to LADOT's Vision Zero High Injury Network (`data/hin.geojson`, sourced from LA GeoHub). Matches display a "On LADOT's High Injury Network" badge — corroboration from the City's own published safety data, which strengthens the page's credibility and citability.

HIN is City of LA only. County intersections outside city limits get an explicit "outside LADOT jurisdiction" label rather than an ambiguous blank — silence there would read as "not on the network" when it actually means "not applicable."

**Known scope skew:** because City of LA generates the plurality of county crash volume, the top-25 county-wide ranking will likely still be dominated by LA-proper intersections. This is a legitimate result of real data, not an error, but page copy must not oversell "county-wide" framing if e.g. 20+ of 25 entries are within LA city limits.

## 6. Page structure

**Single page**, `/dangerous-intersections-los-angeles` (extensionless per site convention), root-level file `dangerous-intersections-los-angeles.html`.

Section order, top to bottom:
1. Hero (dark brand background, matches existing practice/city page pattern)
2. H1 + key-findings paragraph — top-line numbers in extractable prose (the primary AEO payload)
3. Interactive map (Leaflet + OpenStreetMap tiles, ~42KB gzipped, no API key/billing)
4. Ranked list of intersection cards (see § 6.1)
5. Methodology section, including stated limitations (§ 4)
6. Numbered "what to do if you were hurt here" playbook (→ `HowTo` schema)
7. FAQ accordion (→ `FAQPage` schema)
8. Visible "Last updated" line

### 6.1 Intersection cards

Each of the 25 cards is **fully server-rendered** — rank, street names, headline injury-crash count, and severity/mode badges are present and readable with JavaScript disabled. This is the core requirement for AEO/GEO citability: a JS-only map or JS-only card content is invisible to the audience that goal exists for.

Each card contains a native `<details>/<summary>` panel (no JS required, inherently accessible, crawlable) that expands to show:
- Full severity breakdown (killed / severe injury / total injured)
- Dominant collision type and PCF violation category
- Mode flags with icons (per existing icon-name reference in `CLAUDE.md`)
- HIN badge or jurisdiction note
- CTA: "Hurt in a crash here? Get a free case review" → links to `get-started` with `?source=intersection-map&intersection=<slug>`, paired with a GA4 event mirroring the existing `phone_click` pattern

### 6.2 Map ↔ card interaction (progressive enhancement only)

- Clicking a map pin scrolls to and opens that intersection's card panel.
- Opening a card panel highlights its pin.
- This is the only JavaScript-dependent behavior on the page. Without it, the map and the card list are two independently complete views of the same data.

## 7. Why single page, not per-intersection sub-pages

Originally designed as hub + 25 sub-pages (one URL per intersection, each with its own `Place`/`GeoCoordinates` schema). Reconsidered and rejected in favor of the single-page design above.

**What sub-pages would have bought:** long-tail queries like "vermont ave and manchester ave accident lawyer," and a stronger AEO answer surface for hyper-specific intersection questions.

**What they cost:** 26 files across two builds to keep in sync (a generator script, not hand-written HTML, would have been required), backlink equity split 26 ways instead of concentrated on one URL, and real doorway-page risk — 25 templated pages differentiated mainly by data-driven text is a pattern Google penalizes, and while each page would have carried genuinely distinct crash data (not filler), it's a line worth staying conscious of rather than assuming clear of.

The lead-gen case for sub-pages ("someone finds their exact corner and calls") was initially weighted too heavily — that's plausibly a low-volume conversion path compared to the hub page simply ranking well with a visible phone number. The `<details>` panel + tracked CTA link (§ 6.1) captures the same per-intersection specificity and conversion signal without the maintenance and doorway-page exposure.

**Reopening this decision:** if the single page earns links/traffic and specific intersections show meaningful CTA click volume (trackable via the `intersection` query param), sub-pages for the highest-performing entries become a cheap, data-justified phase 2. Nothing in § 2–5 (data pipeline, methodology) changes if that happens — only § 6 (page structure) would be extended.

## 8. Schema (JSON-LD)

Single page carries:
- `LegalService` (standard block per `CLAUDE.md`)
- `BreadcrumbList`
- `FAQPage`
- `Dataset` — describing the crash dataset itself (source: TIMS/SWITRS, spatial coverage, date range, methodology link). Underused schema type, unusually strong for AI-answer-engine citation of data-backed pages.
- `HowTo` — the "what to do if you were hurt here" playbook, already structured as ordered steps
- `dateModified` on the top-level schema block, plus the matching visible "Last updated" line in § 6 — closes a sitewide gap flagged in `AEO-GEO-GUIDE.md` § 2.

## 9. Repo layout and build process

```
data/raw/tims-la-county-YYYY-YYYY.csv   committed CSV export (user-provided)
data/intersections.json                  derived source of truth
data/hin.geojson                         LADOT High Injury Network, trimmed to LA County bounding box
scripts/build-intersections.mjs          CSV + HIN geojson → intersections.json
scripts/build-page.mjs                   intersections.json + HTML template → dangerous-intersections-los-angeles.html
```

`data/` and `scripts/` are added to `.assetsignore` so they never ship via `wrangler deploy`.

Annual refresh process: export new CSV from TIMS → `node scripts/build-intersections.mjs` → `node scripts/build-page.mjs` → review diff → commit → deploy.

**Astro sync:** `src/pages/dangerous-intersections-los-angeles.astro` imports `data/intersections.json` directly at build time (via a relative import or a copy step into `src/data/`) rather than requiring its own generator — a dynamic route reading the same JSON can't drift from the static page's data by construction. No `Place`/`GeoCoordinates` sub-page schema needed on the Astro side either, since sub-pages are deferred (§ 7).

## 10. Internal linking and sitemap

- Linked from: homepage, `personal-injury-lawyer-los-angeles.html` (and other city hub pages where relevant), and each practice page whose crash type appears meaningfully in the ranked data (car accident, pedestrian, motorcycle, DUI, truck).
- Links out to: every practice page matched by an intersection's dominant collision type/mode flags (§ 6.1), plus `get-started` via the tracked CTA.
- Added to `sitemap.xml` with current `lastmod` on ship, and on every annual refresh.

## 11. Performance

- Map: Leaflet + OSM tiles, self-hosted Leaflet JS/CSS (no CDN dependency per existing site pattern of avoiding third-party script reliance beyond fonts).
- No hero photographic image — matches existing site-wide pattern of CSS-gradient-only heroes; the map is the visual anchor instead.
- Map JS loads at bottom of `<body>`, deferred, never blocks rendering.
- Card list and methodology text render server-side regardless of map load state.

## 12. Open items for implementation

- Exact TIMS export must be performed by the user (account-gated, cannot be automated by Claude). Field list and filters are specified in § 2.
- LADOT HIN GeoJSON download and trim-to-county-bounds is a one-time task during implementation.
- Practice-page matching rules (which `TYPE_OF_COLLISION`/mode-flag combination routes to which existing practice page) need an explicit mapping table, to be built during implementation from the existing practice-page list.
