# CLAUDE.md — smart-scheduler-backoffice-front (Backoffice Web)

Guides Claude Code (and other agents) in this repo. For the cross-repo map see the
workspace root `../CLAUDE.md`. This repo is **greenfield**.

## What this is

The **backoffice web app** — the **management & money** surface used by the owner/admins. Part of
**Option C (Ultimate)** — inventory Mini ERP/POS plus wallet/payroll to **fully retire "Alis To Soft"**.
Build wave 2 (greenfield). Audience: **internal admins/owner**.

Features (see [docs/requirement.md](docs/requirement.md)):
- **Student wallet / hour deduction** — remaining-hours ledger; on real attendance (recorded by the
  frontoffice) deduct hours, then push **LINE** to the **parent**.
- **Inventory** — snacks / water / equipment stock; add stock, auto-deduct on sale.
- **Teacher payroll** — compute Part-time / Freelance pay from **actual hours taught**.
- **Management reports** — daily/period analytics for decisions.

## Stack — identical pattern to `smart-scheduler-front`

Use the **same Next.js + Mantine pattern** as the frontoffice web. When scaffolding, mirror that
repo's structure file-for-file; only the **domain** differs (finance instead of scheduling).

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Mantine v9** (`@mantine/core`, `dates`, `hooks`, `notifications`) — **not Ant Design**
- **Tailwind v3** (utilities; semantic colors bridged to Mantine in `src/lib/ui/colors.ts`)
- **TanStack Query v5** + **Axios** + **dayjs** + **lucide-react**
- Package manager **bun**; path alias **`@/*` → `./src/*`**

```bash
bun install && bun run dev
```

## Architecture (copy from the frontoffice web)

Same layering — `page → partial → hook → service → API`, pure domain logic isolated:

- `src/types/app/<domain>/index.ts` — types + `const` label/format maps
- `src/lib/<domain>/*.ts` — **pure** finance logic (wallet math, payroll calc), framework-free, tested
- `src/lib/ui/*` — `notify.ts` (toast), `colors.ts` (semantic → Mantine)
- `src/services/<domain>.service.ts` — **only** place that calls the backend (Axios → Finance API)
- `src/hooks/<domain>/*.ts` — TanStack Query hooks; query keys as `const`; mutations invalidate
- `src/app/(admin)/.../page.tsx` — thin server pages → render `*Content` partials
- `src/components/partials/<Feature>/` — `"use client"` containers + sub-components + `Modal/`
- `src/components/layout/*`, `src/components/common/*`, `src/context/*` (Mantine + Query providers)

Conventions: thin pages, restrained color, Thai UI copy, toasts via `notify()`.

**Theme:** dark **gray-black** (Mantine `gray.8`/`gray.9`) — not pure black. See [docs/requirement.md](docs/requirement.md) §3.

**Tasks/scope live in the `smart-scheduler-requirement` repo, not a `todo.md`** (todo files were
removed 2026-07-08 — do not recreate them). Open `smart-scheduler-requirement/requirement.html` and
treat `Partial` / `Planned` items as the work queue. See the root `../CLAUDE.md` §"How work is
assigned" for the full policy.

## Talks to: `smart-scheduler-backoffice-back` (Finance API)

- All data access through `src/services/*` (Axios). Prefer Hono **`hc<AppType>`** typed RPC if you
  import the backend's `AppType`.
- **Money/hours are displayed here but enforced on the backend.** Never compute a balance the user
  can trust from the client alone; the API is the source of truth and runs inside DB transactions.
- **LINE push (to parents) is the backend's job** — this app only triggers API calls. No LINE tokens
  in the browser.

## Money correctness (read before building wallet/payroll/inventory)

- Show amounts/hours from the API; treat the client as a **view**. Format only — never authoritative math.
- Expect **integer minor units** from the API; format with dayjs/Intl at the edge.
- Surface an **audit/ledger** view (every deduction/top-up) — this replaces a paid system, so admins
  need to trace every number.
