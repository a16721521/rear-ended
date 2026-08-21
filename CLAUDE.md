# CLAUDE.md — Law Dog

Guidance for Claude Code when working on the Law Dog site at `/Users/frpo/Desktop/Law Dog/`.

---

## Project Overview

Static HTML site for Law Dog Legal Group, APC — a Los Angeles personal injury law firm. Deployed to **getlawdog.com** via Cloudflare Workers + Assets (`npx wrangler deploy`).

- **Phone:** (833) 4LAWDOG → `tel:+18334529364`
- **Address:** 515 Flower St, Los Angeles, CA 90071
- **Email:** hello@getlawdog.com
- **GA4:** G-J5LER585NS
- **Entity name:** Law Dog Legal Group, APC

---

## Architecture

Two builds coexist in this repo:

| | Static HTML (live) | Astro (`src/`) |
|---|---|---|
| Domain | getlawdog.com | lawdogla.com (stale — cutover decision not yet made) |
| Status | **Production** | Not deployed, actively maintained scaffold |

The static HTML site (root `*.html` files) is the source of truth for brand, copy, and design, and the only thing currently deployed (`npx wrangler deploy`). The Astro project (`src/`) is a real, working programmatic page generator (city × practice-area pages via `src/data/cities.json` + `src/data/practice-areas.json`) — not a stale experiment, not hypothetical. It is not deployed anywhere live yet, so changes there are committed to git but not shipped via wrangler.

**Keep Astro in sync as the static site's buildout continues.** Whenever you add, remove, or substantively change something on the static site, check whether the same change applies to `src/`:
- New or removed practice area → add/remove the matching entry in `src/data/practice-areas.json` (and update the `iconMap` in `src/pages/index.astro` if the homepage references it)
- New or removed city → update `src/data/cities.json`
- New standalone page/flow on the static site (e.g. an intake form, a new top-level page) → build the Astro equivalent under `src/pages/`
- Brand/design-system change (colors, type, logo) → update `src/styles/global.css` and any component-level styles in `src/components/` and `src/layouts/`
- NAP, GA4 ID, or other firm-identity details → update `src/layouts/BaseLayout.astro` (schema) and `src/components/Footer.astro`

Don't silently let `src/` drift out of date — if a static-site change doesn't have an obvious Astro equivalent (e.g. a Cloudflare Worker API route with no static-output backend), flag the gap explicitly rather than skipping it quietly. Verify Astro changes with `npm run build` (the dev server preview may be blocked by sandbox restrictions in some environments — build + inspecting `dist/` output is an acceptable substitute).

### Shared stylesheet

Practice pages use `<link rel="stylesheet" href="styles.css">` for shared CSS, plus a minimal inline `<style>` for page-specific hero overrides. City/hub pages (e.g. `personal-injury-lawyer-los-angeles.html`) have all CSS inline.

---

## Automatic Checks — Do These Without Being Asked

Whenever you create or significantly edit an HTML page, automatically apply the following. Do not wait to be told.

### 1. Per-Page SEO Basics

Full rationale, per-page-type notes, and known site-specific issues live in **`SEO-GUIDE.md`** — read it before a first pass on a new page type or before a fresh SEO audit. Quick checklist:

Every page must have:
- `<title>` — unique, ≤ 60 chars, primary keyword near front, ends with `| Law Dog`
- `<meta name="description">` — unique, 140–160 chars, clear value prop. Fixed sitewide 2026-07-01; check new pages against this range with `echo -n "..." | wc -m` (not `${#var}`) before shipping.
- `<meta property="og:title">`, `og:description`, `og:image`, `og:url` — for social sharing. `og:image` should be `https://getlawdog.com/hero3.jpeg` unless the page has a more specific image.
- `<link rel="canonical" href="https://getlawdog.com/[page]">`
- One `<h1>` per page — contains primary keyword, matches search intent
- Heading hierarchy H1 → H2 → H3, never skipping levels
- `alt` text on every `<img>`
- Breadcrumb HTML nav + `BreadcrumbList` schema matching the page's position (see JSON-LD table below)
- `<link rel="preconnect" href="https://fonts.googleapis.com">` + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` before the Google Fonts stylesheet
- Viewport exactly `width=device-width, initial-scale=1.0` — never add `user-scalable=no`

**URLs are extensionless — always.** Cloudflare Workers Static Assets serves a 307 redirect from `/page.html` to the extensionless `/page` (confirmed live via curl 2026-07-05), and the extensionless form returns 200 with the real page. The canonical form of every URL on this site drops `.html`. Every canonical, `og:url`, internal `href`, JSON-LD `item`/`url`/`@id`, and sitemap `<loc>` must be extensionless — verified sitewide 2026-07-05 with zero `.html` references remaining anywhere. **Never write a `.html`-suffixed internal link** — it still resolves (via the redirect) but wastes a hop and splits ranking signal between the two forms. This corrects the previous version of this rule, which had it backwards.

After adding a new page, add its (clean, extensionless) URL to `sitemap.xml` with a current `lastmod`. Several already-built pages are currently missing from the sitemap — see `SEO-GUIDE.md` known issues.

See `SEO-GUIDE.md` for the full checklist, per-page-type priorities, and the full list of known open issues from the 2026-07-01 audit.

### 2. Schema (JSON-LD)

Add schema blocks based on page type:

| Page type | Schema blocks to include |
|-----------|--------------------------|
| Homepage (`index.html`) | `LegalService` |
| Practice pages (`*-lawyer-los-angeles.html`) | `LegalService` + `BreadcrumbList` + `FAQPage` |
| City pages (`personal-injury-lawyer-[city].html`) | `LegalService` + `BreadcrumbList` + `FAQPage` |
| Sub-pages (dog bite, DUI, spinal cord, etc.) | `LegalService` + `BreadcrumbList` + `FAQPage` |
| Legal/boilerplate pages (`privacy-policy.html`, `terms.html`) | `LegalService` + `BreadcrumbList` — currently missing on both, low priority but a cheap consistency win |

**Standard LegalService block** — see the address block below for the current values. Copy verbatim, do not invent new values.

```json
{
  "@context": "https://schema.org",
  "@type": "LegalService",
  "name": "Law Dog — [Practice Area] Lawyers",
  "description": "[One sentence describing the practice area and firm].",
  "url": "https://getlawdog.com/[page]",
  "telephone": "+18334529364",
  "email": "hello@getlawdog.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "515 Flower St",
    "addressLocality": "Los Angeles",
    "addressRegion": "CA",
    "postalCode": "90071",
    "addressCountry": "US"
  },
  "priceRange": "Contingency — no fee unless we win"
}
```

Consider adding `"@type": ["LegalService", "Organization"]` (dual type) if chasing AEO/GEO entity-recognition scanners — see `AEO-GEO-GUIDE.md` § 5. Same entity, no new values invented.

**Not yet added anywhere on the site, worth doing incrementally:** `dateModified` (`YYYY-MM-DD`) on the `LegalService` block, and a matching visible "Last updated" line in the rendered body. See `AEO-GEO-GUIDE.md` § 2 — this is a real, sitewide gap.

**Pricing rule:** Never add `Offer`/`Price` schema. Attorney fees are contingency-based and not itemized; don't represent a specific price as being on the page when it isn't.

### 3. Performance

- Images: compress before use, target < 150 KB
- Hero/LCP element on any new page: currently CSS-gradient-only on every practice/city page (no photographic hero image) — if a page ever adds one, use `<img>` (not CSS background), `fetchpriority="high"`, no `loading="lazy"`
- All other images: `loading="lazy"` and explicit `width`/`height` attributes
- New JavaScript: place at bottom of `<body>` — never block rendering
- Do not add new font families or font weights beyond `Plus Jakarta Sans` + Material Symbols Outlined (see § Icons below)

### 4. Internal Linking

- Every new page must be linked from at least one existing relevant page (no orphans)
- Use descriptive anchor text (not "click here")
- Link to official external sources (`leginfo.legislature.ca.gov` for cited statutes, `courts.ca.gov`) with `rel="noopener noreferrer"` — the first mention of each statute per page is now linked sitewide (fixed 2026-07-01); do the same for any new statute citation on new pages, linking only the first occurrence per page

### 5. AEO/GEO Basics

Every new or significantly edited page should also target AI answer engines (ChatGPT, Perplexity, Google AI Overviews), not just classic SEO. Full detail, rationale, and per-page-type notes live in **`AEO-GEO-GUIDE.md`** — read it before a first pass on a new page type. Quick checklist:

- Meta description stays inside 140–160 chars (see rule above)
- At least 2 `<h2>` sections on every page; never jump H1 → H3
- 2+ links to external primary sources (statute text, court sites) in body content near the specific claim they support — fixed sitewide 2026-07-01 for existing statute citations; apply the same pattern to new pages
- `FAQPage` schema + question-style headings (`"What is...", "How long..."`) — already the pattern in every practice/city page's FAQ accordion, keep it
- The numbered "what to do after" playbook section on every practice page is a strong, currently-unused `HowTo` schema candidate — worth prioritizing since the content is already structured as ordered steps

See `AEO-GEO-GUIDE.md` for the full checklist and which third-party AEO/GEO scanner findings are false positives not worth chasing.

### 6. After Any Deploy

Run these quick checks:
```bash
grep -r 'noindex' *.html                                    # no accidental noindex
grep -rl '<link rel="canonical"' *.html                      # every live page should have one
for f in *.html; do grep -q '<link rel="canonical"' "$f" || echo "MISSING: $f"; done
```

---

## Icons — REQUIRED APPROACH

**All icons use Google Material Symbols Outlined. No hand-drawn SVGs. No emoji.**

### Font loading

All pages that use icons must load the font. For pages with `styles.css`, the font is already imported at the top of `styles.css` via `@import`. For standalone pages (city pages, hub pages), add this after the Plus Jakarta Sans link:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0">
```

### Icon HTML pattern

```html
<span class="material-symbols-outlined type-icon" aria-hidden="true">directions_car</span>
```

Replace `type-icon` with the appropriate icon class for the context (`type-icon`, `case-icon`, `cause-icon`). Never use `<svg>` for these icons.

### Icon CSS

In `styles.css` (shared pages):
```css
.type-icon { font-size: 26px; line-height: 1; margin-bottom: 18px; color: var(--gray-400); display: block; transition: color .3s; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }
.type-item:not(.active):hover .type-icon { color: var(--accent); }
```

In standalone pages (inline CSS):
```css
.type-icon { font-size: 26px; line-height: 1; margin-bottom: 18px; color: var(--gray-400); display: block; transition: color .3s; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }
.type-item:hover .type-icon { color: var(--accent); }
```

### Diff-icons (Why Law Dog section)

```html
<div class="diff-icon"><span class="material-symbols-outlined">gavel</span></div>
```

The `.diff-icon` CSS in `styles.css` already sets `color: var(--white)` and `font-variation-settings`.

### Icon name reference

| Context | Material Symbol |
|---|---|
| Car accidents | `directions_car` |
| Truck accidents | `local_shipping` |
| Motorcycle | `two_wheeler` |
| Rideshare | `hail` |
| Pedestrian / bicycle | `directions_walk` |
| Slip & fall | `personal_injury` |
| Premises liability | `home_work` |
| Catastrophic injury | `emergency` |
| Hit & run | `sprint` |
| Wrongful death | `sentiment_dissatisfied` |
| T-bone / crash | `car_crash` |
| Head-on | `emergency` |
| DUI | `no_drinks` |
| Multi-vehicle | `traffic` |
| Spinal cord | `accessibility_new` |
| TBI | `psychology` |
| Amputation | `personal_injury` |
| Burns | `local_fire_department` |
| Negligent security | `security` |
| Pool | `pool` |
| Dog bite | `pets` |
| Structural | `foundation` |
| Poor lighting | `light_mode` |
| Toxic exposure | `science` |
| Construction | `construction` |
| School zone | `school` |
| Crosswalk | `crosswalk` |
| Government vehicle | `local_police` |
| Wet floor | `water_drop` |
| Stairs | `stairs` |
| Parking lot | `local_parking` |
| Retail | `storefront` |
| Apartment | `apartment` |
| Legal / default | `gavel` |
| Search / investigate | `search` |
| Document | `assignment` |
| Schedule / deadline | `schedule` |
| Phone | `phone_iphone` |
| Verified / trust | `verified` |
| Science / expert | `biotech` |
| Medical | `medical_services` |
| Payment | `payments` |
| Work / employment | `work` |
| Handshake | `handshake` |

---

## Design System

### Colors
```css
--black: #080808;  --gray-700: #2d2d2d;  --gray-500: #6b6b6b;
--gray-400: #9b9b9b;  --gray-200: #e8e8e8;  --gray-100: #f4f4f4;
--off-white: #fafafa;  --white: #ffffff;  --accent: #F40502;
--gradient: linear-gradient(110deg, #9B4871 0%, #F42659 33%, #F40502 66%, #F77044 100%);
```

### Typography
- Body/UI: `Plus Jakarta Sans` (400/500/600/700/800)
- **Never use** Cormorant Garamond, DM Mono, Inter, Roboto, or system fonts

### Hero
Dark background (`var(--black)`) with radial gradient overlays and speed-line `::before`. All practice and city pages share this pattern.

### Logo
```html
<img class="logo-white" src="logo_white.png" alt="Law Dog">
<img class="logo-black" src="logo_black.png" alt="" aria-hidden="true">
```
Size via CSS only — no `height` attribute on `<img>`.

---

## URL Naming Convention

- Practice pages: filename `[practice-type]-lawyer-los-angeles.html`, referenced/linked as extensionless `[practice-type]-lawyer-los-angeles`
- City hub pages: filename `personal-injury-lawyer-[city-slug].html`, referenced/linked as extensionless `personal-injury-lawyer-[city-slug]`
- Files on disk keep `.html`; every canonical, `og:url`, internal `href`, JSON-LD URL, and sitemap `<loc>` is extensionless — see "Automatic Checks § 1" above
- Do not change existing URLs without explicit approval

---

## Deployment

```bash
cd /Users/frpo/Desktop/Law\ Dog
npx wrangler deploy
```

Commit before deploying. Never deploy uncommitted changes.

---

## CA Legal References (use in copy)

- CCP § 335.1 — 2-year personal injury SOL
- Gov. Code § 911.2 — 6-month government tort claim deadline
- Civil Code § 1431.2 — pure comparative fault
- Civil Code § 1714 — premises duty of care
- Civil Code § 3342 — dog bite strict liability
- Veh. Code § 21950 — pedestrian right-of-way in crosswalk
