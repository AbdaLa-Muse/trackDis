# TradeFlow v7 — Trading Setup + Trades by Setup

This update adds only:

1. **Trading Setup** to Daily Review.
2. **Trades by Setup** counts to Dashboard.

## Supabase update

Before saving a review with a Setup, open Supabase → SQL Editor → New query and run:

`SUPABASE-TRADING-SETUP-UPDATE.sql`

This migration does **not** change your access code, Start Date, theme, or existing review values. Existing reviews keep `setup = null` until you edit them.

## Setup rules

- Win / Loss / Break Even: Risk + Strategy + Trading Setup are required.
- No Trade: Risk + Strategy + Trading Setup are stored as `null` / N/A.
- Discipline still uses only Risk Management + Strategy.
- Setup counts include only Win / Loss / Break Even reviews with a valid setup.
- Trading System Training content is unchanged.
