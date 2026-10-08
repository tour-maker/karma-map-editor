# Plan: move the data from Google Sheets to MongoDB (half day)

## The idea (why this is safe)
Every read/write the app does to the sheet goes through ONE backend file: `server/routes/sheets.js`
(5 endpoints: read values, update, append, clear, batchUpdate/delete-row).
We keep those endpoints and the whole frontend EXACTLY as they are, and change only what is behind them:
instead of calling Google, they read/write a MongoDB collection that holds the same rows
(tabs Polygons / Areas / Landmarks, same 19 columns).
So no screen changes, no new bugs in the UI. A switch in `.env` picks the storage, so going back is 1 line.

    STORAGE=sheets   -> today's behaviour (default, nothing changes)
    STORAGE=mongo    -> new behaviour

## Before we start (you, 5 min)
- [ ] Merge + deploy the block-user commit first (done: main = 2d8fe66) and confirm the site works.
- [ ] Download a backup of the sheet: File > Download > Excel. Keep it. (Insurance.)
- [ ] Tell me: should the team stop editing the sheet by hand after the move? (Recommended: yes.)

## Part A - Code (me, ~2 hours)
1. [ ] New model `server/models/SheetTab.js`: `{ name, rows: [[cell,...],...] }`, one document per tab.
2. [ ] New `server/storage/mongoSheet.js` with the same functions the routes use:
       get values (range like `Polygons`, `Polygons!A2:S`), update range, append rows,
       clear range, delete row by index, add a tab, list tab names (metadata).
3. [ ] `server/routes/sheets.js`: if `STORAGE=mongo` use mongoSheet, else Google (current code untouched).
4. [ ] One-time copy script `server/scripts/sheetToMongo.js`:
       reads the 3 tabs from Google, writes them into Mongo, prints row counts, refuses to run twice
       unless `--force`. Read-only on Google (never edits the sheet).
5. [ ] Optional "Export to Excel/Sheet" keeps working (frontend already exports from the map data).
6. [ ] Tests (vitest, in-memory Mongo): append / update / clear / delete-row / range reads
       give the same results as the sheet would. Plus full `npm test` + `npm run build`.

## Part B - Practice run (me + you, ~1 hour) - NOT on the live site yet
7. [ ] Run the copy script against a TEST database, start the backend with `STORAGE=mongo`,
       open the app. Check: 458 plots, 58 landmarks, all cities in Areas tab, Unassigned still works.
8. [ ] Click through: add polygon, edit, delete, rename city/area, move area, approve a submission,
       add landmark, category rename, Excel import. Reload each time to confirm it was saved.
9. [ ] Compare counts: Mongo Polygons rows == Sheet Polygons rows (script prints both).

## Part C - Go live (you on the VPS, ~20 min)
10. [ ] Tell users "short break" (5 min). Nobody edits the sheet from now on.
11. [ ] On the VPS:
        cd /opt/apps/karmalandtour && git pull && npm install && npm run build
        node server/scripts/sheetToMongo.js          # copies sheet -> Mongo, prints counts
        add line  STORAGE=mongo  to the backend .env
        pm2 restart karmalandtour-backend
12. [ ] Hard refresh (Ctrl+Shift+R). Check the same counts: 458 plots, 58 landmarks.
13. [ ] Add one test plot, reload, confirm it stays; delete it.

## Rollback (if anything looks wrong, 1 minute)
- Remove the `STORAGE=mongo` line (or set `STORAGE=sheets`) and `pm2 restart karmalandtour-backend`.
- The Google Sheet is untouched by the copy, so it is exactly as it was before the move.
  (Anything added AFTER going live lives only in Mongo - so do the check in step 12-13 right away.)

## After it is stable (a few days later, optional)
- Keep the sheet as a read-only backup, or run the export once a week.
- Later cleanup: store polygons as proper Mongo documents instead of "rows" (not needed now).

## What can go wrong and how we avoid it
| Risk | Prevention |
|------|-----------|
| Row counts differ after copy | Script prints both counts and stops if they differ |
| Someone still edits the sheet | Step 10: tell the team; sheet is no longer used |
| Wrong range handling (A2:S etc.) | Unit tests for every range form the app uses |
| Live site breaks | `STORAGE` switch + untouched sheet = 1-minute rollback |
