# TradeFlow Weekly Reports — deployment notes

This release adds a private Weekly Reports gallery (images and PDF) using a separate Supabase Edge Function and *additive* metadata table. The earlier Best/Worst Setup and Account Outcome Dedupe fixes remain in place.

## Deployment order

1. Back up the current GitHub version and production database. The original trading SQL, PIN and trading tables must not be re-created.
2. Run **only** `TRADEFLOW-WEEKLY-REPORTS-ADDITIVE-MIGRATION.sql` using Supabase SQL Editor. This creates the private `tradeflow-weekly-reports` bucket, metadata table and grants `service_role` access to the existing `tradeflow_session_valid` function. It is designed to be idempotent on an unchanged database. Do not run the full SQL again.
3. Deploy the **new** Edge Function to the existing Supabase project:
   `supabase functions deploy tradeflow-reports --no-verify-jwt`
   The accompanying `supabase/config.toml` also sets `verify_jwt = false` for this function, because TradeFlow uses its existing custom PIN-based database session token instead of a Supabase Auth JWT. The new Edge Function validates every action server-side against `tradeflow_session_valid`.
4. Confirm that the Edge Function runtime has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `TRADEFLOW_SUPABASE_SECRET_KEY`) available as server-only environment secrets. **Never place the service-role key in `config.js` or GitHub.** A browser-safe Supabase publishable key continues to be used by the existing app.
5. Deploy the updated `index.html`, `tradeflow_files/app.js`, `tradeflow_files/reports.js`, `tradeflow_files/reports.css`, and the rest of the unchanged project files to GitHub Pages or your existing hosting.
6. Unlock the app and open **Weekly Reports**. Upload a small PNG/JPEG/PDF. Verify list, preview, edit, download, delete, re-login, mobile gallery, private URLs and unauthorized requests.

## Automatic Monday–Friday report periods (v11.13.19)

- The upload form no longer asks for start/end dates. The Edge Function computes the period from its own received timestamp using the **Europe/London** calendar date. Saturday and Sunday map to the trading week ending Friday.
- Example: uploads on 07 or 08 Nov 2026 get **02 Nov 2026 – 06 Nov 2026 Report**. The period is persisted on initial insert. Upload retries with the same `upload_id` return the existing entry and do not recompute or overwrite its dates.
- Existing reports are untouched; editing existing report metadata, including dates, is preserved for historical corrections. Date-range search filters are unchanged.
- **No database schema change** is needed for this improvement: the existing `week_start` and `week_end` columns already store the dates. A separate FULL consolidated SQL copy is included for the user's versioned archive, not because it is necessary to rerun it in production.
- The backend Edge Function **must be redeployed** for the new server-authoritative date calculation. Updating the HTML/JS alone is insufficient.

## Behaviour and limits

- Images have client-generated small JPEG thumbnails, while originals are retained. For PDFs the compact card uses a PDF icon and the actual full PDF opens in a browser PDF viewer. **PDF first-page image thumbnails are not implemented**: this is a known enhancement requiring a trusted PDF renderer. The viewer uses the browser's PDF controls and the separate zoom buttons change the viewer size.
- Uploads use a stable client-generated UUID for retry idempotency. Upload maximum is **12 MiB**; images and PDF only, with server-side file-signature checks. Thumbnail max is 300 KiB. Images stay the original resolution in private Storage.
- Full-file signed URLs expire after **5 minutes**, while thumbnail signed URLs expire after **10 minutes**. Previously generated signed URLs can remain accessible until expiry even after app lock; do not share the URLs. Refresh the gallery to renew them.
- Up to **1,000** reports are listed per request (no server-side pagination yet). This is sufficient for years of weekly reports, but larger libraries require pagination.
- Report delete removes Storage objects before metadata. A partially failed delete can leave metadata pointing at a missing file; the delete action can be retried. Metadata insert failure after upload triggers best-effort Storage cleanup.
- Private gallery is protected by existing TradeFlow PIN sessions, which are security-limited by the strength of a four-digit PIN. Consider migrating to stronger user authentication if the reports contain highly sensitive personal information.
- JSON backup/import continues to operate on existing trading data. **Uploaded report files are not included in JSON backups**; back them up separately from Supabase Storage. The original Account Outcome backup limitation also remains unchanged.
- No migration or deployment has been run on the actual Supabase project here. Local tests cannot establish production behaviour or genuine external access control without live verification.

## Manual negative tests

- Call reports Edge Function without `x-tradeflow-token`, with incorrect token, or after expiry: expected 401.
- Browser direct request to `storage/v1/object/public/tradeflow-weekly-reports/...`: expected inaccessible, bucket is private.
- Try file type mismatch (a text file renamed `.pdf`), >12 MB file, and repeated Upload clicks: expected rejection or single upload. New uploads have no user-entered reporting dates.
- Try a failing Storage upload and ensure metadata is not created.

## Change inventory

- `index.html`: existing report page now omits manual upload date fields; other navigation untouched.
- `tradeflow_files/app.js`: register report navigation and clear viewer on lock; trading logic unchanged.
- `tradeflow_files/reports.js`: isolated gallery, upload, search, preview, edit, delete.
- `tradeflow_files/reports.css`: isolated dark/light responsive styles.
- `tradeflow_files/supabase/functions/tradeflow-reports/index.ts`: private server-side upload/list/edit/delete/download API.
- `tradeflow_files/supabase/config.toml`: added new Edge Function declaration.
- `tradeflow_files/TRADEFLOW-WEEKLY-REPORTS-ADDITIVE-MIGRATION.sql`: new isolated metadata/storage migration.
- `tradeflow_files/README-WEEKLY-REPORTS.md`: deployment and safety notes.
