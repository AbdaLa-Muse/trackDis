# TradeFlow v11.12

Focused update only:

1. Live Loss-vs-Selected-Risk validation.
   - Loss greater than selected 1%/2% risk => Risk Management = Broke Rules.
   - Existing 2% buffer / once-per-cycle rules remain unchanged.
2. Past Date Daily Review entry/editing.
   - Allowed from Official Start Date through today.
   - Existing review loads for editing; missing date opens blank.
   - Save uses selected date and reuses one-review-per-date upsert.
   - Historical account calculations use pre-trade state for that date.
   - Supabase recomputes chronology after historical changes.

No permanent account delete feature was added.
Archive / Unarchive, Goals, Training, Setup rules, Reset Cycle and 4-digit PIN security are preserved.
