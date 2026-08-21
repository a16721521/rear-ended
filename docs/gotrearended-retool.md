# gotrearended.com — Build / Retool Log

Living document for cloning the **Law Dog** personal-injury site into **gotrearended.com**.
Update this as decisions land. Last updated: 2026-08-20.

---

## 1. What this is

- **gotrearended.com** — a **new, separate personal-injury law firm** (its own name, NAP, entity, and branding — *not* a Law Dog sub-brand).
- Built by cloning the Law Dog Astro codebase and retooling it. Same engine, new brand + content.
- **Hosting:** Cloudflare Workers + Static Assets. Domain already attached to a Worker as a Custom Domain (nameservers `brit`/`josh.ns.cloudflare.com`, zone active).

### Decisions locked
| Decision | Value |
|---|---|
| Relationship to Law Dog | New separate firm |
| Practice scope (phase 1) | **Auto / collision only** — expand later |
| Geography (default) | Reuse Law Dog's LA + CA city set for now (easy to change) |
| Brand look | TBD — default plan is reuse Law Dog's design system with new name/logo/colors |
| Deploy target | Astro build output (`dist/`) via Cloudflare Workers |

---

## 2. Approach: Astro-native (token-light)

Law Dog ships two coexisting builds: 60+ hand-authored static `.html` files (its live source of truth) **and** a complete Astro generator under `src/`. We build on the **Astro generator** so the whole site regenerates from a handful of source files instead of editing 60 pages by hand.

Retool touches only:
- `src/data/practice-areas.json`, `src/data/cities.json` — content, scope, geography
- `src/styles/global.css` — brand colors / type
- `src/layouts/BaseLayout.astro`, `src/components/{Footer,Nav,CallBar,Schema}.astro` — name, NAP, schema, GA4
- `astro.config.mjs` (site URL), `wrangler.toml` (worker name, assets dir), `workers/intake.js` (intake email/origins)
- Logo + favicon assets

`npm run build` regenerates every page → `npx wrangler deploy`.

---

## 3. Status

### Done
- [x] Copied Law Dog project into this folder (excluded `.git`, `.wrangler`, `dist`, `.claude`).
- [x] Baseline build verified: **354 pages** build cleanly (`ASTRO_TELEMETRY_DISABLED=1 npm run build`).
- [x] `astro.config.mjs` → `site: 'https://gotrearended.com'`.
- [x] `wrangler.toml` → `name = "gotrearended"`, `[assets] directory = "./dist"` (Astro-native, no longer serves root `.html`).
- [x] **Homepage retooled** (front page only, per scope):
  - Green system in `global.css`: `--gradient` → mint family anchored on `#98FB98`; `--accent` → `#12A150`; button glows greened; primary buttons use dark text for legibility on light green.
  - `--wordmark` Oswald 300 token; Oswald loaded in `BaseLayout`. "rear ended" wordmark replaces logo images in `Nav` + `Footer`.
  - Hero: `public/hero.avif` full-bleed + dark left overlay; headline "got rear ended?" (2nd line gradient-green); collision subhead + CTAs.
  - Brand swaps: `Nav` (links → collision set, aria, CTA), `Footer` (copy, contact, entity, dropped dead `/learn/` links), `CallBar`, `BaseLayout` og/schema.
  - Honesty fixes: fake press strip → real value-props; **removed Law Dog's GA4 ID** (was `G-J5LER585NS`).
  - Verified: homepage output has no real Law Dog refs; green tokens confirmed in bundled CSS.

### Homepage brand state
- **Phone**: real — `(213) 286-5834` (`tel:+12132865834`) everywhere incl. schema.
- **Main font**: Space Grotesk (body/UI). Wordmark stays Oswald 300. Loaded via Google Fonts in `BaseLayout`.
- **"Ready to fight back?" CTA**: mint background with a subtle multi-tone green gradient.

### Placeholders still on the homepage (replace before any launch)
- **Email** `hello@gotrearended.com` (assumed on-domain).
- **Schema NAP**: locality LA / region CA only, no street address; telephone is the placeholder.
- **GA4**: none — add Rear Ended's own measurement ID in `BaseLayout`.
- **Metrics + Results numbers** ($47M, 98%, 300+, the verdict tiles): **inherited Law Dog demo figures.** A brand-new firm cannot publish these — replace with real, substantiated results (the "prior results" disclaimer is present) or cut the sections before launch.
- **Favicons**: still Law Dog's dog images in `public/`.

### Not started
- [ ] Interior pages (all practice/city pages still Law Dog brand + content).
- [ ] Trim `practice-areas.json` to the auto/collision set (§4).
- [ ] Retool `workers/intake.js` (recipient email, `from`, `ALLOWED_ORIGINS`, case-type labels, brand text).
- [ ] Legal pages (privacy / terms) — see Known gaps.
- [ ] Rewrite project docs (`CLAUDE.md`, `BRANDING.md`, `ROADMAP.md` are still Law Dog's).
- [ ] Remove leftover Law Dog root `.html` files once Astro parity confirmed.

### Shipped 2026-08-21
- [x] Code pushed to GitHub: https://github.com/a16721521/rear-ended (`main`).
- [x] Deployed to Cloudflare Worker `gotrearended`; `gotrearended.com` custom domain bound and serving the homepage (verified HTTP 200, text/html). `wrangler.toml` now declares the custom-domain route.
- ⚠️ Deployed **as-is** at owner's direction: demo metrics/verdicts and placeholder phone/email are live. Replace before promoting the site.
- Interior pages (practice/city) are live too but still Law Dog brand/content — not linked prominently from the homepage nav, but reachable.

---

## 4. Practice-area scope (phase 1)

Current `practice-areas.json` entries: `car-accident`, `truck-accident`, `motorcycle-accident`, `slip-and-fall`, `uber-lyft-accident`, `wrongful-death`, `catastrophic-injury`, `pedestrian-accident`, `premises-liability`.

**Proposed auto/collision keep-set:**
- car-accident (with rear-end emphasis — fits the domain)
- truck-accident
- motorcycle-accident
- uber-lyft-accident (rideshare)
- pedestrian-accident

**Drop for phase 1 (add back later):** slip-and-fall, premises-liability, catastrophic-injury, wrongful-death.
> Confirm this keep/drop list before trimming.

---

## 5. OPEN — needs your input

Provide these and the brand pass can run end-to-end:

1. **Firm name** (legal entity + display name, e.g. "Rear Ended Law, APC")
2. **Phone** (display + `tel:` form)
3. **Address** (street, city, state, ZIP) — or "no physical address / virtual"
4. **Intake email** (where leads are sent) + **from email** (e.g. `intake@gotrearended.com`)
5. **GA4 Measurement ID** (or skip for now)
6. **Accent colors** (or "reuse Law Dog gradient recolored" / "pick something new")
7. **Logo** (file, or "generate a wordmark for now")

---

## 6. Known gaps / notes

- **Legal pages:** `privacy-policy` and `terms` exist only as static HTML in Law Dog — the Astro generator has no equivalent. Plan: recreate as `src/pages/privacy-policy.astro` + `terms.astro` (or drop into `public/` for verbatim serving). Needed before a real law-firm launch.
- **`learn` section:** Astro `learn/[slug]` collection is empty (build warns, harmless). Out of scope for phase 1.
- **Static assets:** ensure `robots.txt`, `llms.txt`, favicons, logo, and any hero images live in `public/` so they land in `dist/`. Root-level copies won't deploy under `directory = "./dist"`.
- **Intake worker email:** requires one-time `npx wrangler email sending enable gotrearended.com` and DNS/DKIM setup before `env.EMAIL.send` works.
- **Telemetry:** Astro telemetry write to `~/Library/Preferences` is sandbox-blocked — always build with `ASTRO_TELEMETRY_DISABLED=1`.

---

## 7. Deploy runbook

```bash
# from project root
ASTRO_TELEMETRY_DISABLED=1 npm run build     # regenerate dist/
npx wrangler deploy                          # push Worker + dist assets
```

- Worker name: `gotrearended` (must match the Worker the domain is attached to).
- One-time before intake email works: `npx wrangler email sending enable gotrearended.com`.
- Dev server: `npm run dev` (port 3100).
