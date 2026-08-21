# AEO/GEO Guide — Law Dog Site

Reference detail for the checklist in `CLAUDE.md` § "Automatic Checks → 5. AEO/GEO Basics". This file covers *why*, the full checklist, per-page-type notes, and which findings from third-party AEO/GEO scanners are noise. Read `CLAUDE.md` first for the condensed version applied automatically to every page.

AEO (Answer Engine Optimization) = getting cited/quoted by ChatGPT, Perplexity, Google AI Overviews. GEO (Generative Engine Optimization) = the same goal from the academic/marketing framing. Both care about the same underlying things: can a crawler reach the page, can a model extract a clean answer from it, and can the model trust the source enough to attribute it. Treat them as one checklist.

Adapted from the equivalent guide used on the USIA immigration-law site (`/Users/frpo/Desktop/USIA Site/AEO-GEO-GUIDE.md`) — same underlying AEO/GEO principles, re-grounded in Law Dog's actual site structure and current state (audited 2026-07-01).

---

## 1. Crawlable — can AI bots reach and index the page

- HTTPS, no `noindex`, canonical tag present — spot-check with `grep -r 'noindex' *.html` per `SEO-GUIDE.md` § validation.
- **`robots.txt` does not currently exist at the site root — this is a real, open gap.** Once created (see `SEO-GUIDE.md` § known issues), it must explicitly allow `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `OAI-SearchBot` — don't ship a `robots.txt` that only covers the default `User-agent: *` without checking it doesn't accidentally net one of these under a broader disallow rule later.
- `sitemap.xml` current — every new page's `.html` URL added with a current `lastmod`. Per `SEO-GUIDE.md` § known issues, several already-built pages are currently missing from the sitemap — fix that gap before treating this rule as satisfied going forward.
- **`llms.txt` does not currently exist — real, open gap.** Once created, it should list every live page grouped by category (practice pages, city pages) with a one-line description each, kept in sync whenever a new page ships. A stale or missing `llms.txt` actively under-informs AI crawlers about what's on the site; on a site this size (24 pages) it's a cheap, high-leverage file to create and maintain.
- **`ai.txt`** — optional signal, not present. Low effort, low but nonzero value: declares AI usage/training permissions at the root, same idea as `robots.txt` but AI-specific. Consider adding once `robots.txt` and `llms.txt` are in place — sequence those two first, they matter more.
- Static HTML with no client-side rendering means content is always crawlable without executing JS — a structural advantage of this site. Don't undermine it by moving body content into a JS-rendered widget.

## 2. Citable — can a model extract a clean, quotable answer

- **300+ words minimum, 1,000+ words is the target for anything meant to be citation-worthy.** Practice pages already run well past this (intro + fact card + types grid + playbook + injuries/hazards grid + tactics + compensation + why-us + results + statute + FAQ + service area = several thousand words). Keep new practice/city/sub-pages at this depth — don't ship a stripped-down 400-word version just to check the box that a page exists.
- **Answer-first structure**: open major sections with a direct, self-contained answer sentence before elaborating. The FAQ sections already do this well (e.g. "Two years from the date of the accident under California Code of Civil Procedure § 335.1." opens the SOL answer directly). Extend the same discipline to non-FAQ section intros — e.g. the intro-copy `<h2>` + first `<p>` on practice pages should lead with the direct claim, not a scene-setting lead-in.
- **Question-style headings** for FAQ-shaped content: `"What is..."`, `"How long..."`, `"Can I..."`. Already the established pattern in every practice/city page's FAQ accordion — keep it exactly as-is when adding new FAQ items.
- **Lists and tables** over prose paragraphs wherever content is enumerable. Already a strong pattern on this site: `.type-grid` (accident/injury types), `.comp-grid` (damages categories), `.fact-card` rows (legal facts), `.court-list` (courthouses on the LA city page). Keep using these structured components for new enumerable content rather than regressing to prose paragraphs.
- **Freshness signal, two places at once:**
  - `dateModified` in JSON-LD — **not currently present in any page's `LegalService` block on this site.** This is a real, sitewide gap worth closing incrementally (add to the standard schema block, see `CLAUDE.md` § JSON-LD Schema).
  - A **visible** "Last updated" date in the rendered body — not currently present anywhere on the site. Lower priority than the JSON-LD `dateModified` field for now since legal-service pages (unlike immigration guides with volatile processing times) don't go stale as fast content-wise, but worth adding once statute-citation or results content is updated so readers can see it's current.
  - Stale content is measurably deprioritized by AI citation — this is one of the highest-leverage cheap fixes available once implemented.
- Keep paragraphs short (roughly 40–80 words). The `.intro-copy p` and `.step-body p` blocks already trend this way — maintain the discipline in new copy.

## 3. Structured — machine-readable page architecture

- **Heading hierarchy is non-negotiable**: H1 → H2 → H3, minimum 2 H2 sections per page, never skip a level. Per `SEO-GUIDE.md`, this has not yet been systematically audited across all 24 pages — do a real check with `grep -c '<h[1-6]'` before assuming it's clean. `get-started.html` in particular has zero `<h1>` currently — that's a structural gap, not just an SEO nicety.
- JSON-LD per the table in `CLAUDE.md` § JSON-LD Schema — practice and city pages already carry `LegalService` + `BreadcrumbList` + `FAQPage`, which satisfies most "Structured" pillar checks. `index.html` currently only carries `LegalService` (no `BreadcrumbList`/`FAQPage` — reasonable for a homepage with no meaningful hierarchy above it and no FAQ accordion). `privacy-policy.html`/`terms.html` currently carry **zero** JSON-LD — low priority (not citation targets) but a cheap consistency fix.
- `BreadcrumbList` — required on every practice/sub-page and city page per the existing pattern (`Home → Personal Injury → [Page]` for practice pages, `Home → Los Angeles → [City]` for sub-city pages once they exist); **optional and low-value on the homepage** — don't force it there just to satisfy a scanner.
- `Speakable` schema — optional, marks sections for voice assistants. Not worth retrofitting across the whole site; consider only for the highest-traffic pages (homepage, car-accident page — the flagship practice area) if voice/assistant traffic ever becomes measurable.
- Alt text: must be descriptive of content, not decorative filler. Spot-checked on `index.html` — currently fine. AEO scanners verify coverage %, not quality — write real alt text regardless of what a scanner checks.

## 4. Authoritative — internal + external trust signals

- **Internal links**: 3+ contextual body links (not nav/footer) already the pattern on practice pages — the intro-copy section links to `#faq` and `get-started.html` inline, and the type-grid cards link to sibling practice/sub-pages. Keep that pattern on new pages.
- **Fixed 2026-07-01 — external citations.** The first occurrence of each unique statute (Civil Code § 1431.2, CCP § 335.1, Gov. Code § 911.2, Veh. Code § 21950, Civil Code § 3342, and others) on every practice/city page now links to the real `leginfo.legislature.ca.gov` section text — 71 links across 20 pages, script-applied and spot-checked. Repeat mentions of the same statute on a page are intentionally left as plain text (linking every instance would look spammy); only the first mention per unique statute per page is linked. `courts.ca.gov` links for procedural claims (which courthouse, filing process) are still not present — lower priority, worth adding if/when procedural content expands.
- **Author/entity JSON-LD**: this site has no article/blog content (unlike USIA's `commentary.html` articles), so the `BlogPosting.author` pattern doesn't apply here. The entity signal for every page is the `LegalService` block itself — already present and correct on every live practice/city page.
- **Author bio linking**: not applicable — no attorney bio pages exist yet. If/when Law Dog adds attorney bio pages (not currently in `ROADMAP.md`), this becomes relevant and should follow the same pattern USIA uses (byline → linked anchor with `rel="author"`).
- **Social profile links** — optional. Only add if the firm has real, maintained social profiles; a dead or unbranded social link is worse than none.

## 5. Verifiable — can AI confirm this is a real, accountable entity

- **`Organization` schema** — the current `LegalService` block uses a single `"@type": "LegalService"` (not a dual-type array). Per USIA's own experience, `LegalService` is already a schema.org subtype of `Organization` (LegalService → ProfessionalService → LocalBusiness → Organization), so this is likely fine for a semantic parser — but literal-string-matching scanners may flag it. Cheap fix if chasing the scanner check: change to `"@type": ["LegalService", "Organization"]` on the standard block. Do not create a second, separate `Organization` JSON-LD block — one entity, one block, multiple types.
- **About page linked** — **currently no dedicated "About Law Dog" / firm-overview page exists.** `law_dog_personal_injury.html` covers firm differentiators (`#why-law-dog` section) but isn't a standalone about page, and isn't linked from nav as "About." This is a real gap worth flagging, distinct from USIA's false-positive case (where an about page exists under a different URL) — Law Dog genuinely doesn't have one yet.
- **Contact info accessible** — already satisfied. Phone `(833) 4LAWDOG`, address `515 Flower St, Los Angeles, CA 90071`, email `hello@getlawdog.com` all present in footer and `LegalService` schema on every live page.
- **Privacy/terms linked** — already satisfied (`privacy-policy.html`, `terms.html` in footer on every page).
- **Visible publication/update date in body** — not currently present anywhere (same gap as § 2 freshness signal above). Don't treat as a separate task — solving the `dateModified`/"Last updated" gap in § 2 solves this too.

---

## What third-party AEO/GEO scanners get wrong (don't chase these blindly)

Carried over from USIA's guide — the underlying logic applies to any `LegalService`-schema site, verify against Law Dog's actual markup before acting:

1. **"No Organization JSON-LD detected"** — `LegalService` is a schema.org subtype of `Organization`. Scanners doing literal `@type` string matching miss this. Real fix if wanted cheaply: add `Organization` as a second value in the `@type` array (see § 5 above), not a whole new block.
2. **"No author bio link"** — doesn't apply to this site; there's no article/blog content with individual authorship. Don't force a fake `Person` author onto practice or city pages.
3. **BreadcrumbList / Speakable / social links flagged as failures** — most scanners mark these "optional" themselves. Treat them as such; don't burn effort forcing breadcrumbs onto the homepage or inventing social profiles.

## What scanners typically miss entirely (worth doing anyway)

- **Entity consistency**: use the same name for a practice area across every page that mentions it (e.g. always "Premises Liability" on first mention in a given context, not alternating "premises liability," "property liability," and "premises negligence" within the same page). Models cite more confidently when an entity is named consistently.
- **`sameAs` links to Wikidata/authoritative references** for city/neighborhood entities — the LA and Hollywood city pages already do this pattern in `areaServed` (`{"@type": "City", "name": "Los Angeles"}` / `{"@type": "Neighborhood", "name": "Hollywood"}`). Consider adding `sameAs` Wikidata URLs to these as more city pages ship, following USIA's `locations/` pattern.
- **No fake review/rating schema.** Don't add `AggregateRating` or `Review` schema without real, collected reviews.
- **Avoid thin/duplicate content across city pages** as more ship per `ROADMAP.md` Phase 4 (Koreatown, Silver Lake, Echo Park, Burbank, Glendale, Pasadena, Woodland Hills, Van Nuys, Long Beach, Torrance, Inglewood, Compton, Santa Monica, Culver City, Anaheim, Santa Ana, Irvine, Orange remain to build). AI models penalize near-duplicate pages for citation purposes even more than classic SEO does — each city page needs genuinely city-specific hazard/neighborhood/local-stat content, following the Hollywood page's model, not a template swap.
- **`HowTo` schema** — worth adding to the "What to do after a crash / injury" playbook sections already present on every practice page (numbered `.step-item` list) — this content is already structured as ordered steps and is a strong `HowTo` schema candidate that doesn't exist yet. Genuinely worth prioritizing since the content is already written in the right shape.
- **Testing against the real thing**: periodically ask ChatGPT/Perplexity a target query ("best car accident lawyer in Los Angeles" or "who should I call after a hit and run in LA") and see whether/how this site gets cited. Scanner scores are a proxy; actual citation behavior is the ground truth.

---

## Per-page-type quick reference

| Page type | Priority AEO/GEO gaps to check first |
|---|---|
| Homepage (`index.html`) | `dateModified` in schema (sitewide gap) — og:image fixed 2026-07-01; consider adding an "About" nav link once that page exists |
| Practice pages (`*-lawyer-los-angeles.html`) | `dateModified` (sitewide gap), `HowTo` schema candidate on the playbook section — statute citation links fixed 2026-07-01 |
| City pages (`personal-injury-lawyer-[city].html`) | Entity consistency, no boilerplate duplication as more cities ship, `areaServed.sameAs` (not yet added anywhere) |
| Sub-pages (dog bite, DUI, spinal cord, etc.) | Same priorities as practice pages — `dateModified`, HowTo schema candidate |
| `get-started.html` | H1 + OG tags fixed 2026-07-01 |
| `privacy-policy.html` / `terms.html` | Low priority — not citation targets; JSON-LD added 2026-07-01 for consistency |

---

## Validation

There's no automated AEO/GEO validator in this repo — it's not purely mechanical. After a batch of pages, spot-check with:

- Word count + heading count via a quick `grep -c '<h2'` / word-count pass on the page
- Manual read of the first 1–2 sentences of each major section for "does this stand alone as an answer"
- `grep -c 'leginfo.legislature.ca.gov'` across a page to confirm statute citations are linked — should be non-zero on any page citing a statute (fixed sitewide 2026-07-01, see § 4 above)
- Periodically ask ChatGPT/Perplexity a target local-injury-law query and check whether/how getlawdog.com gets cited — the checklist above is a proxy; actual citation behavior is the ground truth and can diverge from it
