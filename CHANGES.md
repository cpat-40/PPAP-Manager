# Changes — July 7, 2026 review fixes

All changes verified with `npm run build` and the regression tests in
`focus.test.jsx` (`npm test`). Nothing about the app's architecture changed:
it is still a client-only demo with localStorage persistence.

## Bug fixes

1. **MSA & Capability inputs lost focus on every keystroke** (`src/App.jsx`,
   `MsaEditor` / `CapabilityEditor`). The `Inp` helper was a component defined
   inside render, so React remounted the input on each state change — typing
   "0.08" produced "0". Replaced with plain function calls that don't create a
   component boundary. Covered by regression tests.

2. **Pipeline board bypassed the workflow.** Drag moves are now validated
   centrally (`attemptMove` in `ProjectsList`): draft → submitted requires all
   required elements complete; submitted → approved opens the signature dialog;
   submitted → returned requires review comments (new comment field in the
   confirm dialog); rejected → draft is the supplier's reopen; everything else
   is blocked with an explanatory toast. Board moves now write the same
   activity entries and submission metadata as the buttons.

3. **Table-menu "Submit" skipped the completeness gate.** It now enforces the
   same all-elements-complete rule as the Project view.

4. **One large upload silently disabled all persistence.** Files were stored
   as base64 in localStorage with an 8 MB cap — above the ~5 MB quota, so one
   big PDF made every save fail silently and a refresh wiped the visitor's
   data. Files ≤ 2 MB are stored (preview/download still work); larger files
   are recorded as name + size only; a quota failure now shows a warning toast
   instead of failing silently. README updated to match actual behavior.

5. **Cycle time was computed backwards** (`submit − approve`, clamped to 1 day
   for everyone). Now `approve − submit`.

6. **Duplicate project IDs after reload.** The id counter is now seeded from
   the highest persisted id, so a returning visitor's new packages can't
   collide with existing ones (collisions made `updateProject` edit two rows).

7. Smaller: "Reset demo" also resets invited members; the element Owner
   dropdown uses the live members list (invited members are now assignable);
   the "Excel" buttons are labeled "CSV" (that's what they export); identical
   readings no longer produce `Cp = Infinity`; removed dead `completionTrend`;
   approved packages can no longer be deleted (quality-record retention);
   the illustrative analytics series are labeled "Illustrative demo series".

## Domain-accuracy changes (AIAG)

- **Cpk vs Ppk:** Cpk (and control limits) now use the within/moving-range
  sigma estimate (MR̄/1.128); Ppk uses overall sigma. Both are displayed. The
  old "Cpk" was computed from overall sigma, i.e. it was actually Ppk.
- **Initial process study verdict** now follows AIAG PPAP acceptance criteria,
  judged on Ppk: ≥ 1.67 meets criteria, 1.33–1.67 conditional (contact the
  customer), < 1.33 not acceptable. Footnote, seed data, and the seeded
  rejection email updated to match. `DATA_VERSION` bumped to 4 so returning
  browsers reseed with the corrected text.
- Element summaries (PDF/CSV exports) show both indices.

## Launch prep

- `public/og.png` (1200×630) social preview card added; `index.html` now has
  `og:image`, size hints, and `twitter:card`. **Action needed:** after
  deploying, replace `YOUR-DEPLOYMENT-URL` in `index.html` with the real
  domain (LinkedIn requires an absolute URL), then redeploy.
- `npm test` script + `focus.test.jsx` regression suite (vitest + Testing
  Library) added as dev dependencies.

## Not changed (deliberately)

- Bundle is still one chunk (~310 KB gzip). Lazy-loading jsPDF/recharts is
  worth doing but was left out to keep this pass low-risk.
- The AIAG-VDA Action Priority (AP) mode, PSW field additions (part weight,
  engineering change level, interim approval), and Level-4 element selection
  discussed in the review are feature work, not fixes.

# Changes — v1.1 (same day): professional/sellable pass

Verified with `npm run build` and `npm test` (4 regression tests, including the
new landing-page flow).

- **Landing page** now greets visitors before the role picker: hero with a live
  product frame, three feature sections, a supplier/customer "how it works,"
  FAQ, waitlist, and footer. "Try the live demo" leads to the existing login.
- **Waitlist**: fill in `SITE.waitlistEndpoint` in `src/App.jsx` (free Formspree
  form) to activate the email capture; falls back to a LinkedIn or email CTA
  via `SITE.linkedinUrl` / `SITE.contactEmail`. See "Before you launch" in the
  README.
- **Brand token pass**: Tailwind's blue scale is remapped in
  `tailwind.config.js` to a desaturated "engineering ink" ramp (primary
  #2E5E86 / #183853), so the whole app moves off the stock palette in one
  place. Chart hexes and the favicon follow it.
- **Typography**: IBM Plex Sans + IBM Plex Mono replace Inter, with
  tabular figures enabled globally so part numbers, dates, and Cpk values
  align in columns.
- **Sidebar** restyled from the solid blue slab to white with hairline borders
  and a quiet active pill; version tag added at the bottom.
- **Approval stamp** (signature element): approved packages now show a rotated
  inspection-style "APPROVED · name · date" stamp on the package view and the
  PSW customer disposition; it also anchors the landing hero.
- `SITE` launch config added (waitlist endpoint, LinkedIn URL, contact email,
  version string).
