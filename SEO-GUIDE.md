# SEO Guide — Law Dog Site

Reference detail for the checklist in `CLAUDE.md` § "Automatic Checks → 1. Per-Page SEO Basics" and § "4. Internal Linking". This file covers *why*, the full checklist, per-page-type notes, and known site-specific issues. Read `CLAUDE.md` first for the condensed version applied automatically to every page.

This guide covers classic search engine optimization — ranking in Google/Bing organic results. It is the counterpart to `AEO-GEO-GUIDE.md`, which covers getting cited by AI answer engines (ChatGPT, Perplexity, AI Overviews). The two overlap heavily (clean headings, structured data, freshness all help both) but the audience and mechanism differ: SEO optimizes for a crawler that ranks a list of links a human then clicks; AEO optimizes for a model that extracts and paraphrases an answer without a click. Treat them as complementary checklists, not duplicates.

Adapted from the equivalent guide used on the USIA immigration-law site (`/Users/frpo/Desktop/USIA Site/SEO-GUIDE.md`) — same underlying SEO principles, re-grounded in Law Dog's actual site structure and current state (audited 2026-07-01, see "Known site-specific issues" below).

---

## 1. Crawlable & Indexable — can Google reach and index the page

- **No `robots.txt` currently exists at the site root.** This is an open gap, not a "verify it still says X" check like USIA's guide — Law Dog needs one created. Minimum viable content: `Allow: /` plus a pointer to `sitemap.xml`. See "Known site-specific issues" below.
- `sitemap.xml` exists and is current for the 15 practice/city pages, but is missing several live utility pages (see gaps below). Every live page needs a listing with the real, live URL and an accurate `lastmod` — not a copy-pasted date from another page.
- **Canonical tags must match the site's actual URL form: full `.html` extension, matching the live URL exactly.** Unlike USIA (which strips `.html` via a Worker redirect), Law Dog's Cloudflare Worker (`workers/intake.js`) only intercepts `POST /api/intake` — everything else falls straight through to static assets with no rewrite. **Do not write extensionless canonicals or internal links on this site** — there is no redirect to back them up, and an extensionless `href` will 404. This is the single biggest transferable-guide trap: don't copy USIA's "always drop `.html`" rule here, it's actively wrong for this site's current infrastructure.
- No accidental `noindex` — spot-check with `grep -r 'noindex' *.html` after any batch of edits.
- One canonical URL per piece of content — no near-duplicate pages competing for the same query. The city pages (`personal-injury-lawyer-los-angeles.html`, `personal-injury-lawyer-hollywood.html`, and future city pages per `ROADMAP.md` Phase 4) are the highest-risk area for this — each needs genuinely distinct local content (unique intro, real local crash-data callouts, real neighborhood/hazard detail), not a template with the city name swapped.
- Static HTML with no client-side rendering means Googlebot always sees full content on first crawl — a structural advantage of this site. Don't undermine it by moving body copy into a JS-rendered widget.

## 2. On-Page — titles, meta, headings, URLs

- **Title tag:** unique per page, ≤ 60 characters (measure in actual characters — `echo -n "..." | wc -m`, not bash's `${#var}`, which miscounts multi-byte characters like `&amp;` entities and em dashes), primary keyword near the front, ends with `| Law Dog`. Example from `car-accident-lawyer-los-angeles.html`: `Car Accident Lawyer Los Angeles | No Fee Unless We Win | Law Dog` (64 chars — itself over the limit, see known issues).
- **Meta description:** unique, **140–160 characters.** This is the single most common failure on this site — a 2026-07-01 audit found **22 of 24 live pages outside the 140–160 window**, nearly all running long (170–241 chars). Compress, don't truncate: cut filler words and restate the value prop tighter rather than chopping the sentence at 160 and leaving it hanging. Batch this work by page type (practice page vs. city page vs. utility page) so the tone stays consistent within a batch.
- **One `<h1>` per page**, contains the primary keyword, matches search intent for that URL. `get-started.html` currently has **zero** `<h1>` tags anywhere in the page — real gap, needs one added to the intake form's opening section.
- **Heading hierarchy H1 → H2 → H3, never skipping a level.** Not yet systematically audited across all 24 pages — spot-check with `grep -c '<h[1-6]' [file]` before a content pass and manually confirm no level is skipped, especially around type-grid / practice-area card sections (a common failure pattern on sites with visual card grids is styling section headers as `<h3>` directly under the `<h1>` hero with no `<h2>` wrapper).
- **Clean, descriptive URLs** in the `[practice-type]-lawyer-los-angeles.html` / `personal-injury-lawyer-[city].html` pattern already established (see `CLAUDE.md` § URL Naming Convention). Keyword-relevant slugs — already the convention here, keep it. (Note: these retain `.html`, unlike USIA's extensionless convention — see § 1 above.)
- `alt` text on every image, descriptive of actual content ("Law Dog logo", not "photo" or "img1"). Spot-checked on `index.html` — currently fine (2 images, both correctly described). This is also an accessibility requirement, not just SEO.
- **Open Graph tags** (`og:title`, `og:description`, `og:image`, `og:url`) should be present on every page. `index.html` is missing `og:image`; `get-started.html` is missing all four OG tags. See known issues below.

## 3. Content Quality & Search Intent

- **Match content depth to intent.** A "car accident lawyer Los Angeles" query wants a direct value-prop overview with clear next action; a "what to do after a car accident" informational query (if/when Law Dog builds informational content — currently none exists) wants the enumerated step-by-step answer. Don't bury the direct answer — this matters for SEO snippet eligibility as much as it does for AEO extraction (see `AEO-GEO-GUIDE.md` § 2, same underlying rule).
- **No thin content.** Practice pages already run substantial (types-grid, playbook steps, injuries grid, tactics section, compensation categories, results, FAQ) — keep new practice/city pages at this depth, not a stripped-down version.
- **No duplicate/near-duplicate content**, especially across city pages. Two city pages differing only in a swapped city name and boilerplate paragraph will cannibalize each other in search results — Google picks one to rank and suppresses the other, or ranks neither well. Each city page's neighborhood/hazard/local-stats sections exist specifically to inject genuinely city-specific content (see the Hollywood page's "Hollywood's specific injury landscape" section as the model) — don't let future city pages ship as a template with only the H1 and city name changed.
- **Keyword cannibalization within the main site.** Before creating a new page, check that an existing page doesn't already target the same primary query. Specific risk on this site: the practice-area sub-pages listed as `[ ]` to-build in `ROADMAP.md` Phase 3 (e.g. `head-on-collision-lawyer-los-angeles.html` vs. the "Head-On Collisions" card already living inside `car-accident-lawyer-los-angeles.html`) — when a sub-page ships, the parent page's card should link to it and stop trying to rank for that exact long-tail term itself.
- **Search-intent variety across page types**: a city hub page (`personal-injury-lawyer-los-angeles.html`) should target the broad local navigational query ("personal injury lawyer los angeles"); a practice page should target the practice-specific transactional term ("car accident lawyer los angeles"); a sub-page should target the narrower long-tail term ("head-on collision lawyer los angeles"). Don't let a sub-page and its parent practice page target the identical primary keyword.

## 4. Internal Linking

- Every new page linked from at least one existing relevant page — no orphans. `law_dog_premium.html` and `law_dog_premium copy.html` are unlinked local drafts, but this is not a live indexing risk — both are already excluded from deployment via `.assetsignore`, so they never reach getlawdog.com. If they're stale drafts no longer needed, delete them from the repo; otherwise leave as-is.
- Descriptive anchor text always — never "click here" or "learn more" with no context. Anchor text is a ranking signal for the linked page's target keyword. Already the pattern in practice-area card grids (`.type-title` text doubles as the link's semantic anchor).
- Every new practice/city page must also be added to: the homepage practice-area grid, the sibling nav dropdown/footer links on every other practice page, and `sitemap.xml` — per the existing pattern established when the Hollywood city page shipped (see git history for the commit that wired Hollywood in everywhere).
- Link to official external sources (CA courts, `courts.ca.gov`, `leginfo.legislature.ca.gov` for cited Civil Code / CCP / Gov. Code sections) with `rel="noopener noreferrer"` where a citation is made in body copy — currently statute citations exist as plain text (e.g. "Civil Code § 1431.2") without a link. Low priority per USIA's own experience but a real, cheap trust-signal upgrade worth doing incrementally.
- Avoid orphaning old content when adding new pages that supersede it — if a new sub-page covers a topic better than a card inside a parent practice page, update the parent card's `href` to point at the new sub-page (this is already the established pattern per `ROADMAP.md` Phase 3 notes, e.g. "Commercial Truck Collisions → link to existing truck page *(wire the grid item)*").

## 5. Technical / Performance

Overlaps with `CLAUDE.md` § 3 performance rules. The SEO-specific reason these matter: Core Web Vitals (LCP, CLS, INP) are a direct Google ranking factor, not just a UX nicety.

- Largest Contentful Paint (LCP) — the hero background image/gradient on practice and city pages. If a future page adds a real photographic hero image (vs. the current CSS-gradient-only hero), it must load eagerly with `fetchpriority="high"`, no `loading="lazy"`, and be reasonably compressed.
- Cumulative Layout Shift (CLS) — any image added below the fold needs explicit `width`/`height` attributes so the browser reserves space before the image loads.
- Mobile viewport must never include `user-scalable=no` — already correctly set to `width=device-width, initial-scale=1.0` sitewide per the existing pattern, keep it that way on every new page.
- No new font families/weights beyond `Plus Jakarta Sans` (400/500/600/700/800) + Material Symbols Outlined — extra font requests are a common unnecessary LCP/CLS regression when someone adds a page and imports "just one more" Google Fonts weight. See `CLAUDE.md` § Icons for the Material Symbols requirement — icons are the one approved font addition, already sitewide.

---

## Known site-specific issues (from the 2026-07-01 audit)

Real findings from a spot audit run while writing this guide — grep-based, not exhaustive. Check this list before doing a fresh full audit; some items are cheap one-line fixes, others need a batch pass.

- **Fixed 2026-07-01 — `robots.txt` created** at site root, allows `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `OAI-SearchBot`, points at `sitemap.xml`.
- **Fixed 2026-07-01 — `llms.txt` created**, groups all 25 live pages by category with a one-line description each.
- **Fixed 2026-07-01 — meta descriptions rewritten to 140–160 chars** across all 24 practice/city/utility pages that were previously out of range, batched by page type with per-batch approval.
- **Fixed 2026-07-01 — titles rewritten to ≤60 chars** across the same 24 pages. Phrasing was varied (city-first, "LA" abbreviation, "serving LA") instead of repeating "[X] Lawyer Los Angeles" verbatim on every page — see per-page titles in the current HTML.
- **Fixed 2026-07-01 — `get-started.html`**: added a visually-hidden `<h1>` (page is fully JS-rendered, no static heading existed) plus all 4 OG tags and twitter card tags.
- **Fixed 2026-07-01 — `index.html`**: added missing `og:image` and `twitter:image`.
- **Fixed 2026-07-01 — `privacy-policy.html` and `terms.html`**: added `LegalService` + `BreadcrumbList` JSON-LD (both still carry `noindex, follow`, so this is a consistency fix, not a ranking lever).
- **Fixed 2026-07-01 — `personal-injury-lawyer-los-angeles.html` and `law_dog_personal_injury.html` de-duplicated.** Both previously shared a near-identical title ("Personal Injury Lawyer Los Angeles | No Fee Unless We Win | Law Dog") and competed for the same query. Retitled `law_dog_personal_injury.html` to "Personal Injury Practice Areas | Law Dog" to reflect its actual role as the case-type overview hub, distinct from the LA city page.
- **Not a live risk — `law_dog_premium.html` and `law_dog_premium copy.html`** are unlinked local drafts, but `.assetsignore` already excludes both from deployment, so they never reach getlawdog.com or get crawled. Safe to delete from the repo if no longer needed, purely as housekeeping.
- **Fixed 2026-07-01 — sitemap.xml completed.** Added the 9 missing live pages (`get-started.html`, `dog-bite-lawyer-los-angeles.html`, `dui-accident-lawyer-los-angeles.html`, `head-on-collision-lawyer-los-angeles.html`, `multi-vehicle-accident-lawyer-los-angeles.html`, `spinal-cord-injury-lawyer-los-angeles.html`, `traumatic-brain-injury-lawyer-los-angeles.html`, `privacy-policy.html`, `terms.html`) — 16 → 25 entries. **Re-audit against `ls *.html` on every future deploy** — this will drift again as new pages ship.
- **Not yet audited — heading hierarchy (H1→H2→H3 skip check) across all pages.** Still flagging as unknown; the 2026-07-01 pass touched titles/descriptions/schema/links, not heading structure. Do a real pass with `grep -c '<h[1-6]'` before relying on this being fine.
- **Process note — this guide intentionally does NOT carry over USIA's "extensionless clean URLs" rule.** Law Dog's Worker has no URL-rewrite layer; every canonical, `og:url`, internal `href`, and sitemap `<loc>` on this site correctly uses the full `.html` form and should keep doing so unless a future infrastructure change adds a redirect layer (in which case this guide and every canonical/link on the site would need a coordinated migration, not a piecemeal one).

---

## Per-page-type quick reference

| Page type | Priority SEO checks first |
|---|---|
| Homepage (`index.html`) | H2 structure under hero — everything else (og:image, meta description length) fixed 2026-07-01 |
| Practice pages (`*-lawyer-los-angeles.html`) | Title/description length fixed 2026-07-01 — for new pages, keep title ≤60 chars and description 140–160, canonical matches live `.html` URL exactly |
| City pages (`personal-injury-lawyer-[city].html`) | Genuinely unique local content per city (highest cannibalization risk on the site as more cities ship), correct `BreadcrumbList` trail (Home → [City], or Home → [Parent City] → [Neighborhood] once sub-city pages exist) |
| Sub-pages (dog bite, DUI, spinal cord, etc.) | No keyword overlap with the parent practice page's card describing the same topic — update parent card `href` once sub-page ships |
| `get-started.html` | H1 + OG tags fixed 2026-07-01 — heading hierarchy inside the JS-rendered form still not systematically audited |
| `privacy-policy.html` / `terms.html` | JSON-LD added 2026-07-01; still low priority for ranking since both carry `noindex` |

---

## Validation

There's no dedicated SEO linter in this repo. After a batch of pages or edits, spot-check with:

- `grep -c '<h[1-6]' [file]` to sanity-check heading counts and manually confirm no level is skipped
- A character count on title and meta description (`echo -n "..." | wc -m`, not `${#var}`) before committing
- `grep -rl '<link rel="canonical"' *.html` to confirm every live page has one, and that it matches the live `.html` URL exactly (no accidental extensionless canonical copied from another project's pattern)
- Confirm every canonical / `og:url` / sitemap `<loc>` for a page agrees on the exact same URL, including the `.html` extension
- Cross-check `sitemap.xml` against the actual file listing (`ls *.html`) periodically — pages get built and forgotten from the sitemap (see known issues above)
- Once Google Search Console is connected for getlawdog.com, pull actual impressions/clicks/position data for target queries — the checklist above is a proxy for ranking; real query performance is the ground truth and should steer which pages get revisited first
