# Dangerous Intersections Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/dangerous-intersections-los-angeles` — a single static page with a Leaflet map and a ranked, expandable list of LA County's 25 most dangerous intersections, sourced from TIMS/SWITRS injury-crash data, cross-referenced with LADOT's High Injury Network, and synced into the Astro build.

**Architecture:** A Node data pipeline (`scripts/build-intersections.mjs`) turns a TIMS CSV export into `data/intersections.json`, the single source of truth. A second script (`scripts/build-page.mjs`) renders that JSON through an HTML template into the committed static page. The Astro page imports the same JSON directly, so it can't drift. Every data-shaping function (street normalization, geo clustering, aggregation, HIN overlay, practice-page matching, card rendering) is a pure, unit-tested module under `scripts/lib/`.

**Tech Stack:** Plain Node.js (v20+, no new runtime deps), Node's built-in `node:test` + `node:assert` for tests (no test framework dependency added), Leaflet 1.9 self-hosted (no CDN, no API key), vanilla JS for page interactivity, Astro (existing project) for the `src/` sync.

**Spec:** `docs/superpowers/specs/2026-08-13-dangerous-intersections-map-design.md`

---

## Before You Start

Two things in this plan depend on data only the user can obtain — flagged inline at Task 9 (TIMS export). Everything through Task 8 can be built and fully tested against fixtures without that export. Task 9 is a hard blocker for Tasks 10–19 (nothing downstream has real data to render until it's done).

---

### Task 1: Project scaffolding

**Files:**
- Create: `data/raw/.gitkeep`
- Create: `scripts/lib/.gitkeep`
- Create: `tests/lib/.gitkeep`
- Create: `tests/fixtures/.gitkeep`
- Modify: `.assetsignore`
- Modify: `package.json`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p data/raw scripts/lib tests/lib tests/fixtures
touch data/raw/.gitkeep scripts/lib/.gitkeep tests/lib/.gitkeep tests/fixtures/.gitkeep
```

- [ ] **Step 2: Exclude data/scripts/tests from the deployed static site**

The site deploys via `npx wrangler deploy` using `.assetsignore` to exclude working-directory files from what ships (see current entries: `src`, `workers`, `*.md`, etc.). Add these lines to `.assetsignore`:

```
data
scripts
tests
docs
```

- [ ] **Step 3: Add a test script to package.json**

Modify the `"scripts"` block in `package.json`:

```json
  "scripts": {
    "dev": "astro dev --port 3100",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "test": "node --test tests/"
  },
```

- [ ] **Step 4: Verify the test runner works with zero tests**

Run: `npm test`
Expected: exits 0, reports `# tests 0` (no test files exist yet — that's correct for this step).

- [ ] **Step 5: Commit**

```bash
git add data/raw/.gitkeep scripts/lib/.gitkeep tests/lib/.gitkeep tests/fixtures/.gitkeep .assetsignore package.json
git commit -m "chore: scaffold dangerous-intersections data pipeline directories"
```

---

### Task 2: Geo utilities (haversine distance, median point, 2-cluster split)

**Files:**
- Create: `scripts/lib/geo.mjs`
- Test: `tests/lib/geo.test.mjs`

These are the pure math primitives the aggregation step needs: distance between two lat/lng points, a robust center point for a group of crashes, and a deterministic way to split a group that's actually two separate intersections sharing the same street-pair name (e.g. two streets that cross twice in different parts of the county).

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/lib/geo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, medianPoint, splitIfBimodal } from '../../scripts/lib/geo.mjs';

test('haversineMeters: same point is zero', () => {
  assert.equal(haversineMeters({ lat: 34.05, lng: -118.25 }, { lat: 34.05, lng: -118.25 }), 0);
});

test('haversineMeters: known distance between two LA points is roughly correct', () => {
  // Downtown LA to Long Beach, ~30km
  const d = haversineMeters({ lat: 34.0522, lng: -118.2437 }, { lat: 33.7701, lng: -118.1937 });
  assert.ok(d > 29000 && d < 32000, `expected ~30km, got ${d}m`);
});

test('medianPoint: returns the geometric median for an odd-sized cluster', () => {
  const points = [
    { lat: 34.000, lng: -118.000 },
    { lat: 34.002, lng: -118.002 },
    { lat: 34.001, lng: -118.001 },
  ];
  const m = medianPoint(points);
  assert.equal(m.lat, 34.001);
  assert.equal(m.lng, -118.001);
});

test('medianPoint: a single outlier does not drag the result', () => {
  const points = [
    { lat: 34.000, lng: -118.000 },
    { lat: 34.001, lng: -118.001 },
    { lat: 34.002, lng: -118.002 },
    { lat: 34.001, lng: -118.001 },
    { lat: 40.000, lng: -118.000 }, // bad geocode, far away
  ];
  const m = medianPoint(points);
  assert.equal(m.lat, 34.001);
  assert.equal(m.lng, -118.001);
});

test('splitIfBimodal: keeps a tight single cluster as one group', () => {
  const points = Array.from({ length: 10 }, (_, i) => ({
    lat: 34.05 + i * 0.0001,
    lng: -118.25 + i * 0.0001,
  }));
  const groups = splitIfBimodal(points);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 10);
});

test('splitIfBimodal: splits two genuinely separate clusters sharing a street-pair name', () => {
  const clusterA = Array.from({ length: 6 }, (_, i) => ({
    lat: 34.0500 + i * 0.00005,
    lng: -118.2500 + i * 0.00005,
  }));
  const clusterB = Array.from({ length: 6 }, (_, i) => ({
    lat: 34.2000 + i * 0.00005, // ~17km north — a genuinely different intersection
    lng: -118.4000 + i * 0.00005,
  }));
  const groups = splitIfBimodal([...clusterA, ...clusterB]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].length + groups[1].length, 12);
});

test('splitIfBimodal: does not split when one side is just noise (too few points)', () => {
  const clusterA = Array.from({ length: 10 }, (_, i) => ({
    lat: 34.0500 + i * 0.00005,
    lng: -118.2500 + i * 0.00005,
  }));
  const noise = [{ lat: 34.3000, lng: -118.5000 }, { lat: 34.3001, lng: -118.5001 }]; // only 2 points
  const groups = splitIfBimodal([...clusterA, ...noise]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 12);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/geo.test.mjs`
Expected: FAIL — `scripts/lib/geo.mjs` does not exist yet.

- [ ] **Step 3: Implement geo.mjs**

```javascript
// scripts/lib/geo.mjs
const EARTH_RADIUS_METERS = 6371000;
const SPLIT_THRESHOLD_METERS = 200;
const MIN_SUBCLUSTER_SIZE = 3;

export function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function medianPoint(points) {
  return {
    lat: median(points.map((p) => p.lat)),
    lng: median(points.map((p) => p.lng)),
  };
}

function farthestPair(points) {
  let best = [points[0], points[1]];
  let bestDist = -Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = haversineMeters(points[i], points[j]);
      if (d > bestDist) {
        bestDist = d;
        best = [points[i], points[j]];
      }
    }
  }
  return best;
}

function kmeans2(points) {
  let [centroidA, centroidB] = farthestPair(points);
  let groupA = [];
  let groupB = [];
  for (let iter = 0; iter < 10; iter++) {
    groupA = [];
    groupB = [];
    for (const p of points) {
      const da = haversineMeters(p, centroidA);
      const db = haversineMeters(p, centroidB);
      (da <= db ? groupA : groupB).push(p);
    }
    if (groupA.length === 0 || groupB.length === 0) break;
    const newA = medianPoint(groupA);
    const newB = medianPoint(groupB);
    if (newA.lat === centroidA.lat && newA.lng === centroidA.lng &&
        newB.lat === centroidB.lat && newB.lng === centroidB.lng) {
      break;
    }
    centroidA = newA;
    centroidB = newB;
  }
  return [groupA, groupB];
}

export function splitIfBimodal(points) {
  if (points.length < MIN_SUBCLUSTER_SIZE * 2) return [points];

  const centroid = medianPoint(points);
  const maxDist = Math.max(...points.map((p) => haversineMeters(p, centroid)));
  if (maxDist <= SPLIT_THRESHOLD_METERS) return [points];

  const [groupA, groupB] = kmeans2(points);
  if (groupA.length < MIN_SUBCLUSTER_SIZE || groupB.length < MIN_SUBCLUSTER_SIZE) {
    return [points];
  }

  const interClusterDist = haversineMeters(medianPoint(groupA), medianPoint(groupB));
  if (interClusterDist <= SPLIT_THRESHOLD_METERS) return [points];

  return [groupA, groupB];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/geo.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/geo.mjs tests/lib/geo.test.mjs
git commit -m "feat: add geo utilities for intersection clustering"
```

---

### Task 3: Street name normalization and intersection keys

**Files:**
- Create: `scripts/lib/streets.mjs`
- Test: `tests/lib/streets.test.mjs`

**Note:** street-name matching against LADOT's HIN dataset (Task 7) uses `normalizeStreetName` too — verified against the real HIN field format (`STNAME`, e.g. `"CENTURY BLVD"`) fetched during spec research, so the normalization rules below target that exact format.

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/lib/streets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStreetName, intersectionKey } from '../../scripts/lib/streets.mjs';

test('normalizeStreetName: strips directional prefix', () => {
  assert.equal(normalizeStreetName('N VERMONT AVE'), 'VERMONT AVE');
  assert.equal(normalizeStreetName('S FIGUEROA ST'), 'FIGUEROA ST');
  assert.equal(normalizeStreetName('E CESAR CHAVEZ AVE'), 'CESAR CHAVEZ AVE');
  assert.equal(normalizeStreetName('W OLYMPIC BLVD'), 'OLYMPIC BLVD');
});

test('normalizeStreetName: canonicalizes suffix variants', () => {
  assert.equal(normalizeStreetName('MANCHESTER AV'), 'MANCHESTER AVE');
  assert.equal(normalizeStreetName('MANCHESTER AVENUE'), 'MANCHESTER AVE');
  assert.equal(normalizeStreetName('MANCHESTER AVE'), 'MANCHESTER AVE');
  assert.equal(normalizeStreetName('3RD STREET'), '3RD ST');
  assert.equal(normalizeStreetName('SEPULVEDA BOULEVARD'), 'SEPULVEDA BLVD');
});

test('normalizeStreetName: collapses extra whitespace and uppercases', () => {
  assert.equal(normalizeStreetName('  vermont   ave  '), 'VERMONT AVE');
});

test('normalizeStreetName: leaves highway/freeway names alone', () => {
  assert.equal(normalizeStreetName('I-405'), 'I-405');
  assert.equal(normalizeStreetName('US-101'), 'US-101');
});

test('intersectionKey: same pair in either order produces the same key', () => {
  assert.equal(
    intersectionKey('VERMONT AVE', 'MANCHESTER AVE'),
    intersectionKey('MANCHESTER AVE', 'VERMONT AVE')
  );
});

test('intersectionKey: key is alphabetically sorted and human-readable', () => {
  assert.equal(intersectionKey('VERMONT AVE', 'MANCHESTER AVE'), 'MANCHESTER AVE & VERMONT AVE');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/streets.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement streets.mjs**

```javascript
// scripts/lib/streets.mjs
const DIRECTIONAL_PREFIX = /^(N|S|E|W)\s+/;

const SUFFIX_MAP = new Map([
  ['AV', 'AVE'], ['AVENUE', 'AVE'],
  ['STREET', 'ST'],
  ['BOULEVARD', 'BLVD'], ['BLVD.', 'BLVD'],
  ['DRIVE', 'DR'],
  ['ROAD', 'RD'],
  ['PLACE', 'PL'],
  ['COURT', 'CT'],
  ['LANE', 'LN'],
  ['PARKWAY', 'PKWY'],
  ['HIGHWAY', 'HWY'],
]);

export function normalizeStreetName(raw) {
  let name = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  name = name.replace(DIRECTIONAL_PREFIX, '');

  const words = name.split(' ');
  const lastWord = words[words.length - 1];
  if (SUFFIX_MAP.has(lastWord)) {
    words[words.length - 1] = SUFFIX_MAP.get(lastWord);
  }
  return words.join(' ');
}

export function intersectionKey(streetA, streetB) {
  const [first, second] = [streetA, streetB].sort();
  return `${first} & ${second}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/streets.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/streets.mjs tests/lib/streets.test.mjs
git commit -m "feat: add street name normalization and intersection key builder"
```

---

### Task 4: TIMS/SWITRS CSV parser

**Files:**
- Create: `scripts/lib/parse-tims-csv.mjs`
- Create: `tests/fixtures/sample-tims.csv`
- Test: `tests/lib/parse-tims-csv.test.mjs`

Column names match the standard SWITRS crash-table codebook that TIMS exports use. If the real export (Task 9) has different headers, only `COLUMN_MAP` in this file needs to change — everything downstream consumes the normalized record shape, not raw CSV columns.

- [ ] **Step 1: Create the fixture CSV**

```
// tests/fixtures/sample-tims.csv
CASE_ID,ACCIDENT_YEAR,PRIMARY_RD,SECONDARY_RD,INTERSECTION,COLLISION_SEVERITY,NUMBER_KILLED,NUMBER_INJURED,TYPE_OF_COLLISION,PCF_VIOL_CATEGORY,PEDESTRIAN_ACCIDENT,BICYCLE_ACCIDENT,MOTORCYCLE_ACCIDENT,TRUCK_ACCIDENT,ALCOHOL_INVOLVED,POINT_X,POINT_Y
0001,2021,VERMONT AVE,MANCHESTER AVE,Y,2,0,1,D,03,Y,,,,,-118.2915,33.9622
0002,2021,VERMONT AVE,MANCHESTER AVE,Y,3,0,1,C,01,,,,,,-118.2916,33.9621
0003,2022,VERMONT AVE,MANCHESTER AVE,Y,1,1,0,A,22,,,,,Y,-118.2914,33.9623
0004,2022,SEPULVEDA BLVD,VENTURA BLVD,Y,3,0,2,D,03,,,Y,,,-118.4477,34.1706
0005,2023,SEPULVEDA BLVD,VENTURA BLVD,Y,2,0,1,D,01,,,,,,-118.4478,34.1705
0006,2020,FIGUEROA ST,SLAUSON AVE,N,3,0,1,C,03,,,,,,-118.2820,33.9884
```

Row 6 has `INTERSECTION=N` (a mid-block collision, not an intersection) — the parser should exclude it, that behavior is what Step 2's test asserts.

- [ ] **Step 2: Write the failing tests**

```javascript
// tests/lib/parse-tims-csv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTimsCsv } from '../../scripts/lib/parse-tims-csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '..', 'fixtures', 'sample-tims.csv');

test('parseTimsCsv: parses all intersection rows, excludes non-intersection rows', () => {
  const csvText = readFileSync(fixturePath, 'utf8');
  const records = parseTimsCsv(csvText);
  assert.equal(records.length, 5); // 6 rows, one excluded (INTERSECTION=N)
});

test('parseTimsCsv: maps fields to a normalized record shape', () => {
  const csvText = readFileSync(fixturePath, 'utf8');
  const [first] = parseTimsCsv(csvText);
  assert.equal(first.caseId, '0001');
  assert.equal(first.year, 2021);
  assert.equal(first.primaryRd, 'VERMONT AVE');
  assert.equal(first.secondaryRd, 'MANCHESTER AVE');
  assert.equal(first.severity, '2');
  assert.equal(first.numberKilled, 0);
  assert.equal(first.numberInjured, 1);
  assert.equal(first.collisionType, 'D');
  assert.equal(first.pedestrian, true);
  assert.equal(first.bicycle, false);
  assert.equal(first.motorcycle, false);
  assert.equal(first.truck, false);
  assert.equal(first.alcohol, false);
  assert.equal(first.lat, 33.9622);
  assert.equal(first.lng, -118.2915);
});

test('parseTimsCsv: alcohol flag parses correctly when present', () => {
  const csvText = readFileSync(fixturePath, 'utf8');
  const records = parseTimsCsv(csvText);
  const record = records.find((r) => r.caseId === '0003');
  assert.equal(record.alcohol, true);
});

test('parseTimsCsv: handles quoted fields containing commas', () => {
  const csvText = `CASE_ID,ACCIDENT_YEAR,PRIMARY_RD,SECONDARY_RD,INTERSECTION,COLLISION_SEVERITY,NUMBER_KILLED,NUMBER_INJURED,TYPE_OF_COLLISION,PCF_VIOL_CATEGORY,PEDESTRIAN_ACCIDENT,BICYCLE_ACCIDENT,MOTORCYCLE_ACCIDENT,TRUCK_ACCIDENT,ALCOHOL_INVOLVED,POINT_X,POINT_Y\n0099,2021,"MLK JR, BLVD",MAIN ST,Y,3,0,1,C,01,,,,,,-118.28,34.00`;
  const records = parseTimsCsv(csvText);
  assert.equal(records.length, 1);
  assert.equal(records[0].primaryRd, 'MLK JR, BLVD');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/lib/parse-tims-csv.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement parse-tims-csv.mjs**

```javascript
// scripts/lib/parse-tims-csv.mjs
const COLUMN_MAP = {
  caseId: 'CASE_ID',
  year: 'ACCIDENT_YEAR',
  primaryRd: 'PRIMARY_RD',
  secondaryRd: 'SECONDARY_RD',
  intersection: 'INTERSECTION',
  severity: 'COLLISION_SEVERITY',
  numberKilled: 'NUMBER_KILLED',
  numberInjured: 'NUMBER_INJURED',
  collisionType: 'TYPE_OF_COLLISION',
  pcfViolCategory: 'PCF_VIOL_CATEGORY',
  pedestrian: 'PEDESTRIAN_ACCIDENT',
  bicycle: 'BICYCLE_ACCIDENT',
  motorcycle: 'MOTORCYCLE_ACCIDENT',
  truck: 'TRUCK_ACCIDENT',
  alcohol: 'ALCOHOL_INVOLVED',
  lng: 'POINT_X',
  lat: 'POINT_Y',
};

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"' && normalized[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

function toBool(value) {
  return value.trim().toUpperCase() === 'Y';
}

export function parseTimsCsv(csvText) {
  const rows = parseCsvRows(csvText);
  const [header, ...dataRows] = rows;
  const colIndex = {};
  for (const [key, csvName] of Object.entries(COLUMN_MAP)) {
    colIndex[key] = header.indexOf(csvName);
  }
  const intersectionIdx = header.indexOf('INTERSECTION');

  return dataRows
    .filter((row) => row[intersectionIdx]?.trim().toUpperCase() === 'Y')
    .map((row) => ({
      caseId: row[colIndex.caseId],
      year: Number(row[colIndex.year]),
      primaryRd: row[colIndex.primaryRd].trim().toUpperCase(),
      secondaryRd: row[colIndex.secondaryRd].trim().toUpperCase(),
      severity: row[colIndex.severity],
      numberKilled: Number(row[colIndex.numberKilled]) || 0,
      numberInjured: Number(row[colIndex.numberInjured]) || 0,
      collisionType: row[colIndex.collisionType],
      pcfViolCategory: row[colIndex.pcfViolCategory],
      pedestrian: toBool(row[colIndex.pedestrian] || ''),
      bicycle: toBool(row[colIndex.bicycle] || ''),
      motorcycle: toBool(row[colIndex.motorcycle] || ''),
      truck: toBool(row[colIndex.truck] || ''),
      alcohol: toBool(row[colIndex.alcohol] || ''),
      lng: Number(row[colIndex.lng]),
      lat: Number(row[colIndex.lat]),
    }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/lib/parse-tims-csv.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/parse-tims-csv.mjs tests/fixtures/sample-tims.csv tests/lib/parse-tims-csv.test.mjs
git commit -m "feat: add TIMS/SWITRS CSV parser"
```

---

### Task 5: Practice-page matching rules

**Files:**
- Create: `scripts/lib/practice-match.mjs`
- Test: `tests/lib/practice-match.test.mjs`

Maps an aggregated intersection's crash profile to the single most relevant existing practice page, checked in priority order (most specific claim type first). Page list confirmed against the live site's actual files (`ls *.html`, 2026-08-13).

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/lib/practice-match.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPracticePage } from '../../scripts/lib/practice-match.mjs';

test('pedestrian involvement takes top priority', () => {
  const page = matchPracticePage({
    pedestrian: true, bicycle: false, motorcycle: true, truck: true,
    alcoholRate: 0.5, dominantCollisionType: 'D',
  });
  assert.equal(page, 'pedestrian-accident-lawyer-los-angeles');
});

test('motorcycle involvement is checked after pedestrian', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: true, truck: true,
    alcoholRate: 0.5, dominantCollisionType: 'D',
  });
  assert.equal(page, 'motorcycle-accident-lawyer-los-angeles');
});

test('truck involvement is checked after motorcycle', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: true,
    alcoholRate: 0.5, dominantCollisionType: 'D',
  });
  assert.equal(page, 'truck-accident-lawyer-los-angeles');
});

test('high alcohol involvement rate routes to DUI page', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: false,
    alcoholRate: 0.2, dominantCollisionType: 'D',
  });
  assert.equal(page, 'dui-accident-lawyer-los-angeles');
});

test('dominant type D (broadside) routes to T-bone page', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: false,
    alcoholRate: 0, dominantCollisionType: 'D',
  });
  assert.equal(page, 't-bone-accident-lawyer-los-angeles');
});

test('dominant type A (head-on) routes to head-on page', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: false,
    alcoholRate: 0, dominantCollisionType: 'A',
  });
  assert.equal(page, 'head-on-collision-lawyer-los-angeles');
});

test('dominant type C (rear end) routes to rear-end page', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: false,
    alcoholRate: 0, dominantCollisionType: 'C',
  });
  assert.equal(page, 'rear-end-collision-lawyer-los-angeles');
});

test('anything unmatched falls back to the general car accident page', () => {
  const page = matchPracticePage({
    pedestrian: false, bicycle: false, motorcycle: false, truck: false,
    alcoholRate: 0, dominantCollisionType: 'F',
  });
  assert.equal(page, 'car-accident-lawyer-los-angeles');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/practice-match.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement practice-match.mjs**

```javascript
// scripts/lib/practice-match.mjs
const ALCOHOL_THRESHOLD = 0.15;

const RULES = [
  (p) => p.pedestrian && 'pedestrian-accident-lawyer-los-angeles',
  (p) => p.motorcycle && 'motorcycle-accident-lawyer-los-angeles',
  (p) => p.truck && 'truck-accident-lawyer-los-angeles',
  (p) => p.alcoholRate >= ALCOHOL_THRESHOLD && 'dui-accident-lawyer-los-angeles',
  (p) => p.dominantCollisionType === 'D' && 't-bone-accident-lawyer-los-angeles',
  (p) => p.dominantCollisionType === 'A' && 'head-on-collision-lawyer-los-angeles',
  (p) => p.dominantCollisionType === 'C' && 'rear-end-collision-lawyer-los-angeles',
];

export function matchPracticePage(profile) {
  for (const rule of RULES) {
    const match = rule(profile);
    if (match) return match;
  }
  return 'car-accident-lawyer-los-angeles';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/practice-match.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/practice-match.mjs tests/lib/practice-match.test.mjs
git commit -m "feat: add practice-page matching rules for intersections"
```

---

### Task 6: Aggregate crashes into ranked intersections

**Files:**
- Create: `scripts/lib/aggregate-intersections.mjs`
- Test: `tests/lib/aggregate-intersections.test.mjs`

This is the core statistics module: groups normalized crash records by intersection, applies the bimodal-cluster split, computes severity/mode/alcohol stats, picks the dominant collision type, and ranks by injury-and-fatal crash count.

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/lib/aggregate-intersections.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateIntersections } from '../../scripts/lib/aggregate-intersections.mjs';

function crash(overrides) {
  return {
    caseId: '0000', year: 2021, primaryRd: 'VERMONT AVE', secondaryRd: 'MANCHESTER AVE',
    severity: '3', numberKilled: 0, numberInjured: 1, collisionType: 'D', pcfViolCategory: '01',
    pedestrian: false, bicycle: false, motorcycle: false, truck: false, alcohol: false,
    lat: 33.9622, lng: -118.2915,
    ...overrides,
  };
}

test('groups crashes by normalized intersection key', () => {
  const crashes = [
    crash({ caseId: '1' }),
    crash({ caseId: '2', primaryRd: 'N VERMONT AVE', secondaryRd: 'MANCHESTER AVE' }), // same intersection, unnormalized
    crash({ caseId: '3', primaryRd: 'SEPULVEDA BLVD', secondaryRd: 'VENTURA BLVD', lat: 34.1706, lng: -118.4477 }),
  ];
  const result = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(result.length, 2);
});

test('ranks by total injury-and-fatal crash count, descending', () => {
  const busy = Array.from({ length: 5 }, (_, i) => crash({ caseId: `busy-${i}` }));
  const quiet = [crash({ caseId: 'q1', primaryRd: 'SEPULVEDA BLVD', secondaryRd: 'VENTURA BLVD', lat: 34.1706, lng: -118.4477 })];
  const result = aggregateIntersections([...quiet, ...busy], { topN: 25 });
  assert.equal(result[0].streetA, 'MANCHESTER AVE');
  assert.equal(result[0].crashCount, 5);
  assert.equal(result[1].crashCount, 1);
});

test('respects topN limit', () => {
  const crashes = [
    crash({ primaryRd: 'A ST', secondaryRd: 'B ST', lat: 34.01, lng: -118.01 }),
    crash({ primaryRd: 'C ST', secondaryRd: 'D ST', lat: 34.02, lng: -118.02 }),
    crash({ primaryRd: 'E ST', secondaryRd: 'F ST', lat: 34.03, lng: -118.03 }),
  ];
  const result = aggregateIntersections(crashes, { topN: 2 });
  assert.equal(result.length, 2);
});

test('computes severity breakdown and totals correctly', () => {
  const crashes = [
    crash({ caseId: '1', severity: '1', numberKilled: 1, numberInjured: 0 }),
    crash({ caseId: '2', severity: '2', numberKilled: 0, numberInjured: 2 }),
    crash({ caseId: '3', severity: '3', numberKilled: 0, numberInjured: 1 }),
  ];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.killed, 1);
  assert.equal(ix.severeInjuryCrashes, 1);
  assert.equal(ix.totalInjured, 3);
  assert.equal(ix.crashCount, 3);
});

test('computes mode flags as true if any crash in the group has them', () => {
  const crashes = [
    crash({ caseId: '1', pedestrian: true }),
    crash({ caseId: '2', pedestrian: false, motorcycle: true }),
  ];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.pedestrian, true);
  assert.equal(ix.motorcycle, true);
  assert.equal(ix.truck, false);
});

test('computes alcohol involvement rate as a fraction', () => {
  const crashes = [
    crash({ caseId: '1', alcohol: true }),
    crash({ caseId: '2', alcohol: false }),
    crash({ caseId: '3', alcohol: false }),
    crash({ caseId: '4', alcohol: false }),
  ];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.alcoholRate, 0.25);
});

test('picks the most frequent collision type as dominant', () => {
  const crashes = [
    crash({ caseId: '1', collisionType: 'D' }),
    crash({ caseId: '2', collisionType: 'D' }),
    crash({ caseId: '3', collisionType: 'C' }),
  ];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.dominantCollisionType, 'D');
});

test('assigns a matched practice page and a URL-safe slug', () => {
  const crashes = [crash({ pedestrian: true })];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.matchedPracticePage, 'pedestrian-accident-lawyer-los-angeles');
  assert.equal(ix.slug, 'manchester-ave-vermont-ave');
});

test('uses median coordinates for the intersection location', () => {
  const crashes = [
    crash({ caseId: '1', lat: 33.9620, lng: -118.2910 }),
    crash({ caseId: '2', lat: 33.9622, lng: -118.2915 }),
    crash({ caseId: '3', lat: 33.9621, lng: -118.2916 }),
  ];
  const [ix] = aggregateIntersections(crashes, { topN: 25 });
  assert.equal(ix.lat, 33.9621);
  assert.equal(ix.lng, -118.2915);
});

test('splits a street-pair name that is actually two separate real-world intersections', () => {
  const clusterA = Array.from({ length: 5 }, (_, i) =>
    crash({ caseId: `a-${i}`, lat: 33.9500 + i * 0.0001, lng: -118.2500 + i * 0.0001 })
  );
  const clusterB = Array.from({ length: 5 }, (_, i) =>
    crash({ caseId: `b-${i}`, lat: 34.1000 + i * 0.0001, lng: -118.4500 + i * 0.0001 })
  );
  const result = aggregateIntersections([...clusterA, ...clusterB], { topN: 25 });
  const matches = result.filter((ix) => ix.streetA === 'MANCHESTER AVE' && ix.streetB === 'VERMONT AVE');
  assert.equal(matches.length, 2);
});

test('assigns rank as 1-indexed position in the sorted output', () => {
  const busy = Array.from({ length: 3 }, (_, i) => crash({ caseId: `busy-${i}` }));
  const quiet = [crash({ caseId: 'q1', primaryRd: 'SEPULVEDA BLVD', secondaryRd: 'VENTURA BLVD', lat: 34.1706, lng: -118.4477 })];
  const result = aggregateIntersections([...quiet, ...busy], { topN: 25 });
  assert.equal(result[0].rank, 1);
  assert.equal(result[1].rank, 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/aggregate-intersections.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement aggregate-intersections.mjs**

```javascript
// scripts/lib/aggregate-intersections.mjs
import { normalizeStreetName, intersectionKey } from './streets.mjs';
import { medianPoint, splitIfBimodal } from './geo.mjs';
import { matchPracticePage } from './practice-match.mjs';

const COLLISION_TYPE_LABELS = {
  A: 'Head-On', B: 'Sideswipe', C: 'Rear-End', D: 'Broadside (T-Bone)',
  E: 'Hit Object', F: 'Overturned', G: 'Vehicle/Pedestrian', H: 'Other',
};

function slugify(streetA, streetB) {
  const words = `${streetA} ${streetB}`.toLowerCase().split(' ').sort();
  return [...new Set(words)]
    .join('-')
    .replace(/[^a-z0-9-]/g, '');
}

function mostFrequent(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

function buildIntersectionRecord(key, crashesInGroup) {
  const [streetA, streetB] = key.split(' & ');
  const point = medianPoint(crashesInGroup);
  const killed = crashesInGroup.reduce((sum, c) => sum + c.numberKilled, 0);
  const totalInjured = crashesInGroup.reduce((sum, c) => sum + c.numberInjured, 0);
  const severeInjuryCrashes = crashesInGroup.filter((c) => c.severity === '2').length;
  const pedestrian = crashesInGroup.some((c) => c.pedestrian);
  const bicycle = crashesInGroup.some((c) => c.bicycle);
  const motorcycle = crashesInGroup.some((c) => c.motorcycle);
  const truck = crashesInGroup.some((c) => c.truck);
  const alcoholRate = crashesInGroup.filter((c) => c.alcohol).length / crashesInGroup.length;
  const dominantCollisionType = mostFrequent(crashesInGroup.map((c) => c.collisionType));
  const matchedPracticePage = matchPracticePage({
    pedestrian, bicycle, motorcycle, truck, alcoholRate, dominantCollisionType,
  });

  return {
    streetA,
    streetB,
    slug: slugify(streetA, streetB),
    lat: point.lat,
    lng: point.lng,
    crashCount: crashesInGroup.length,
    killed,
    totalInjured,
    severeInjuryCrashes,
    pedestrian,
    bicycle,
    motorcycle,
    truck,
    alcoholRate,
    dominantCollisionType,
    dominantCollisionTypeLabel: COLLISION_TYPE_LABELS[dominantCollisionType] || 'Other',
    matchedPracticePage,
  };
}

export function aggregateIntersections(crashes, { topN }) {
  const groups = new Map();
  for (const crash of crashes) {
    const streetA = normalizeStreetName(crash.primaryRd);
    const streetB = normalizeStreetName(crash.secondaryRd);
    const key = intersectionKey(streetA, streetB);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...crash, primaryRd: streetA, secondaryRd: streetB });
  }

  const records = [];
  for (const [key, groupCrashes] of groups) {
    const clusters = splitIfBimodal(groupCrashes);
    for (const cluster of clusters) {
      records.push(buildIntersectionRecord(key, cluster));
    }
  }

  records.sort((a, b) => b.crashCount - a.crashCount);
  return records.slice(0, topN).map((record, i) => ({ ...record, rank: i + 1 }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/aggregate-intersections.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/aggregate-intersections.mjs tests/lib/aggregate-intersections.test.mjs
git commit -m "feat: add crash-to-intersection aggregation and ranking"
```

---

### Task 7: LADOT High Injury Network overlay

**Files:**
- Create: `scripts/lib/hin-overlay.mjs`
- Create: `tests/fixtures/sample-hin.geojson`
- Test: `tests/lib/hin-overlay.test.mjs`

Real HIN field format confirmed during spec research (`https://hub.arcgis.com/api/download/v1/items/4ba1b8fa8d8946348b29261045298a88/geojson?redirect=true&layers=0`, fetched 2026-08-13): `FeatureCollection` of `LineString` features with `STNAME`, `FROM_`, `TO_` properties, WGS84 coordinates. This overlay checks whether an intersection point lies within ~50m of any HIN line segment.

- [ ] **Step 1: Create the fixture GeoJSON**

```json
// tests/fixtures/sample-hin.geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "STNAME": "MANCHESTER AVE", "FROM_": "VERMONT AVE", "TO_": "FIGUEROA ST" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-118.2920, 33.9620], [-118.2800, 33.9620]]
      }
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```javascript
// tests/lib/hin-overlay.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadHinNetwork, isOnHighInjuryNetwork } from '../../scripts/lib/hin-overlay.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '..', 'fixtures', 'sample-hin.geojson');

test('loadHinNetwork: parses a GeoJSON FeatureCollection into line segments', () => {
  const geojson = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const network = loadHinNetwork(geojson);
  assert.equal(network.length, 1);
  assert.equal(network[0].length, 2); // one LineString with 2 points -> 1 segment of 2 endpoints
});

test('isOnHighInjuryNetwork: true for a point directly on a segment', () => {
  const geojson = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const network = loadHinNetwork(geojson);
  const result = isOnHighInjuryNetwork({ lat: 33.9620, lng: -118.2860 }, network);
  assert.equal(result, true);
});

test('isOnHighInjuryNetwork: true for a point within 50m of a segment', () => {
  const geojson = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const network = loadHinNetwork(geojson);
  const result = isOnHighInjuryNetwork({ lat: 33.9624, lng: -118.2860 }, network); // ~45m north
  assert.equal(result, true);
});

test('isOnHighInjuryNetwork: false for a point far from any segment', () => {
  const geojson = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const network = loadHinNetwork(geojson);
  const result = isOnHighInjuryNetwork({ lat: 34.2000, lng: -118.5000 }, network);
  assert.equal(result, false);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/lib/hin-overlay.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement hin-overlay.mjs**

```javascript
// scripts/lib/hin-overlay.mjs
import { haversineMeters } from './geo.mjs';

const PROXIMITY_THRESHOLD_METERS = 50;

export function loadHinNetwork(geojson) {
  return geojson.features
    .filter((f) => f.geometry.type === 'LineString')
    .map((f) => f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })));
}

function distanceToSegment(point, a, b) {
  // Project point onto segment a-b in a local equirectangular approximation,
  // accurate enough at the ~50m scale we're testing against.
  const toXY = (p) => ({
    x: p.lng * Math.cos((a.lat * Math.PI) / 180),
    y: p.lat,
  });
  const pXY = toXY(point);
  const aXY = toXY(a);
  const bXY = toXY(b);

  const dx = bXY.x - aXY.x;
  const dy = bXY.y - aXY.y;
  const lengthSq = dx * dx + dy * dy;

  let t = lengthSq === 0 ? 0 : ((pXY.x - aXY.x) * dx + (pXY.y - aXY.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const closest = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return haversineMeters(point, closest);
}

export function isOnHighInjuryNetwork(point, network) {
  for (const line of network) {
    for (let i = 0; i < line.length - 1; i++) {
      if (distanceToSegment(point, line[i], line[i + 1]) <= PROXIMITY_THRESHOLD_METERS) {
        return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/lib/hin-overlay.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/hin-overlay.mjs tests/fixtures/sample-hin.geojson tests/lib/hin-overlay.test.mjs
git commit -m "feat: add LADOT High Injury Network proximity overlay"
```

---

### Task 8: build-intersections.mjs orchestrator

**Files:**
- Create: `scripts/build-intersections.mjs`
- Test: `tests/build-intersections.test.mjs`

Wires together Tasks 2–7: reads a CSV path and a HIN GeoJSON path, produces `data/intersections.json`. This task's own test runs the full pipeline against fixtures and writes to a temp path — it does not touch the real `data/` directory, since the real CSV doesn't exist until Task 10.

- [ ] **Step 1: Write the failing integration test**

```javascript
// tests/build-intersections.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIntersections } from '../scripts/build-intersections.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('buildIntersections: reads fixture CSV + HIN, writes ranked JSON', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ix-test-'));
  const outputPath = join(tmpDir, 'intersections.json');

  await buildIntersections({
    csvPath: join(__dirname, 'fixtures', 'sample-tims.csv'),
    hinPath: join(__dirname, 'fixtures', 'sample-hin.geojson'),
    outputPath,
    topN: 25,
  });

  const result = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.ok(Array.isArray(result.intersections));
  assert.ok(result.intersections.length >= 1);
  assert.equal(result.intersections[0].rank, 1);
  assert.ok(typeof result.dateGenerated === 'string');
  assert.ok(typeof result.yearRangeStart === 'number');
  assert.ok(typeof result.yearRangeEnd === 'number');
  assert.equal(result.yearRangeStart, 2020);
  assert.equal(result.yearRangeEnd, 2023);

  rmSync(tmpDir, { recursive: true, force: true });
});

test('buildIntersections: flags HIN membership on matching intersections', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ix-test-'));
  const outputPath = join(tmpDir, 'intersections.json');

  await buildIntersections({
    csvPath: join(__dirname, 'fixtures', 'sample-tims.csv'),
    hinPath: join(__dirname, 'fixtures', 'sample-hin.geojson'),
    outputPath,
    topN: 25,
  });

  const result = JSON.parse(readFileSync(outputPath, 'utf8'));
  const vermontManchester = result.intersections.find(
    (ix) => ix.streetA === 'MANCHESTER AVE' && ix.streetB === 'VERMONT AVE'
  );
  assert.equal(vermontManchester.onHighInjuryNetwork, true);

  rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-intersections.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement build-intersections.mjs**

```javascript
// scripts/build-intersections.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseTimsCsv } from './lib/parse-tims-csv.mjs';
import { aggregateIntersections } from './lib/aggregate-intersections.mjs';
import { loadHinNetwork, isOnHighInjuryNetwork } from './lib/hin-overlay.mjs';

export async function buildIntersections({ csvPath, hinPath, outputPath, topN }) {
  const csvText = readFileSync(csvPath, 'utf8');
  const crashes = parseTimsCsv(csvText);

  const hinGeojson = JSON.parse(readFileSync(hinPath, 'utf8'));
  const hinNetwork = loadHinNetwork(hinGeojson);

  const intersections = aggregateIntersections(crashes, { topN }).map((ix) => ({
    ...ix,
    onHighInjuryNetwork: isOnHighInjuryNetwork({ lat: ix.lat, lng: ix.lng }, hinNetwork),
  }));

  const years = crashes.map((c) => c.year);
  const output = {
    dateGenerated: new Date().toISOString().slice(0, 10),
    yearRangeStart: Math.min(...years),
    yearRangeEnd: Math.max(...years),
    totalCrashesAnalyzed: crashes.length,
    intersections,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  return output;
}

// Run directly: node scripts/build-intersections.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  await buildIntersections({
    csvPath: process.argv[2] || 'data/raw/tims-la-county.csv',
    hinPath: process.argv[3] || 'data/hin.geojson',
    outputPath: 'data/intersections.json',
    topN: 25,
  });
  console.log('Wrote data/intersections.json');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/build-intersections.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full test suite to confirm nothing regressed**

Run: `npm test`
Expected: all tests across every `tests/**/*.test.mjs` file PASS (36 tests total across Tasks 2–8).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-intersections.mjs tests/build-intersections.test.mjs
git commit -m "feat: add build-intersections orchestrator script"
```

---

### Task 9: Download and commit the real LADOT High Injury Network data

**Files:**
- Create: `data/hin.geojson`
- Create: `scripts/trim-hin.mjs` (one-off, not part of the build pipeline — run once here, kept for reproducibility on future refreshes)

This is real, public, unauthenticated data (unlike Task 10's TIMS export) — confirmed working during spec research.

- [ ] **Step 1: Download the raw HIN GeoJSON**

```bash
curl -L "https://hub.arcgis.com/api/download/v1/items/4ba1b8fa8d8946348b29261045298a88/geojson?redirect=true&layers=0" -o data/raw/hin-raw.geojson
```

Verify: `node -e "const d = JSON.parse(require('fs').readFileSync('data/raw/hin-raw.geojson')); console.log(d.type, d.features.length)"`
Expected output: `FeatureCollection 54` (or similar — LADOT updates this periodically, any count > 0 with `type: FeatureCollection` is correct).

- [ ] **Step 2: Write a trim script that keeps only the fields the overlay needs**

```javascript
// scripts/trim-hin.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/raw/hin-raw.geojson', 'utf8'));

const trimmed = {
  type: 'FeatureCollection',
  features: raw.features.map((f) => ({
    type: 'Feature',
    properties: {
      STNAME: f.properties.STNAME,
      FROM_: f.properties.FROM_,
      TO_: f.properties.TO_,
    },
    geometry: f.geometry,
  })),
};

writeFileSync('data/hin.geojson', JSON.stringify(trimmed));
console.log(`Trimmed ${raw.features.length} features -> data/hin.geojson`);
```

- [ ] **Step 3: Run it**

Run: `node scripts/trim-hin.mjs`
Expected: `Trimmed 54 features -> data/hin.geojson` (or current count).

- [ ] **Step 4: Verify the trimmed file is valid and reasonably sized**

Run: `node -e "const d = JSON.parse(require('fs').readFileSync('data/hin.geojson')); console.log(d.features.length, JSON.stringify(d).length + ' bytes')"`
Expected: feature count matches Step 1, file size well under 100KB.

- [ ] **Step 5: Commit**

```bash
git add data/hin.geojson scripts/trim-hin.mjs
git commit -m "data: add trimmed LADOT High Injury Network geojson"
```

Note: `data/raw/hin-raw.geojson` stays untracked (in `data/raw/`, gitignored by the `data` line added to `.assetsignore` in Task 1 — but `.assetsignore` only controls wrangler deploy, not git. If `git status` shows it as untracked and you don't want it committed, that's fine — it's a scratch download, not a build input; only `data/hin.geojson` (the trimmed output) needs to be tracked).

---

### Task 10: [HUMAN-IN-THE-LOOP] Obtain the real TIMS/SWITRS export

**This step cannot be performed by an automated agent.** TIMS (`https://tims.berkeley.edu/`) is account-gated — it requires creating a free account and receiving a password by email. The user must do this step personally.

- [ ] **Step 1: Create a TIMS account and log in**

Go to `https://tims.berkeley.edu/`, register for a free account, log in with the emailed password.

- [ ] **Step 2: Run a collision query with these exact parameters**

- Geography: Los Angeles County
- Date range: the 5 most recent complete calendar years available at export time
- Severity: select all injury and fatal severities; exclude property-damage-only
- Output: crash-level CSV (not summary/aggregate)

- [ ] **Step 3: Download and place the export**

Save the downloaded file as `data/raw/tims-la-county-<START>-<END>.csv` (e.g. `data/raw/tims-la-county-2021-2025.csv`), matching the actual years selected in Step 2.

- [ ] **Step 4: Verify the column headers match what the parser expects**

```bash
head -1 "data/raw/tims-la-county-<START>-<END>.csv"
```

Compare against `COLUMN_MAP` in `scripts/lib/parse-tims-csv.mjs` (Task 4). If any header name differs (TIMS export formats occasionally vary slightly from the raw SWITRS codebook names), update the corresponding value in `COLUMN_MAP` — that's the only place a header-name mismatch needs fixing.

- [ ] **Step 5: Run the real build**

```bash
node scripts/build-intersections.mjs "data/raw/tims-la-county-<START>-<END>.csv" data/hin.geojson
```

- [ ] **Step 6: Sanity-check the output**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('data/intersections.json'));
console.log('Intersections:', d.intersections.length);
console.log('Year range:', d.yearRangeStart, '-', d.yearRangeEnd);
console.log('Top 5:');
d.intersections.slice(0, 5).forEach(ix => console.log(' ', ix.rank, ix.streetA, '&', ix.streetB, '-', ix.crashCount, 'crashes'));
"
```

Manually check: are the top 5 streets real, well-known LA intersections (not obviously mis-normalized street names)? Does the crash count for #1 look plausible (dozens, not thousands — thousands would suggest the intersection-grouping key collapsed too aggressively)?

- [ ] **Step 7: Commit**

```bash
git add "data/raw/tims-la-county-<START>-<END>.csv" data/intersections.json
git commit -m "data: add TIMS/SWITRS export and generated intersections.json"
```

---

### Task 11: Vendor the Leaflet library

**Files:**
- Create: `vendor/leaflet/leaflet.js`
- Create: `vendor/leaflet/leaflet.css`
- Create: `vendor/leaflet/images/marker-icon.png`
- Create: `vendor/leaflet/images/marker-icon-2x.png`
- Create: `vendor/leaflet/images/marker-shadow.png`

Self-hosted per the spec (no CDN dependency) — mirrors this site's existing pattern of only depending on Google Fonts externally.

- [ ] **Step 1: Download Leaflet 1.9.4 (latest stable at time of writing)**

```bash
mkdir -p vendor/leaflet/images
curl -L "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" -o vendor/leaflet/leaflet.js
curl -L "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" -o vendor/leaflet/leaflet.css
curl -L "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" -o vendor/leaflet/images/marker-icon.png
curl -L "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png" -o vendor/leaflet/images/marker-icon-2x.png
curl -L "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" -o vendor/leaflet/images/marker-shadow.png
```

- [ ] **Step 2: Verify the download**

```bash
ls -la vendor/leaflet/ vendor/leaflet/images/
head -c 200 vendor/leaflet/leaflet.js
```
Expected: `leaflet.js` starts with a UMD wrapper comment (`/* @preserve\n * Leaflet ...`), `leaflet.css` is present, all three PNGs are present and non-zero size.

- [ ] **Step 3: Fix the CSS's relative image paths if needed**

Leaflet's `leaflet.css` references `images/marker-icon.png` etc. relative to its own location — since `vendor/leaflet/images/` sits alongside `vendor/leaflet/leaflet.css`, no path changes should be needed. Confirm:

```bash
grep -n "images/" vendor/leaflet/leaflet.css
```

- [ ] **Step 4: Commit**

```bash
git add vendor/leaflet
git commit -m "chore: vendor Leaflet 1.9.4 for the intersections map"
```

---

### Task 12: HTML template for the page

**Files:**
- Create: `templates/dangerous-intersections.template.html`

Full page markup, following the exact `<head>`/nav/footer pattern read from `car-accident-lawyer-los-angeles.html` in Task-planning research. Contains three injection markers that `scripts/build-page.mjs` (Task 14) replaces: `{{INTERSECTION_CARDS}}`, `{{INTERSECTIONS_JSON}}`, and `{{LAST_UPDATED}}` / `{{YEAR_RANGE}}` / `{{DATE_MODIFIED_ISO}}`.

- [ ] **Step 1: Write the template file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>25 Most Dangerous Intersections in LA County | Law Dog</title>
<meta name="description" content="Ranked by injury crashes over {{YEAR_RANGE}}, sourced from state SWITRS data. Interactive map of LA County's 25 most dangerous intersections, updated {{LAST_UPDATED}}.">
<link rel="canonical" href="https://getlawdog.com/dangerous-intersections-los-angeles">
<meta name="robots" content="index, follow">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="favicon-48.png">
<link rel="apple-touch-icon" sizes="180x180" href="favicon-180.png">
<meta property="og:title" content="25 Most Dangerous Intersections in LA County | Law Dog">
<meta property="og:description" content="An original, data-backed ranking of LA County's most dangerous intersections, built from state crash data and cross-referenced with LADOT's High Injury Network.">
<meta property="og:url" content="https://getlawdog.com/dangerous-intersections-los-angeles">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Law Dog">
<meta property="og:image" content="https://getlawdog.com/hero3.jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="25 Most Dangerous Intersections in LA County | Law Dog">
<meta name="twitter:description" content="Interactive map and ranking, built from state crash data. Updated {{LAST_UPDATED}}.">
<meta name="twitter:image" content="https://getlawdog.com/hero3.jpeg">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": ["LegalService", "Organization"],
  "name": "Law Dog — Dangerous Intersections in Los Angeles County",
  "description": "An original, data-backed ranking of LA County's most dangerous intersections by injury crash count, sourced from state SWITRS data and cross-referenced with LADOT's High Injury Network.",
  "url": "https://getlawdog.com/dangerous-intersections-los-angeles",
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
  "priceRange": "Contingency — no fee unless we win",
  "dateModified": "{{DATE_MODIFIED_ISO}}"
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://getlawdog.com/"},
    {"@type": "ListItem", "position": 2, "name": "Dangerous Intersections", "item": "https://getlawdog.com/dangerous-intersections-los-angeles"}
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "LA County Dangerous Intersections Ranking",
  "description": "Injury-and-fatal crash counts by intersection across Los Angeles County, {{YEAR_RANGE}}, aggregated from the California Statewide Integrated Traffic Records System (SWITRS) via UC Berkeley SafeTREC's Transportation Injury Mapping System (TIMS).",
  "url": "https://getlawdog.com/dangerous-intersections-los-angeles",
  "spatialCoverage": {
    "@type": "Place",
    "name": "Los Angeles County, California"
  },
  "temporalCoverage": "{{YEAR_RANGE}}",
  "dateModified": "{{DATE_MODIFIED_ISO}}",
  "creator": {
    "@type": "Organization",
    "name": "Law Dog Legal Group, APC"
  },
  "isBasedOn": {
    "@type": "Dataset",
    "name": "Statewide Integrated Traffic Records System (SWITRS)",
    "url": "https://tims.berkeley.edu/"
  }
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "What to do if you were hurt at a dangerous intersection",
  "step": [
    {"@type": "HowToStep", "position": 1, "name": "Preserve the scene", "text": "Don't move vehicles unless there's immediate danger — the exact point of impact matters for establishing fault at a known high-crash intersection."},
    {"@type": "HowToStep", "position": 2, "name": "Call 911 and get a police report", "text": "An official report is foundational to any claim, and doubly important at an intersection with a documented crash history."},
    {"@type": "HowToStep", "position": 3, "name": "Photograph the intersection", "text": "Signal timing, sightlines, signage, and road conditions — document exactly what made this intersection dangerous at the moment of your crash."},
    {"@type": "HowToStep", "position": 4, "name": "Get medical attention the same day", "text": "Adrenaline masks injuries. A same-day medical record is critical evidence, especially if fault is contested."},
    {"@type": "HowToStep", "position": 5, "name": "Do not give a recorded statement to any insurer", "text": "Tell any adjuster your attorney handles all communications, then call us before discussing the crash further."},
    {"@type": "HowToStep", "position": 6, "name": "Call Law Dog", "text": "Intersection camera footage overwrites in days. We send preservation letters and start building your case immediately."}
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How was this ranking calculated?",
      "acceptedAnswer": {"@type": "Answer", "text": "We aggregated {{YEAR_RANGE}} injury-and-fatal crash records from California's SWITRS database (via UC Berkeley SafeTREC's TIMS), grouped them by intersection, and ranked by raw injury-and-fatal crash count. We do not use a weighted \"danger score\" — a simple count avoids disputable methodology choices. Each entry also shows deaths, severe injuries, and total injured as separate figures."}
    },
    {
      "@type": "Question",
      "name": "Does a high ranking mean this intersection is inherently dangerous?",
      "acceptedAnswer": {"@type": "Answer", "text": "It means this intersection recorded the most injury crashes in state data over the period studied. That reflects a combination of factors — traffic volume, design, signal timing, and driver behavior among them. It is not a statement that any specific business, property owner, or the intersection's design alone caused any individual crash."}
    },
    {
      "@type": "Question",
      "name": "What is the LADOT High Injury Network?",
      "acceptedAnswer": {"@type": "Answer", "text": "It's the City of Los Angeles's own published map of street segments with the highest concentration of severe and fatal crashes, part of its Vision Zero initiative. We cross-reference our independent ranking against it — intersections marked \"On LADOT's High Injury Network\" appear on both the City's list and our independent SWITRS-based analysis."}
    },
    {
      "@type": "Question",
      "name": "Why doesn't this ranking account for traffic volume?",
      "acceptedAnswer": {"@type": "Answer", "text": "Reliable per-intersection traffic volume data doesn't exist for every location in this ranking. Crashes-per-vehicle would be the more precise danger measure, but a partial version of it would be misleading. We rank by raw injury-crash count and state this limitation directly rather than presenting an incomplete calculation as more rigorous than it is."}
    },
    {
      "@type": "Question",
      "name": "How often is this data updated?",
      "acceptedAnswer": {"@type": "Answer", "text": "Annually, as new SWITRS data becomes available through TIMS. The page displays the date it was last regenerated."}
    }
  ]
}
</script>

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-J5LER585NS"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-J5LER585NS');
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0">
<link rel="stylesheet" href="vendor/leaflet/leaflet.css">

<link rel="stylesheet" href="styles.css">
<style>
.ix-hero-bg {
  background-image:
    radial-gradient(ellipse at 100% 100%, rgba(244,5,2,.22) 0%, transparent 55%),
    radial-gradient(ellipse at 0% 50%,    rgba(155,72,113,.14) 0%, transparent 48%),
    radial-gradient(ellipse at 55% 0%,    rgba(255,255,255,.018) 0%, transparent 38%);
}
.ix-hero-bg::before {
  background: repeating-linear-gradient(
    -72deg, transparent 0px, transparent 120px,
    rgba(255,255,255,.012) 120px, rgba(255,255,255,.012) 121px
  );
}
</style>
</head>
<body>

<a class="skip-link" href="#main">Skip to content</a>

<nav id="nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo" aria-label="Law Dog — home">
      <div class="nav-logo-wrap">
        <img class="logo-white" src="logo_white.png" alt="Law Dog" height="99">
        <img class="logo-black" src="logo_black.png" alt="" aria-hidden="true" height="99">
      </div>
    </a>
    <ul class="nav-links">
      <li><a href="car-accident-lawyer-los-angeles">Car Accidents</a></li>
      <li><a href="slip-and-fall-lawyer-los-angeles">Slip &amp; Fall</a></li>
      <li><a href="motorcycle-accident-lawyer-los-angeles">Motorcycle</a></li>
      <li><a href="wrongful-death-lawyer-los-angeles">Wrongful Death</a></li>
    </ul>
    <div class="nav-right">
      <a href="tel:+18334529364" class="nav-phone">(833) 4LAWDOG</a>
      <a href="get-started" class="nav-cta">Free case review →</a>
      <button class="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false" aria-controls="mobileMenu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</nav>

<div class="mobile-menu" id="mobileMenu">
  <ul>
    <li><a href="car-accident-lawyer-los-angeles">Car Accidents</a></li>
    <li><a href="slip-and-fall-lawyer-los-angeles">Slip &amp; Fall</a></li>
    <li><a href="motorcycle-accident-lawyer-los-angeles">Motorcycle</a></li>
    <li><a href="wrongful-death-lawyer-los-angeles">Wrongful Death</a></li>
    <li><a href="get-started">Free Case Review</a></li>
  </ul>
  <a href="tel:+18334529364" class="mm-call">Call (833) 4LAWDOG</a>
</div>

<main id="main">

<header class="ix-hero-bg">
  <div class="ca-hero">
    <nav class="ca-breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span class="bc-sep" aria-hidden="true">/</span>
      <span class="bc-current" aria-current="page">Dangerous Intersections</span>
    </nav>

    <h1 class="ca-headline">
      LA County's 25 most<br>
      <span class="dim">dangerous intersections.</span>
    </h1>

    <p class="ca-sub">
      Ranked by injury-and-fatal crashes over {{YEAR_RANGE}}, using California's SWITRS crash database — not estimates, not a proprietary score. Cross-referenced against LADOT's own High Injury Network.
    </p>

    <div class="ca-actions">
      <a href="get-started" class="btn-primary">Hurt at one of these? Free case review <span style="opacity:.55">→</span></a>
      <a href="tel:+18334529364" class="btn-secondary">Call (833) 4LAWDOG</a>
    </div>
  </div>
</header>

<section class="intro-section" id="overview">
  <div class="intro-copy">
    <p class="section-eyebrow reveal">The data</p>
    <h2 class="reveal">A ranked, sourced list — not a guess.</h2>
    <p class="reveal d1">
      We pulled every injury and fatal crash recorded in Los Angeles County over {{YEAR_RANGE}} from California's Statewide Integrated Traffic Records System (SWITRS), via UC Berkeley SafeTREC's Transportation Injury Mapping System. We grouped crashes by intersection and ranked by raw injury-crash count — no weighted "danger score," because a simple count is a claim nobody can meaningfully dispute.
    </p>
    <p class="reveal d1">
      Each entry below also shows deaths, severe injuries, and total injured as separate figures, plus whether it appears on LADOT's own published Vision Zero High Injury Network. Full methodology and limitations are below the map.
    </p>
  </div>
</section>

<section class="ix-map-section" id="map">
  <div id="ix-map" role="img" aria-label="Interactive map of LA County's most dangerous intersections"></div>
</section>

<section class="ix-list-section" id="ranked-list">
  <div class="ix-list-inner">
    <p class="section-eyebrow reveal">Ranked by injury crashes, {{YEAR_RANGE}}</p>
    <h2 class="section-heading reveal">The full list.</h2>
    <p class="section-sub reveal d1">Tap any entry for the severity breakdown, crash type, and whether it's on LADOT's High Injury Network.</p>

    <ol class="ix-card-list">
{{INTERSECTION_CARDS}}
    </ol>
  </div>
</section>

<section class="ix-methodology-section" id="methodology">
  <div class="ix-methodology-inner">
    <p class="section-eyebrow reveal">Methodology</p>
    <h2 class="reveal">How we built this ranking.</h2>
    <p class="reveal d1"><strong>Data source:</strong> California SWITRS crash records for Los Angeles County, {{YEAR_RANGE}}, injury and fatal severities only, via UC Berkeley SafeTREC's TIMS. We did not use the City of LA's own collision open-data feed — it hasn't been updated since March 2025 and shows a reporting-methodology break in 2021 that would distort any ranking built on it.</p>
    <p class="reveal d1"><strong>Grouping:</strong> crashes were matched to intersections by normalized street-pair name, then spatially validated — two streets that cross in more than one place in the county are kept as separate entries rather than merged.</p>
    <p class="reveal d1"><strong>Ranking:</strong> raw count of injury-and-fatal crashes. No weighting, no composite score.</p>
    <p class="reveal d1"><strong>What this doesn't measure:</strong> crashes per vehicle passing through. That would be the more precise danger measure, but reliable traffic-volume data doesn't exist for every intersection here — we'd rather state that limitation than present a partial calculation as more rigorous than it is.</p>
    <p class="reveal d1"><strong>Framing:</strong> a high ranking means this intersection recorded the most injury crashes in state data over the period — not that the location, a nearby property, or any specific party caused any individual crash.</p>
  </div>
</section>

<section class="playbook-section" id="what-to-do">
  <div class="playbook-sticky">
    <p class="section-eyebrow reveal">If you were hurt here</p>
    <h2 class="reveal">What to do after a crash at a dangerous intersection.</h2>
    <p class="reveal d1">The first hour determines more of your case than you realize. Follow these steps exactly.</p>
    <a href="get-started" class="btn-primary reveal d2">Tell us what happened <span style="opacity:.55">→</span></a>
  </div>

  <div class="steps-list">
    <div class="step-item reveal">
      <div class="step-num">1</div>
      <div class="step-body">
        <div class="step-tag">At the scene</div>
        <div class="step-title">Preserve the scene</div>
        <p>Don't move vehicles unless there's immediate danger — the exact point of impact matters for establishing fault at a known high-crash intersection.</p>
      </div>
    </div>
    <div class="step-item reveal d1">
      <div class="step-num">2</div>
      <div class="step-body">
        <div class="step-tag">At the scene</div>
        <div class="step-title">Call 911. Get a police report.</div>
        <p>An official report is foundational to any claim, and doubly important at an intersection with a documented crash history.</p>
      </div>
    </div>
    <div class="step-item reveal d2">
      <div class="step-num">3</div>
      <div class="step-body">
        <div class="step-tag">At the scene</div>
        <div class="step-title">Photograph the intersection itself</div>
        <p>Signal timing, sightlines, signage, and road conditions — document exactly what made this intersection dangerous at the moment of your crash.</p>
      </div>
    </div>
    <div class="step-item reveal">
      <div class="step-num">4</div>
      <div class="step-body">
        <div class="step-tag">Same day</div>
        <div class="step-title">Get medical attention today</div>
        <p>Adrenaline masks injuries. A same-day medical record is critical evidence, especially if fault is contested.</p>
      </div>
    </div>
    <div class="step-item reveal d1">
      <div class="step-num">5</div>
      <div class="step-body">
        <div class="step-tag">Within 24 hours</div>
        <div class="step-title">Don't talk to any insurance adjuster</div>
        <p>Tell any adjuster your attorney handles all communications, then call us before discussing the crash further.</p>
      </div>
    </div>
    <div class="step-item reveal d2">
      <div class="step-num">6</div>
      <div class="step-body">
        <div class="step-tag">As soon as possible</div>
        <div class="step-title">Call Law Dog</div>
        <p>Intersection camera footage overwrites in days. We send preservation letters and start building your case immediately.</p>
      </div>
    </div>
  </div>
</section>

<section class="faq-section" id="faq">
  <div class="faq-header">
    <p class="section-eyebrow reveal">Frequently asked questions</p>
    <h2 class="section-heading reveal">About this ranking.</h2>
  </div>

  <div class="faq-list" role="list">
    <div class="faq-item" role="listitem">
      <button class="faq-trigger" aria-expanded="false">
        How was this ranking calculated?
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-body">
        <div class="faq-body-inner">We aggregated {{YEAR_RANGE}} injury-and-fatal crash records from California's SWITRS database (via UC Berkeley SafeTREC's TIMS), grouped them by intersection, and ranked by raw injury-crash count. We do not use a weighted "danger score" — a simple count avoids disputable methodology choices. Each entry also shows deaths, severe injuries, and total injured as separate figures.</div>
      </div>
    </div>
    <div class="faq-item" role="listitem">
      <button class="faq-trigger" aria-expanded="false">
        Does a high ranking mean this intersection is inherently dangerous?
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-body">
        <div class="faq-body-inner">It means this intersection recorded the most injury crashes in state data over the period studied. That reflects a combination of factors — traffic volume, design, signal timing, and driver behavior among them. It is not a statement that any specific business, property owner, or the intersection's design alone caused any individual crash.</div>
      </div>
    </div>
    <div class="faq-item" role="listitem">
      <button class="faq-trigger" aria-expanded="false">
        What is the LADOT High Injury Network?
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-body">
        <div class="faq-body-inner">It's the City of Los Angeles's own published map of street segments with the highest concentration of severe and fatal crashes, part of its Vision Zero initiative. We cross-reference our independent ranking against it — intersections marked "On LADOT's High Injury Network" appear on both the City's list and our independent SWITRS-based analysis.</div>
      </div>
    </div>
    <div class="faq-item" role="listitem">
      <button class="faq-trigger" aria-expanded="false">
        Why doesn't this ranking account for traffic volume?
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-body">
        <div class="faq-body-inner">Reliable per-intersection traffic volume data doesn't exist for every location in this ranking. Crashes-per-vehicle would be the more precise danger measure, but a partial version of it would be misleading. We rank by raw injury-crash count and state this limitation directly rather than presenting an incomplete calculation as more rigorous than it is.</div>
      </div>
    </div>
    <div class="faq-item" role="listitem">
      <button class="faq-trigger" aria-expanded="false">
        How often is this data updated?
        <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-body">
        <div class="faq-body-inner">Annually, as new SWITRS data becomes available through TIMS. This page was last regenerated on {{LAST_UPDATED}}.</div>
      </div>
    </div>
  </div>
</section>

<section class="area-cta-band-wrap">
  <div class="area-cta-band reveal">
    <div>
      <h3>Recognize an intersection on this list?</h3>
      <p>If you were hurt in a crash there, the consultation is free and takes less than 15 minutes.</p>
    </div>
    <div class="area-cta-actions">
      <a href="get-started" class="btn-primary">Start your case →</a>
      <a href="tel:+18334529364" class="btn-secondary">Call (833) 4LAWDOG</a>
    </div>
  </div>
  <p class="ix-last-updated">Last updated {{LAST_UPDATED}}</p>
</section>

</main>

<div class="footer-wrap">
  <footer>
    <div class="footer-grid">
      <div>
        <div class="footer-logo">
          <img src="logo_white.png" alt="Law Dog">
        </div>
        <p class="footer-brand-desc">Personal injury trial attorneys serving Los Angeles and Orange County. No fee unless we win.</p>
      </div>
      <div class="footer-col">
        <h5>Practice Areas</h5>
        <ul>
          <li><a href="car-accident-lawyer-los-angeles">Car Accidents</a></li>
          <li><a href="truck-accident-lawyer-los-angeles">Truck Accidents</a></li>
          <li><a href="motorcycle-accident-lawyer-los-angeles">Motorcycle Accidents</a></li>
          <li><a href="pedestrian-accident-lawyer-los-angeles">Pedestrian &amp; Bicycle</a></li>
          <li><a href="wrongful-death-lawyer-los-angeles">Wrongful Death</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Firm</h5>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="law_dog_personal_injury#why-law-dog">Why Law Dog</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Legal</h5>
        <ul>
          <li><a href="privacy-policy">Privacy Policy</a></li>
          <li><a href="terms">Terms of Use</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5>Contact</h5>
        <ul>
          <li><a href="tel:+18334529364">(833) 4LAWDOG</a></li>
          <li><a href="mailto:hello@getlawdog.com">hello@getlawdog.com</a></li>
          <li><a href="get-started">Free Case Review</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-copy">© 2026 Law Dog Legal Group, APC. All rights reserved.</span>
      <p class="footer-disc">Attorney advertising. Licensed to practice law in California. No fee if no recovery. This page presents an original analysis of public crash data for informational purposes and does not constitute legal advice. No attorney-client relationship is formed by reading this page.</p>
    </div>
  </footer>
</div>

<div class="call-bar">
  <a href="tel:+18334529364" class="cb-call">Call (833) 4LAWDOG</a>
  <a href="get-started" class="cb-start">Free case review →</a>
</div>

<script src="vendor/leaflet/leaflet.js"></script>
<script type="application/json" id="ix-data">
{{INTERSECTIONS_JSON}}
</script>

<script>
(function() {
  const nav = document.getElementById('nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

(function() {
  const nav    = document.getElementById('nav');
  const burger = document.getElementById('navBurger');
  const menu   = document.getElementById('mobileMenu');
  function closeMenu() {
    nav.classList.remove('menu-open');
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
  }
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('open');
    nav.classList.toggle('menu-open', open);
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
})();

(function() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.07, rootMargin: '0px 0px -32px 0px' });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();

(function() {
  const steps = document.querySelectorAll('.playbook-section .step-item');
  if (!steps.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    steps.forEach(s => s.classList.add('active'));
    return;
  }
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('active'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.5, rootMargin: '0px 0px -10% 0px' });
  steps.forEach(s => obs.observe(s));
})();

(function() {
  document.querySelectorAll('.faq-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const body   = item.querySelector('.faq-body');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(open => {
        open.classList.remove('open');
        open.querySelector('.faq-body').style.maxHeight = '0';
        open.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

(function() {
  document.querySelectorAll('a[href^="tel:"]').forEach(function(el) {
    el.addEventListener('click', function() {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'phone_click', { page_path: window.location.pathname });
      }
    });
  });
})();
</script>

<script src="ix-map.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the template is well-formed HTML**

```bash
node -e "
const html = require('fs').readFileSync('templates/dangerous-intersections.template.html', 'utf8');
['{{INTERSECTION_CARDS}}', '{{INTERSECTIONS_JSON}}', '{{LAST_UPDATED}}', '{{YEAR_RANGE}}', '{{DATE_MODIFIED_ISO}}'].forEach(marker => {
  const count = html.split(marker).length - 1;
  console.log(marker, ':', count, 'occurrence(s)');
});
"
```
Expected: `{{INTERSECTION_CARDS}}` and `{{INTERSECTIONS_JSON}}` each appear once; `{{LAST_UPDATED}}`, `{{YEAR_RANGE}}`, `{{DATE_MODIFIED_ISO}}` appear multiple times (all must be replaced by Task 14's build script — a simple global string replace, not a templating engine, handles this fine).

- [ ] **Step 3: Verify the meta description length is in the required 140–160 char range once placeholders are filled**

```bash
echo -n "Ranked by injury crashes over 2021-2025, sourced from state SWITRS data. Interactive map of LA County's 25 most dangerous intersections, updated 2026-08-13." | wc -m
```
Expected: a number between 140 and 160. If out of range once real placeholder values are known (Task 14), adjust the description text in this template accordingly — the exact year range and date aren't known until the real data lands in Task 10, so this is a final check to repeat once Task 14 generates the real page.

- [ ] **Step 4: Commit**

```bash
git add templates/dangerous-intersections.template.html
git commit -m "feat: add HTML template for dangerous-intersections page"
```

---

### Task 13: Card renderer

**Files:**
- Create: `scripts/lib/render-card.mjs`
- Test: `tests/lib/render-card.test.mjs`

Renders one aggregated intersection object into the server-rendered `<li>` card HTML (rank, street names, headline count, badges, and a `<details>` panel with the full breakdown — no JavaScript required for any of this content to be present and readable).

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/lib/render-card.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../../scripts/lib/render-card.mjs';

function sampleIntersection(overrides) {
  return {
    rank: 1, streetA: 'MANCHESTER AVE', streetB: 'VERMONT AVE', slug: 'manchester-ave-vermont-ave',
    lat: 33.9622, lng: -118.2915, crashCount: 42, killed: 2, totalInjured: 58, severeInjuryCrashes: 9,
    pedestrian: true, bicycle: false, motorcycle: true, truck: false, alcoholRate: 0.12,
    dominantCollisionType: 'D', dominantCollisionTypeLabel: 'Broadside (T-Bone)',
    matchedPracticePage: 'pedestrian-accident-lawyer-los-angeles',
    onHighInjuryNetwork: true,
    ...overrides,
  };
}

test('renders rank, street names, and headline crash count', () => {
  const html = renderCard(sampleIntersection());
  assert.match(html, /#1/);
  assert.match(html, /MANCHESTER AVE/);
  assert.match(html, /VERMONT AVE/);
  assert.match(html, /42 injury crashes/);
});

test('includes a data-slug attribute and matching id for map<->card linking', () => {
  const html = renderCard(sampleIntersection());
  assert.match(html, /data-slug="manchester-ave-vermont-ave"/);
  assert.match(html, /id="ix-manchester-ave-vermont-ave"/);
});

test('includes lat/lng data attributes for the map script', () => {
  const html = renderCard(sampleIntersection());
  assert.match(html, /data-lat="33.9622"/);
  assert.match(html, /data-lng="-118.2915"/);
});

test('renders severity breakdown inside a native details/summary panel', () => {
  const html = renderCard(sampleIntersection());
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /Killed[\s\S]*2/);
  assert.match(html, /Severe injury crashes[\s\S]*9/);
  assert.match(html, /Total injured[\s\S]*58/);
});

test('shows the HIN badge when onHighInjuryNetwork is true', () => {
  const html = renderCard(sampleIntersection({ onHighInjuryNetwork: true }));
  assert.match(html, /LADOT's High Injury Network/);
});

test('shows nothing misleading when onHighInjuryNetwork is false', () => {
  const html = renderCard(sampleIntersection({ onHighInjuryNetwork: false }));
  assert.doesNotMatch(html, /LADOT's High Injury Network/);
});

test('links the CTA to get-started with a tracked source and intersection param', () => {
  const html = renderCard(sampleIntersection());
  assert.match(html, /href="get-started\?source=intersection-map&amp;intersection=manchester-ave-vermont-ave"/);
  assert.match(html, /data-ix-cta="manchester-ave-vermont-ave"/);
});

test('links to the matched practice page', () => {
  const html = renderCard(sampleIntersection({ matchedPracticePage: 'motorcycle-accident-lawyer-los-angeles' }));
  assert.match(html, /href="motorcycle-accident-lawyer-los-angeles"/);
});

test('escapes street names to prevent HTML injection from data', () => {
  const html = renderCard(sampleIntersection({ streetA: 'MLK JR, BLVD <script>' }));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/lib/render-card.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement render-card.mjs**

```javascript
// scripts/lib/render-card.mjs
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MODE_ICONS = [
  ['pedestrian', 'directions_walk', 'Pedestrian involved'],
  ['bicycle', 'directions_walk', 'Bicycle involved'],
  ['motorcycle', 'two_wheeler', 'Motorcycle involved'],
  ['truck', 'local_shipping', 'Truck involved'],
];

function renderBadges(ix) {
  const modeBadges = MODE_ICONS.filter(([key]) => ix[key])
    .map(([, icon, label]) => `
        <span class="ix-badge">
          <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
          ${escapeHtml(label)}
        </span>`)
    .join('');

  const hinBadge = ix.onHighInjuryNetwork
    ? `
        <span class="ix-badge ix-badge-hin">
          <span class="material-symbols-outlined" aria-hidden="true">verified</span>
          On LADOT's High Injury Network
        </span>`
    : '';

  return modeBadges + hinBadge;
}

export function renderCard(ix) {
  const practiceLabel = ix.matchedPracticePage
    .replace('-lawyer-los-angeles', '')
    .replace('-accident', '')
    .replace(/-/g, ' ');

  return `
      <li class="ix-card" id="ix-${ix.slug}" data-slug="${ix.slug}" data-lat="${ix.lat}" data-lng="${ix.lng}">
        <div class="ix-card-head">
          <span class="ix-rank">#${ix.rank}</span>
          <h3 class="ix-title">${escapeHtml(ix.streetA)} &amp; ${escapeHtml(ix.streetB)}</h3>
          <span class="ix-count">${ix.crashCount} injury crashes</span>
        </div>
        <div class="ix-badges">${renderBadges(ix)}
        </div>
        <details class="ix-details">
          <summary>Crash details
            <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </summary>
          <div class="ix-details-body">
            <div class="ix-stat-row"><span>Killed</span><span>${ix.killed}</span></div>
            <div class="ix-stat-row"><span>Severe injury crashes</span><span>${ix.severeInjuryCrashes}</span></div>
            <div class="ix-stat-row"><span>Total injured</span><span>${ix.totalInjured}</span></div>
            <div class="ix-stat-row"><span>Most common crash type</span><span>${escapeHtml(ix.dominantCollisionTypeLabel)}</span></div>
            <div class="ix-stat-row"><span>Alcohol involved</span><span>${Math.round(ix.alcoholRate * 100)}% of crashes</span></div>
            <a href="get-started?source=intersection-map&amp;intersection=${ix.slug}" class="ix-cta" data-ix-cta="${ix.slug}">Hurt in a crash here? Get a free case review →</a>
            <a href="${ix.matchedPracticePage}" class="ix-secondary-link">Learn about ${escapeHtml(practiceLabel)} claims →</a>
          </div>
        </details>
      </li>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/lib/render-card.test.mjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/render-card.mjs tests/lib/render-card.test.mjs
git commit -m "feat: add intersection card renderer"
```

---

### Task 14: build-page.mjs orchestrator

**Files:**
- Create: `scripts/build-page.mjs`
- Test: `tests/build-page.test.mjs`

Reads `data/intersections.json` + `templates/dangerous-intersections.template.html`, renders all cards, fills every placeholder, and writes the final static page. Also generates the Astro-facing copy of the data (Task 17 imports `data/intersections.json` directly, so no extra step needed there — noted here to avoid duplicating logic).

- [ ] **Step 1: Write the failing integration test**

```javascript
// tests/build-page.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPage } from '../scripts/build-page.mjs';

test('buildPage: fills every placeholder and embeds all cards', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'page-test-'));
  const templatePath = join(tmpDir, 'template.html');
  const outputPath = join(tmpDir, 'output.html');

  writeFileSync(templatePath, `<html><body>
Year range: {{YEAR_RANGE}}
Updated: {{LAST_UPDATED}}
Modified: {{DATE_MODIFIED_ISO}}
<ol>{{INTERSECTION_CARDS}}</ol>
<script id="ix-data">{{INTERSECTIONS_JSON}}</script>
</body></html>`);

  const intersectionsData = {
    dateGenerated: '2026-08-13',
    yearRangeStart: 2021,
    yearRangeEnd: 2025,
    totalCrashesAnalyzed: 500,
    intersections: [
      {
        rank: 1, streetA: 'MANCHESTER AVE', streetB: 'VERMONT AVE', slug: 'manchester-ave-vermont-ave',
        lat: 33.9622, lng: -118.2915, crashCount: 42, killed: 2, totalInjured: 58, severeInjuryCrashes: 9,
        pedestrian: true, bicycle: false, motorcycle: false, truck: false, alcoholRate: 0.12,
        dominantCollisionType: 'D', dominantCollisionTypeLabel: 'Broadside (T-Bone)',
        matchedPracticePage: 'pedestrian-accident-lawyer-los-angeles', onHighInjuryNetwork: true,
      },
    ],
  };

  buildPage({ templatePath, dataObject: intersectionsData, outputPath });

  const output = readFileSync(outputPath, 'utf8');
  assert.doesNotMatch(output, /\{\{/); // no unfilled placeholders remain
  assert.match(output, /Year range: 2021-2025/);
  assert.match(output, /Updated: /);
  assert.match(output, /MANCHESTER AVE/);
  assert.match(output, /"streetA": "MANCHESTER AVE"/);

  rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/build-page.test.mjs`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement build-page.mjs**

```javascript
// scripts/build-page.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { renderCard } from './lib/render-card.mjs';

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export function buildPage({ templatePath, dataObject, outputPath }) {
  const template = readFileSync(templatePath, 'utf8');
  const yearRange = `${dataObject.yearRangeStart}-${dataObject.yearRangeEnd}`;
  const cardsHtml = dataObject.intersections.map(renderCard).join('\n');

  const filled = template
    .replaceAll('{{YEAR_RANGE}}', yearRange)
    .replaceAll('{{LAST_UPDATED}}', formatDate(dataObject.dateGenerated))
    .replaceAll('{{DATE_MODIFIED_ISO}}', dataObject.dateGenerated)
    .replace('{{INTERSECTION_CARDS}}', cardsHtml)
    .replace('{{INTERSECTIONS_JSON}}', JSON.stringify(dataObject.intersections, null, 2));

  writeFileSync(outputPath, filled);
  return filled;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataObject = JSON.parse(readFileSync('data/intersections.json', 'utf8'));
  buildPage({
    templatePath: 'templates/dangerous-intersections.template.html',
    dataObject,
    outputPath: 'dangerous-intersections-los-angeles.html',
  });
  console.log('Wrote dangerous-intersections-los-angeles.html');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/build-page.test.mjs`
Expected: PASS, 1 test.

- [ ] **Step 5: Run the real build against the real data from Task 10**

```bash
node scripts/build-page.mjs
```
Expected: `Wrote dangerous-intersections-los-angeles.html`, and `git status` shows the new file at the repo root.

- [ ] **Step 6: Re-check the meta description length against the real filled values**

```bash
grep -o 'name="description" content="[^"]*"' dangerous-intersections-los-angeles.html | sed 's/.*content="//;s/"$//' | wc -m
```
Expected: 140–160. If out of range, adjust the description text in `templates/dangerous-intersections.template.html` (Task 12) and rerun this task's Step 5.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass (46 tests total across Tasks 2–8 and 13–14).

- [ ] **Step 8: Commit**

```bash
git add scripts/build-page.mjs tests/build-page.test.mjs dangerous-intersections-los-angeles.html
git commit -m "feat: add build-page orchestrator and generate the static page"
```

---

### Task 15: CSS for the map, card list, and badges

**Files:**
- Modify: `styles.css`

Reuses the existing design vocabulary confirmed by reading `styles.css` directly (CSS custom properties, `.fact-card`/`.faq-item`/`.step-item` patterns) rather than inventing new visual language.

- [ ] **Step 1: Add the new rules to the end of styles.css**

```css
/* ══════ DANGEROUS INTERSECTIONS MAP ══════ */
.ix-map-section { padding: 0 24px 80px; max-width: 1180px; margin: 0 auto; }
#ix-map { height: 520px; border-radius: 16px; border: 1px solid var(--gray-200); z-index: 1; }

.ix-list-section { padding: 0 24px 100px; max-width: 1180px; margin: 0 auto; }
.ix-list-inner { max-width: 780px; }

.ix-card-list { list-style: none; margin: 40px 0 0; padding: 0; display: flex; flex-direction: column; gap: 1px; background: var(--gray-200); border: 1px solid var(--gray-200); border-radius: 12px; overflow: hidden; }

.ix-card { background: var(--white); padding: 24px 28px; scroll-margin-top: 100px; transition: background .3s; }
.ix-card.active { background: var(--gray-100); }

.ix-card-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.ix-rank { font-size: 13px; font-weight: 800; color: var(--gray-400); letter-spacing: -.02em; flex-shrink: 0; }
.ix-title { font-size: 18px; font-weight: 700; letter-spacing: -.02em; color: var(--black); flex: 1 1 auto; min-width: 200px; }
.ix-count { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; }

.ix-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ix-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--gray-500); background: var(--gray-100); border-radius: 6px; padding: 5px 10px; }
.ix-badge .material-symbols-outlined { font-size: 15px; font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
.ix-badge-hin { color: var(--accent); background: rgba(244,5,2,.08); }

.ix-details { margin-top: 14px; }
.ix-details summary { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--gray-700); cursor: pointer; list-style: none; }
.ix-details summary::-webkit-details-marker { display: none; }
.ix-details summary .faq-chevron { width: 16px; height: 16px; transition: transform .3s; }
.ix-details[open] summary .faq-chevron { transform: rotate(180deg); }

.ix-details-body { padding: 18px 0 4px; display: flex; flex-direction: column; gap: 10px; }
.ix-stat-row { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid var(--gray-100); }
.ix-stat-row span:first-child { color: var(--gray-500); }
.ix-stat-row span:last-child { font-weight: 700; color: var(--black); }

.ix-cta { display: block; text-align: center; margin-top: 14px; background: var(--gradient); color: var(--white); font-size: 14px; font-weight: 700; padding: 13px; border-radius: 10px; text-decoration: none; }
.ix-secondary-link { display: block; text-align: center; margin-top: 10px; font-size: 13px; font-weight: 600; color: var(--gray-500); text-decoration: none; }
.ix-secondary-link:hover { color: var(--black); }

.ix-methodology-section { padding: 0 24px 100px; max-width: 780px; margin: 0 auto; }
.ix-methodology-section p { color: var(--gray-500); font-size: 15px; line-height: 1.78; margin-bottom: 18px; }

.ix-last-updated { text-align: center; font-size: 12px; color: var(--gray-400); margin-top: 20px; }

.area-cta-band-wrap { padding: 0 24px 60px; max-width: 1180px; margin: 0 auto; }

@media (max-width: 720px) {
  #ix-map { height: 380px; }
  .ix-card { padding: 20px; }
}
```

- [ ] **Step 2: Verify no CSS syntax errors and no duplicate top-level selectors that would fight prior rules**

```bash
node -e "
const css = require('fs').readFileSync('styles.css', 'utf8');
const opens = (css.match(/\{/g) || []).length;
const closes = (css.match(/\}/g) || []).length;
console.log('braces balanced:', opens === closes, opens, closes);
"
```
Expected: `braces balanced: true`.

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat: add CSS for intersections map, card list, and badges"
```

---

### Task 16: Map interaction script and browser verification

**Files:**
- Create: `ix-map.js`

- [ ] **Step 1: Write ix-map.js**

```javascript
// ix-map.js
(function() {
  const dataEl = document.getElementById('ix-data');
  if (!dataEl || typeof L === 'undefined') return;

  let intersections;
  try {
    intersections = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }
  if (!Array.isArray(intersections) || intersections.length === 0) return;

  const map = L.map('ix-map', { scrollWheelZoom: false }).setView([34.02, -118.35], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a> contributors',
  }).addTo(map);

  const bounds = [];
  const markers = {};

  intersections.forEach(function(ix) {
    const marker = L.marker([ix.lat, ix.lng]).addTo(map);
    marker.bindTooltip('#' + ix.rank + ' ' + ix.streetA + ' & ' + ix.streetB);
    marker.on('click', function() { openCard(ix.slug); });
    markers[ix.slug] = marker;
    bounds.push([ix.lat, ix.lng]);
  });

  if (bounds.length > 0) map.fitBounds(bounds, { padding: [24, 24] });

  function clearActiveCards() {
    document.querySelectorAll('.ix-card.active').forEach(function(el) {
      el.classList.remove('active');
    });
  }

  function openCard(slug) {
    clearActiveCards();
    const card = document.getElementById('ix-' + slug);
    if (!card) return;
    card.classList.add('active');
    const details = card.querySelector('details');
    if (details) details.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.querySelectorAll('.ix-card details').forEach(function(details) {
    details.addEventListener('toggle', function() {
      if (!details.open) return;
      const card = details.closest('.ix-card');
      const slug = card.dataset.slug;
      const marker = markers[slug];
      if (marker) map.panTo(marker.getLatLng());
      clearActiveCards();
      card.classList.add('active');
    });
  });

  document.querySelectorAll('[data-ix-cta]').forEach(function(el) {
    el.addEventListener('click', function() {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'intersection_cta_click', {
          intersection: el.dataset.ixCta,
          page_path: window.location.pathname,
        });
      }
    });
  });
})();
```

- [ ] **Step 2: Verify the script has no syntax errors**

Run: `node --check ix-map.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add ix-map.js
git commit -m "feat: add map/card interaction script"
```

- [ ] **Step 4: Browser verification**

Start a local static server and open the page:

```bash
python3 -m http.server 8080
```

Then, using the browser preview tooling: navigate to `http://localhost:8080/dangerous-intersections-los-angeles.html`, and check:
1. `read_console_messages` — zero errors (in particular, no Leaflet "map container not found" or JSON parse errors).
2. `read_page` — the ranked list contains all 25 `<li class="ix-card">` entries with visible rank/street/count text (server-rendered, confirms JS-off content is present).
3. Click a map pin via `computer` — the matching card should scroll into view and its `<details>` should open (confirmed via a follow-up `read_page` showing `open` on that `<details>` element).
4. Click a different card's `<summary>` — the map should pan to that intersection's marker (visually confirmed via `computer` screenshot).
5. `resize_window` to mobile preset, confirm the map and cards remain usable (map height 380px per the media query in Task 15).

Fix any issues found by reading and editing `ix-map.js`, `templates/dangerous-intersections.template.html`, or `styles.css`, then rerun `node scripts/build-page.mjs` to regenerate the static HTML and re-check.

---

### Task 17: Astro page

**Files:**
- Create: `src/pages/dangerous-intersections-los-angeles.astro`

Imports `data/intersections.json` directly at build time — no separate generator script needed on the Astro side, so it cannot drift from the static page's data. First, confirm the existing Astro layout/component API by reading one existing page.

- [ ] **Step 1: Read an existing Astro page to match its exact import and component pattern**

```bash
cat src/pages/get-started.astro | head -40
ls src/layouts src/components
```

- [ ] **Step 2: Write the Astro page**

Adapt the following to match whatever `BaseLayout`/`Nav`/`Footer`/`CallBar` props were found in Step 1 (this is a placeholder for the exact import signature — everything else, including the data wiring and rendered markup, is concrete):

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import CallBar from '../components/CallBar.astro';
import intersectionsData from '../../data/intersections.json';

const { intersections, yearRangeStart, yearRangeEnd, dateGenerated } = intersectionsData;
const yearRange = `${yearRangeStart}-${yearRangeEnd}`;
---
<BaseLayout
  title="25 Most Dangerous Intersections in LA County | Law Dog"
  description={`Ranked by injury crashes over ${yearRange}, sourced from state SWITRS data. Interactive map of LA County's 25 most dangerous intersections, updated ${dateGenerated}.`}
  canonicalPath="/dangerous-intersections-los-angeles"
>
  <Nav />
  <main id="main">
    <header class="ix-hero-bg">
      <div class="ca-hero">
        <h1 class="ca-headline">LA County's 25 most<br><span class="dim">dangerous intersections.</span></h1>
        <p class="ca-sub">Ranked by injury-and-fatal crashes over {yearRange}, using California's SWITRS crash database.</p>
      </div>
    </header>

    <section class="ix-list-section" id="ranked-list">
      <div class="ix-list-inner">
        <h2 class="section-heading">The full list.</h2>
        <ol class="ix-card-list">
          {intersections.map((ix) => (
            <li class="ix-card" id={`ix-${ix.slug}`} data-slug={ix.slug} data-lat={ix.lat} data-lng={ix.lng}>
              <div class="ix-card-head">
                <span class="ix-rank">#{ix.rank}</span>
                <h3 class="ix-title">{ix.streetA} &amp; {ix.streetB}</h3>
                <span class="ix-count">{ix.crashCount} injury crashes</span>
              </div>
              <details class="ix-details">
                <summary>Crash details</summary>
                <div class="ix-details-body">
                  <div class="ix-stat-row"><span>Killed</span><span>{ix.killed}</span></div>
                  <div class="ix-stat-row"><span>Total injured</span><span>{ix.totalInjured}</span></div>
                  <a href={`/get-started?source=intersection-map&intersection=${ix.slug}`} class="ix-cta">Hurt in a crash here? Get a free case review →</a>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  </main>
  <CallBar />
  <Footer />
</BaseLayout>
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```
Expected: build succeeds, page count increases by 1 (355 pages, up from 354 per `ROADMAP.md`'s last recorded count), and `dist/dangerous-intersections-los-angeles/index.html` (or equivalent Astro output path) exists and contains the rendered intersection list.

```bash
ls dist/dangerous-intersections-los-angeles/ 2>/dev/null || find dist -iname "*dangerous-intersections*"
grep -c "ix-card" dist/dangerous-intersections-los-angeles/index.html 2>/dev/null
```
Expected: file exists, `ix-card` count matches the number of intersections in `data/intersections.json` (25, or fewer if the real export produced fewer qualifying groups).

- [ ] **Step 4: Commit**

```bash
git add src/pages/dangerous-intersections-los-angeles.astro
git commit -m "feat: add Astro dangerous-intersections page, synced from data/intersections.json"
```

---

### Task 18: Internal linking and sitemap

**Files:**
- Modify: `index.html`
- Modify: `personal-injury-lawyer-los-angeles.html`
- Modify: `car-accident-lawyer-los-angeles.html`
- Modify: `pedestrian-accident-lawyer-los-angeles.html`
- Modify: `motorcycle-accident-lawyer-los-angeles.html`
- Modify: `dui-accident-lawyer-los-angeles.html`
- Modify: `truck-accident-lawyer-los-angeles.html`
- Modify: `sitemap.xml`

Per spec §10, scoped to exactly these pages — not a sitewide footer change.

- [ ] **Step 1: Add a contextual link in each practice page's intro section**

For each of `car-accident-lawyer-los-angeles.html`, `pedestrian-accident-lawyer-los-angeles.html`, `motorcycle-accident-lawyer-los-angeles.html`, `dui-accident-lawyer-los-angeles.html`, `truck-accident-lawyer-los-angeles.html`: find the `<section class="intro-section"` block's final `<p class="reveal d1">` (the last paragraph before `</div>` closes `.intro-copy`), and append one sentence linking to the new page. Example for `car-accident-lawyer-los-angeles.html`, inserted as a new paragraph right after the existing final intro paragraph (after the one ending `...more evidence we can preserve.</p>` at line 275 in the version read during planning):

```html
    <p class="reveal d1">
      Curious which intersections see the most crashes? We built <a href="dangerous-intersections-los-angeles">an interactive map of LA County's 25 most dangerous intersections</a>, ranked by state crash data.
    </p>
```

Repeat with page-appropriate phrasing for the other four pages (e.g., for `pedestrian-accident-lawyer-los-angeles.html`, emphasize pedestrian-involved intersections; for `motorcycle-accident-lawyer-los-angeles.html`, motorcycle-involved).

- [ ] **Step 2: Add a link from the LA city hub page**

In `personal-injury-lawyer-los-angeles.html`, find a relevant section (its intro or a stats/facts section) and add a similarly-scoped sentence linking to `dangerous-intersections-los-angeles`.

- [ ] **Step 3: Add a link from the homepage**

In `index.html`, add a link to the new page — either as a new small callout near the practice-area grid or within an existing relevant section. Read `index.html`'s structure first (`grep -n "type-grid\|section class" index.html`) to find the best-fitting existing section before inserting.

- [ ] **Step 4: Verify every inserted link resolves and uses the extensionless form**

```bash
grep -rn 'dangerous-intersections-los-angeles' *.html
```
Expected: appears in all 7 modified files (6 links + the page itself), and every occurrence is extensionless (no `.html` suffix) per `CLAUDE.md`'s URL convention.

- [ ] **Step 5: Add the sitemap entry**

Add to `sitemap.xml`, matching the existing entry format (see lines read from the file during planning):

```xml
  <url>
    <loc>https://getlawdog.com/dangerous-intersections-los-angeles</loc>
    <lastmod>{{TODAY'S DATE, e.g. 2026-08-13}}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.8</priority>
  </url>
```

`changefreq: yearly` reflects the real annual TIMS refresh cadence, not a guess.

- [ ] **Step 6: Run the sitewide post-deploy checks from CLAUDE.md**

```bash
grep -r 'noindex' dangerous-intersections-los-angeles.html
for f in *.html; do grep -q '<link rel="canonical"' "$f" || echo "MISSING: $f"; done
```
Expected: no `noindex` match, and `dangerous-intersections-los-angeles.html` does not appear in the `MISSING` list (it has a canonical from Task 12's template).

- [ ] **Step 7: Commit**

```bash
git add index.html personal-injury-lawyer-los-angeles.html car-accident-lawyer-los-angeles.html pedestrian-accident-lawyer-los-angeles.html motorcycle-accident-lawyer-los-angeles.html dui-accident-lawyer-los-angeles.html truck-accident-lawyer-los-angeles.html sitemap.xml
git commit -m "feat: link dangerous-intersections page from homepage, LA hub, and matching practice pages"
```

---

### Task 19: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

```bash
npm test
```
Expected: all tests pass (47 tests: Tasks 2, 3, 4, 5, 6, 7, 8, 13, 14 combined).

- [ ] **Step 2: Run the Astro build**

```bash
npm run build
```
Expected: succeeds, zero errors, includes the new page.

- [ ] **Step 3: Validate every JSON-LD block on the static page parses**

```bash
node -e "
const html = require('fs').readFileSync('dangerous-intersections-los-angeles.html', 'utf8');
const blocks = [...html.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)];
console.log('JSON-LD blocks found:', blocks.length);
blocks.forEach((b, i) => {
  try { JSON.parse(b[1]); console.log(i, 'OK', JSON.parse(b[1])['@type']); }
  catch (e) { console.log(i, 'INVALID:', e.message); }
});
"
```
Expected: 6 blocks (LegalService+Organization, BreadcrumbList, Dataset, HowTo, FAQPage — matches Task 12's template), all `OK`, no `INVALID` lines.

- [ ] **Step 4: Browser verification of the full page (desktop + mobile)**

Using the browser preview tooling against the local static server from Task 16:
1. Screenshot the hero, map, and card-list sections at desktop width.
2. `resize_window` to mobile preset, screenshot again, confirm the sticky call bar and mobile nav don't overlap the map.
3. `read_console_messages` — zero errors on load.
4. Expand 2–3 different `<details>` cards, confirm each shows distinct, correct data (not all showing the same intersection's stats — a copy-paste bug in `render-card.mjs` would show up here).
5. Click through one card's "Learn about [X] claims" link and confirm it lands on the correct existing practice page (not a 404).
6. Click the CTA link and confirm the URL carries the correct `?source=intersection-map&intersection=<slug>` query string.

- [ ] **Step 5: Confirm the SEO checklist from CLAUDE.md § Automatic Checks**

```bash
echo -n "$(grep -o 'name=\"description\" content=\"[^\"]*\"' dangerous-intersections-los-angeles.html | head -1 | sed 's/.*content=\"//;s/\"$//')" | wc -m
grep -c '<h2' dangerous-intersections-los-angeles.html
grep -o '<title>[^<]*</title>' dangerous-intersections-los-angeles.html
```
Expected: description 140–160 chars, at least 2 `<h2>` sections, title present and under 60 chars.

- [ ] **Step 6: Stop the local test server**

```bash
# Ctrl+C the python3 http.server process from Task 16, or:
pkill -f "http.server 8080"
```

- [ ] **Step 7: Final commit if any fixes were made during verification**

If Steps 1–5 required any fixes, commit them now with a message describing what was found and fixed. If everything passed clean, there's nothing to commit here — the feature is complete as of Task 18's commit.

**Do not run `npx wrangler deploy` as part of this plan.** Deployment is a separate, explicit user decision per `CLAUDE.md` ("Commit before deploying. Never deploy uncommitted changes.") — confirm with the user before deploying.

---

## Self-Review Notes

**Spec coverage:** § 2 (TIMS source, rejected LAPD feed) → Task 12 methodology copy + Task 10. § 3 (aggregation/clustering) → Task 2, 6. § 4 (ranking, severity fields, framing guardrail) → Task 6, 12. § 5 (HIN overlay, jurisdiction skew) → Task 7, 9. § 6 (page structure, cards, map↔card interaction) → Task 12, 13, 15, 16. § 7 (single-page rationale) → reflected in scope, no sub-page tasks exist. § 8 (schema) → Task 12. § 9 (repo layout, Astro sync) → Task 1, 17. § 10 (linking, sitemap) → Task 18. § 11 (performance: self-hosted map, deferred script, no hero image) → Task 11, 12 (`<script src="ix-map.js">` placed at end of body). § 12 (open items) → Task 9 (HIN download, resolved), Task 10 (TIMS export, flagged human-in-the-loop), Task 5 (practice-page matching table, resolved).

**Placeholder scan:** the only literal "placeholder" language in this plan is in Task 17 Step 2, which explicitly flags that the `BaseLayout`/`Nav`/`Footer`/`CallBar` import signature must be confirmed against the real `get-started.astro` file before use — that's a legitimate adapt-to-reality step (the actual component API isn't knowable without reading the live file first), not an unresolved TBD; the data-wiring and rendered markup around it are fully concrete.

**Type consistency:** verified the intersection object shape (`rank`, `streetA`, `streetB`, `slug`, `lat`, `lng`, `crashCount`, `killed`, `totalInjured`, `severeInjuryCrashes`, `pedestrian`, `bicycle`, `motorcycle`, `truck`, `alcoholRate`, `dominantCollisionType`, `dominantCollisionTypeLabel`, `matchedPracticePage`, `onHighInjuryNetwork`) matches exactly across Task 6 (`aggregate-intersections.mjs`), Task 8 (`build-intersections.mjs` test assertions), Task 13 (`render-card.mjs` and its tests), and Task 14 (`build-page.mjs` test fixture).
