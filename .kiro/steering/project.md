# Project Overview

Proof of concept for a bank escrow officer managing releases on commercial escrows.

**Stack:** Vite · React · TypeScript · Tailwind · Vitest  
**Deployment:** Static site on Cloudflare Workers — no backend, no API calls.

## Data
All data is seeded in-memory with a reset mechanism. No persistence layer.

## Architecture rule
Business logic (release checks, ledger postings, balance calculations) lives in plain TypeScript functions, separate from UI components. These functions must have unit tests.

## Scope
This is a proof of concept. Favor simplicity and clarity over production-readiness.

## UI Style

Inspired by Nymbus's banking UI aesthetic — clean, dense, and functional.

- White and light gray backgrounds (`bg-white`, `bg-gray-50`, `bg-gray-100`)
- Blue primary actions (`bg-blue-600` / `#2563eb` or similar)
- Amber/yellow for warnings and alerts
- Small, muted label text (`text-xs text-gray-500`), prominent values in dark gray/black
- Tabular layouts for data — prefer tables and structured grids over cards
- Compact padding — this is a data-dense UI, not a marketing page
- No rounded corners on data tables; subtle borders (`border-gray-200`)
