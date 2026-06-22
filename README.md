# PPAP Manager — Demo

An interactive demo of a **Production Part Approval Process (PPAP)** management tool.
Suppliers build a package across the 18 PPAP elements, complete each one, and submit
it to the customer; the customer reviews and approves or returns it.

This is a **front-end demo**: everything runs in the browser and all data is stored
locally in the visitor's own browser (`localStorage`). There is no backend, no
account, and nothing is sent anywhere — so it's safe to share publicly and it can't
fall over under load. Each visitor gets their own private sandbox.

## What's in it

- **Three roles** — Supplier (build & submit), Customer (review & approve), Admin (full access to do both).
- **All 18 PPAP elements** with status tracking and per-project progress, including real interactive editors:
  - Design/Process **FMEA** with live **Risk Priority Number** (Sev × Occ × Det), color-coded.
  - **Dimensional Results** with automatic **PASS/FAIL** against the tolerance band.
  - **Control Plan** table, **Process Flow** step builder, **Material/Performance** results.
  - **MSA Gage R&R** calculator (%GRR, distinct categories, acceptability verdict).
  - **Initial Process Studies** capability calculator (**Cp / Cpk** with verdict).
  - **Customer-Specific Requirements** checklist and a **Part Submission Warrant** cover sheet.
- **Submission-level logic** — levels 1–5 change which elements are required.
- **Workflow gates** — a Build → Customer review → Approved stage stepper; the supplier can't
  proceed past submission without the customer, and the Customer Engineering Approval element
  needs explicit customer sign-off.
- **Submit → review → approve/return** loop, with a per-project **activity timeline**.
- **PDF exports** — one-click Part Submission Warrant and a full package summary.
- **Project management** — multiple projects, create, search, status filter, and delete.
- **Responsive** — works on desktop and mobile; data persists in the browser.

## Tech

React 18 + Vite + Tailwind CSS. PDF export via jsPDF. No server.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

## Deploy to Vercel

The project needs **no configuration** — Vercel auto-detects Vite.

**Option A — from GitHub (recommended):**
1. Push this folder to a new GitHub repository.
2. In Vercel, click **Add New → Project** and import that repo.
3. Vercel detects the Vite preset automatically:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**. You'll get a public URL to share.

**Option B — from the CLI:**
```bash
npm i -g vercel
vercel        # follow the prompts, accept the detected settings
vercel --prod # promote to production
```

## Notes & limits (by design)

- Data lives only in the current browser; clearing site data or using a different
  device starts fresh. That's intentional for a public demo.
- Document uploads are **recorded** (name and size) to show the workflow, but the file
  contents are not stored.
- To turn this into a real multi-user product (shared database, accounts, persistent
  file storage), the natural next step is serverless API routes backed by a hosted
  Postgres (e.g. Neon) and an object store (e.g. Vercel Blob) for uploads.
