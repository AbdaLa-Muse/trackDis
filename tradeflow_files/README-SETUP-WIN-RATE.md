# TradeFlow v8 — Setup Win Rate

This update adds only the Setup Win Rate percentage inside the existing **Trades by Setup** Dashboard section.

Formula per setup:

`Wins / (Wins + Losses) × 100`

- Trade count includes Win, Loss, and Break Even.
- Break Even is excluded from the Win Rate denominator.
- No Trade and records with `setup = null` are excluded.
- If a setup has no Win/Loss results, the UI shows `Win Rate —`.
- No Supabase migration is required for this update.
