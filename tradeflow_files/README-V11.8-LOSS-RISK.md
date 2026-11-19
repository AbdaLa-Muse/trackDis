# TradeFlow v11.8 — Loss vs Selected Risk

Focused risk-discipline update only.

- Loss with abs(Trade Return %) <= selected Risk %: no loss-size violation.
- Loss with abs(Trade Return %) > selected Risk %: Risk Management = Broke Rules.
- The trade still saves and the real return remains unchanged.
- Existing 2% buffer / once-per-cycle rules remain unchanged.
- Win, Break Even, No Trade, Goals, Training, Accounts, cycles, resets and saved data remain unchanged.
- Historical managed reviews are recomputed when the SQL runs.
