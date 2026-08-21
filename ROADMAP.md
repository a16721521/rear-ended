# Law Dog — Build Roadmap

> Last updated: 2026-07-05 (Phase 2: verified extensionless-URL migration complete sitewide, added GA4 phone_click tracking, ported Astro project's design foundation + homepage to the live brand, resolved practice-area scope mismatch, built `/get-started/` in Astro, added Astro-sync guidance to `CLAUDE.md`).

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · **P0** blocker · **P1** high · **P2** medium · **P3** later

---

## Architecture

Two parallel builds in this repo:

| | Static HTML site (live) | Astro programmatic build (`src/`) |
|---|---|---|
| Domain | **getlawdog.com** (Cloudflare Worker + static assets) | lawdogla.com (stale) |
| Pages | 15 practice + 2 city pages + get-started + utility (17 total) | 9 practice × 39 city ≈ 354 pages + `/get-started/` + `/learn/` |
| Phone | **(833) 4LAWDOG** | (213) 555-0100 *(placeholder — needs update)* |
| Brand | Plus Jakarta Sans, black/white + gradient | Playfair/Barlow, paper/rust *(wrong)* |

**Target end state:** one domain (getlawdog.com), one codebase (Astro), one brand (gradient identity), every sub-page built, claims a bar auditor would sign off on.

---

## Phase 0 — Stop the bleeding · **P0**

- [x] Wire intake form to real endpoint — `workers/intake.js` handles `POST /api/intake`, sends formatted email via Workers Email binding
- [x] Tappable phone numbers + sticky mobile call bar on all pages
- [x] Mobile hamburger nav on all pages
- [x] Stop shipping working directory — `.assetsignore` excludes node_modules, dist, src, Mockups, Images, markdown, build config
- [x] **Resolve 403 to crawlers.** Verified 2026-07-03 via curl with Googlebot UA, a generic bot UA, and default UA against getlawdog.com — all return 200 with real HTML content, no Cloudflare challenge page. No bot blocking. (Note: full Search Console crawl-stats confirmation still worth doing once GSC access exists, but the direct test found no block.)

---

## Phase 1 — Legal & trust floor · **P0 compliance**

- [ ] **Verify or remove every claim.** Confirmed still live on `index.html` as of 2026-07-03: `$47M+` recovered, `98%` success rate, `300+` cases resolved (metrics section), six specific case results ($6.1M premises liability, $4.2M car accident, $3.1M motorcycle, $2.4M slip & fall, $1.4M wrongful death, $1.1M rideshare), and the "As seen in" press strip (LA Times, KCRW, Daily Journal, NBC LA, LAW360). None of these can be verified from the repo — needs the firm to confirm documentation exists or decide on removal/placeholder language. Flagged 2026-07-03, deferred pending owner decision.
- [~] **Add required identity info.** Office address added sitewide (515 Flower St, LA 90071) in all JSON-LD schemas. Responsible attorney name(s) and bar number(s) still needed — CA advertising rules require identifiable lawyer + bar number.
- [x] Privacy Policy + Terms pages — live, linked in footer
- [x] Attorney disclaimer in footer on all pages
- [ ] **Attorney bio pages** with photos, credentials, bar numbers (E-E-A-T + trust signal)
- [~] **Google Business Profile** — name, address (515 Flower St), phone ((833) 4LAWDOG), business description, and services list all ready. Profile registration pending. Gradient SVG exported for Figma.

---

## Phase 2 — Site structure · **P1**

- [~] **Port static design into the Astro project.** The Astro project (`src/`) is a real, working scaffold — dynamic `[practice]/[city].astro` routes generating 314 pages from genuinely researched `data/cities.json`/`data/practice-areas.json` (real courthouses, trauma centers, dangerous corridors), plus Nav/Footer/Schema components and a `/learn/` content collection. It was on the wrong brand entirely (Playfair Display + Barlow Condensed + acid-green/paper-rust palette). **Done 2026-07-05:** ported the foundation (`global.css`, `Nav.astro`, `Footer.astro`, `BaseLayout.astro`, all 4 practice/city/learn templates) to the live gradient/Plus Jakarta Sans brand — see prior entry for detail. **Also done 2026-07-05: rebuilt `pages/index.astro` (homepage) from scratch**, replacing the ~1200 lines of bespoke design (custom cursor, magnetic buttons, headline-scramble effect, marquee, embedded contact form) with a faithful port of the live `index.html` homepage — hero, trust strip, metrics, practice-area grid, dark results section, differentiators, final CTA — using the shared `Nav`/`Footer` components plus a new `CallBar.astro` (the sticky mobile call bar existed on every live practice page but was missing from `PageLayout.astro` entirely — added it there too). Verified via full `npm run build` (314 pages, zero errors) and direct inspection of the compiled CSS bundle (correct tokens, zero old-brand leftovers).
  - **Both flagged discoveries resolved 2026-07-05:** (1) Practice-area scope mismatch — confirmed employment law/workers' comp are no longer relevant to this PI-only firm. Removed `employment-lawyer`/`workers-compensation-lawyer` from `data/practice-areas.json` and added the 3 missing live-site categories (`catastrophic-injury-lawyer`, `pedestrian-accident-lawyer`, `premises-liability-lawyer`, each with real FAQs pulled from the corresponding live pages and correct CA statute citations). Astro's data now matches the live site's exact 9 practice areas; updated `index.astro`'s `iconMap` to match. Verified via `npm run build` (354 pages, up from 314). (2) Missing `/get-started/` route — built `src/pages/get-started.astro`, a faithful port of the live 5-step intake wizard (case type → timeline → doctor → symptoms → contact form → confirmation), same dark standalone design (no nav/footer, own gradient/token set), progress bar, and sticky call bar. Preserves the `fetch('/api/intake', ...)` call pattern from the live site, but note: **no working backend exists for this in the Astro/static-output deployment** — the live site's Cloudflare Worker (`workers/intake.js`) only serves the static site. This is a known gap, not silently glossed over — flag it again before ever deploying Astro standalone.
  - `CLAUDE.md` updated 2026-07-05 to require keeping `src/` in sync as the static site's buildout continues (replaced the stale "do not touch `src/`" instruction, which predated Astro becoming an actively maintained scaffold).
  - Still open: `astro.config.mjs` still targets `lawdogla.com`, not `getlawdog.com` — a domain/cutover decision, not made here.
- [~] **One NAP everywhere** — phone updated to (833) 4LAWDOG and address to 515 Flower St sitewide (25 static files) plus the entire Astro project including the homepage (2026-07-05). Still needed: resolve 2 emails (hello@getlawdog.com vs hello@lawdog.com).
- [x] **301 the `.html` URLs** → clean paths. Cloudflare Workers Static Assets serves a 307 redirect from `/page.html` to `/page` by default (confirmed live via curl), and the extensionless URL returns 200 with real content. **Verified 2026-07-05: the full sitewide switch is already done** — every canonical, `og:url`, JSON-LD `url`/`item`/`@id`, sitemap `<loc>`, and internal `href` across all 37 live pages is extensionless, confirmed with a zero-match sweep for any remaining `.html`-suffixed URL in those fields. `CLAUDE.md` § 1 and § URL Naming Convention were still documenting the old (backwards) rule — corrected to match reality.
- [ ] **Fix robots/sitemap mismatch.** `public/robots.txt` points at `getlawdog.com/sitemap.xml`; Astro emits `sitemap-index.xml`. Retire the hand-edited root `sitemap.xml`. *(Not urgent — Astro isn't deployed yet, so this mismatch has no live effect.)*
- [~] **Call tracking (CallRail) + GA4 conversion events.** GA4 half done 2026-07-05: added a `phone_click` event (fires on any `tel:` link click, `page_path` param) sitewide across all 37 live pages, verified firing correctly in-browser with no console errors. CallRail itself still needs an external account/setup — not something doable from the repo alone.

---

## Phase 3 — Practice area sub-pages · **P1 SEO**

All type-grid items currently link to `get-started.html` as placeholders. These need dedicated pages.

### Car Accidents — 3 to build
*(Rear-End, T-Bone, Hit-and-Run, Rideshare already built)*
- [x] `head-on-collision-lawyer-los-angeles.html`
- [x] `dui-accident-lawyer-los-angeles.html`
- [x] `multi-vehicle-accident-lawyer-los-angeles.html`
- [x] Commercial Truck Collisions → link to existing truck page *(wire the grid item)*

### Motorcycle Accidents — 8 of 8 built ✓
- [x] `motorcycle-left-turn-accident-lawyer-los-angeles.html`
- [x] `lane-split-accident-lawyer-los-angeles.html`
- [x] `motorcycle-dooring-lawyer-los-angeles.html`
- [x] `motorcycle-road-hazard-lawyer-los-angeles.html`
- [x] `motorcycle-rear-end-lawyer-los-angeles.html`
- [x] `motorcycle-hit-and-run-lawyer-los-angeles.html`
- [x] `motorcycle-dui-accident-lawyer-los-angeles.html`
- [x] `motorcycle-highside-lowside-lawyer-los-angeles.html`

### Truck Accidents — 8 of 8 built ✓
- [x] `jackknife-truck-accident-lawyer-los-angeles.html`
- [x] `truck-rear-end-lawyer-los-angeles.html`
- [x] `wide-turn-truck-accident-lawyer-los-angeles.html`
- [x] `underride-accident-lawyer-los-angeles.html`
- [x] `truck-tire-blowout-lawyer-los-angeles.html`
- [x] `hours-of-service-truck-accident-lawyer-los-angeles.html`
- [x] `overloaded-cargo-accident-lawyer-los-angeles.html`
- [x] `truck-dui-accident-lawyer-los-angeles.html`

### Slip & Fall — 8 of 8 built ✓
- [x] `wet-floor-slip-and-fall-lawyer-los-angeles.html`
- [x] `sidewalk-trip-and-fall-lawyer-los-angeles.html`
- [x] `inadequate-lighting-injury-lawyer-los-angeles.html`
- [x] `stairway-defect-lawyer-los-angeles.html`
- [x] `parking-lot-accident-lawyer-los-angeles.html`
- [x] `construction-zone-slip-and-fall-lawyer-los-angeles.html`
- [x] `retail-store-slip-and-fall-lawyer-los-angeles.html`
- [x] `apartment-slip-and-fall-lawyer-los-angeles.html`

### Premises Liability — 8 of 8 built ✓
- [x] `negligent-security-lawyer-los-angeles.html`
- [x] `swimming-pool-accident-lawyer-los-angeles.html`
- [x] `dog-bite-lawyer-los-angeles.html`
- [x] `structural-failure-lawyer-los-angeles.html`
- [x] `toxic-exposure-lawyer-los-angeles.html`
- [x] `construction-zone-visitor-injury-lawyer-los-angeles.html`
- [x] `amusement-park-injury-lawyer-los-angeles.html`
- [x] `premises-inadequate-lighting-lawyer-los-angeles.html`

### Catastrophic Injury — 8 to build
- [x] `spinal-cord-injury-lawyer-los-angeles.html`
- [x] `traumatic-brain-injury-lawyer-los-angeles.html`
- [ ] `amputation-lawyer-los-angeles.html`
- [ ] `burn-injury-lawyer-los-angeles.html`
- [ ] `crush-injury-lawyer-los-angeles.html`
- [ ] `vision-hearing-loss-lawyer-los-angeles.html`
- [ ] `anoxic-brain-injury-lawyer-los-angeles.html`
- [ ] `polytrauma-lawyer-los-angeles.html`

### Wrongful Death — 6 to build
*(Fatal Car Accidents → car-accident page, Truck Crashes → truck page already linked)*
- [ ] `workplace-wrongful-death-lawyer-los-angeles.html`
- [ ] `medical-malpractice-wrongful-death-lawyer-los-angeles.html`
- [ ] `premises-wrongful-death-lawyer-los-angeles.html`
- [ ] `defective-product-wrongful-death-lawyer-los-angeles.html`
- [ ] `motorcycle-pedestrian-wrongful-death-lawyer-los-angeles.html`
- [ ] `negligent-security-wrongful-death-lawyer-los-angeles.html`

### Pedestrian & Bicycle — 8 to build
- [ ] `crosswalk-collision-lawyer-los-angeles.html`
- [ ] `pedestrian-hit-and-run-lawyer-los-angeles.html`
- [ ] `distracted-driver-pedestrian-lawyer-los-angeles.html`
- [ ] `turning-vehicle-pedestrian-lawyer-los-angeles.html`
- [ ] `dooring-lawyer-los-angeles.html`
- [ ] `bike-lane-violation-lawyer-los-angeles.html`
- [ ] `school-zone-accident-lawyer-los-angeles.html`
- [ ] `government-vehicle-pedestrian-lawyer-los-angeles.html`

**Total sub-pages: 57 needed · 37 built · 20 remaining**
**Next up:** Catastrophic Injury — `amputation-lawyer-los-angeles.html`, `burn-injury-lawyer-los-angeles.html`

---

## Phase 4 — Content engine · **P1 SEO**

- [ ] **Launch `/learn/`** with 10–15 statute-cited, attorney-bylined guides targeting question queries ("how much is a car accident settlement in California", "CA statute of limitations personal injury"). Never ship the empty hub.
- [~] **Enrich + tier-launch city pages.** Strategy: index ~10 core cities first with unique content before expanding. Built so far (6/10): `personal-injury-lawyer-los-angeles.html`, `personal-injury-lawyer-hollywood.html`, `personal-injury-lawyer-koreatown.html`, `personal-injury-lawyer-silver-lake.html`, `personal-injury-lawyer-echo-park.html`, `personal-injury-lawyer-burbank.html`. Remaining from Tier 1: Glendale, Pasadena, Woodland Hills, Van Nuys, Long Beach, Torrance, Inglewood, Compton, Santa Monica, Culver City, Anaheim, Santa Ana, Irvine, Orange.
- [ ] **Fill `attorneys/` and `settlements/` collections** (currently empty) with verified, disclaimed entries. Noindex hubs until ≥5 entries exist.
- [ ] **Reviews pipeline** (Google/Avvo) feeding `aggregateRating` schema.
- [ ] **Homepage content depth.** Add keyword-bearing H2 intro, on-page NAP block, FAQ section, 600–900 more words.
- [ ] **Footer pages still needed:** About, Team, Blog, Client Portal — build when ready; currently removed from footer.

---

## Phase 5 — Dominance · **P2/P3**

- [ ] **Expand city tiers** as domain authority grows.
- [ ] **Spanish-language versions** — likely the single biggest strategic opportunity in the LA PI market.
- [ ] **Digital PR** around crash-data pages to earn backlinks.
- [ ] **Performance pass:** convert `hero3.jpeg` (1.8MB) → AVIF/WebP + preload (LCP element); replace logo PNGs with SVG; trim/self-host fonts; `loading="lazy"` below fold. Target Lighthouse 95+ mobile.

---

## Done

### Site structure & design system
- [x] Created `styles.css` — shared design system; all 12 practice pages link it instead of inlining 300–800 lines of CSS each
- [x] Nav fade-in behavior — links, phone, CTA all start `opacity:0` and fade in on scroll across all practice pages
- [x] Nav CTA unified to "Free case review →" across all pages
- [x] Footer tagline unified to "Personal injury trial attorneys serving Los Angeles and Orange County. No fee unless we win." across all pages
- [x] All dead footer links fixed — zero `href="#"` on live pages; `law_dog_personal_injury.html` references removed
- [x] Wrongful-death nav links corrected (was showing Truck Accidents instead of Wrongful Death)

### Sitewide updates (2026-06-29)
- [x] **Phone updated to (833) 4LAWDOG** across all 25 pages — `tel:` links, nav, footer, call bar, JSON-LD
- [x] **Address added sitewide** — 515 Flower St, Los Angeles CA 90071 in all JSON-LD PostalAddress schemas
- [x] **Google Material Symbols icons** — replaced all hand-drawn SVG type-icons and emoji diff-icons across 20 pages; Material Symbols Outlined font added to all affected pages
- [x] **Business identity assets** — Google Business description drafted, services list prepared, gradient SVG exported

### Practice pages built (15 total)
- [x] `index.html` — homepage with hero, trust strip, 9-practice grid, 6 case results, differentiators
- [x] `car-accident-lawyer-los-angeles.html`
- [x] `motorcycle-accident-lawyer-los-angeles.html`
- [x] `truck-accident-lawyer-los-angeles.html`
- [x] `hit-and-run-accident-lawyer-los-angeles.html` — includes UM coverage explainer + results section
- [x] `rideshare-accident-lawyer-los-angeles.html` — includes 3-tier coverage section
- [x] `rear-end-collision-lawyer-los-angeles.html`
- [x] `t-bone-accident-lawyer-los-angeles.html` — includes urgency banner
- [x] `pedestrian-accident-lawyer-los-angeles.html`
- [x] `slip-and-fall-lawyer-los-angeles.html`
- [x] `premises-liability-lawyer-los-angeles.html`
- [x] `catastrophic-injury-lawyer-los-angeles.html`
- [x] `wrongful-death-lawyer-los-angeles.html`

### Intake & utility
- [x] `get-started.html` — multi-step intake form; POSTs to `/api/intake` Cloudflare Worker
- [x] `workers/intake.js` — validates submission, sends formatted HTML email via Workers Email binding
- [x] `privacy-policy.html` + `terms.html` — live, linked in footer
- [x] `get-started.html` set to `index, follow` (was incorrectly noindexed)

### SEO
- [x] All 13 practice pages have: title, meta description, canonical, OG tags, Twitter card, LegalService schema, BreadcrumbList, FAQPage schema, gtag.js (G-J5LER585NS)
- [x] `sitemap.xml` present at root

### City pages built (6 of ~20 targeted)
- [x] `personal-injury-lawyer-los-angeles.html` — LA hub; all 10 practice areas, LA crash stats, 6 courthouses, 12 neighborhoods, 10 FAQ
- [x] `personal-injury-lawyer-hollywood.html` — Hollywood; US-101, Sunset Strip, tourist/rideshare density, 6 Hollywood-specific hazards, 10 FAQ
- [x] `personal-injury-lawyer-koreatown.html` — Koreatown; density, Metro Purple Line corridor, aging apartment premises liability, nightlife/karaoke bar negligent security, 6 hazards, 10 FAQ
- [x] `personal-injury-lawyer-silver-lake.html` — Silver Lake; hillside road/blind curve hazards, reservoir loop cycling, Sunset Junction nightlife premises liability, hillside home staircase liability, 6 hazards, 10 FAQ
- [x] `personal-injury-lawyer-echo-park.html` — Echo Park; Dodger Stadium game-day traffic/DUI risk, Echo Park Lake pedestrian crossings, Angelino Heights hillside streets, 6 hazards, 10 FAQ
- [x] `personal-injury-lawyer-burbank.html` — Burbank; separate-city government claim distinction (City of Burbank not LADOT), Hollywood Burbank Airport rideshare curbside, studio commute traffic, I-5/SR-134 interchange, 6 hazards, 10 FAQ

### Sub-pages built (14 of 57)
- [x] `dog-bite-lawyer-los-angeles.html` — Premises Liability; Civil Code § 3342 strict liability, no "one bite" rule
- [x] `head-on-collision-lawyer-los-angeles.html` — Car Accidents; wrong-way/DUI focus, combined closing speeds
- [x] `spinal-cord-injury-lawyer-los-angeles.html` — Catastrophic Injury; lifetime care costs, EDR preservation, life care planning
- [x] `traumatic-brain-injury-lawyer-los-angeles.html` — Catastrophic Injury; neuropsychological testing, diffuse axonal injury, diagnostic gap
- [x] `dui-accident-lawyer-los-angeles.html` — Car Accidents; punitive damages (Civ. Code § 3294), criminal case coordination, dram shop (B&P § 25602.1)
- [x] `multi-vehicle-accident-lawyer-los-angeles.html` — Car Accidents; comparative fault across defendants, reconstruction, multi-policy stacks

### Motorcycle Accident sub-pages built (8 of 8, 2026-07-04)
All wired into `motorcycle-accident-lawyer-los-angeles.html`'s type-grid (previously placeholder `get-started` links) and added to `sitemap.xml`. Extensionless URLs throughout, matching the site's actual redirect behavior.
- [x] `motorcycle-left-turn-accident-lawyer-los-angeles.html` — Veh. Code § 21801 duty to yield, "didn't see them" not a defense
- [x] `lane-split-accident-lawyer-los-angeles.html` — Veh. Code § 21658.1 legality, CHP guidance vs. statutory limit, bias narrative
- [x] `motorcycle-dooring-lawyer-los-angeles.html` — Veh. Code § 22517 duty on door-opener, rideshare passenger liability
- [x] `motorcycle-road-hazard-lawyer-los-angeles.html` — Gov. Code § 835 dangerous condition standard, 6-month § 911.2 deadline, private contractor liability
- [x] `motorcycle-rear-end-lawyer-los-angeles.html` — Veh. Code § 21703 following distance, presumption of fault, distracted driving/phone records
- [x] `motorcycle-hit-and-run-lawyer-los-angeles.html` — UM/UIM coverage as primary recovery, Victim Compensation Board, own-insurer adversarial dynamic
- [x] `motorcycle-dui-accident-lawyer-los-angeles.html` — Punitive damages (Civ. Code § 3294) reframed for rider injury severity, dram shop (B&P § 25602.1)
- [x] `motorcycle-highside-lowside-lawyer-los-angeles.html` — Rebuts "rider error" default; non-contact/phantom vehicle liability, product liability for mechanical defects
