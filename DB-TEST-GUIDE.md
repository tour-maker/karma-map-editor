# Test guide: MongoDB as the database + Google Sheet as a copy (branch `db-test-karma`)

Nothing here touches production. Production stays on `main` until you say so.

## What changed (short)
- New setting `STORAGE=mongo` on the backend. With it, the app saves to MongoDB; the Google Sheet is
  filled automatically a few seconds later (view / download as Excel). Without it, everything works as before.
- Screens are unchanged. Admin gets one extra round button (next to the green Excel icon) that
  re-writes the sheet from the database on demand. It only shows when `STORAGE=mongo`.
- Safety: the copy to the sheet never runs until the one-time copy script has finished and matched.

## Step 1 - Backend on Render (test copy)
New > Web Service > connect repo `tour-maker/karma-map-editor` > Branch **db-test-karma**.
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `node server.js`
- Environment variables:
  - `MONGODB_URI`  -> a NEW empty test database (NOT the production one). Atlas: Network Access must allow 0.0.0.0/0 for Render.
  - `JWT_SECRET`, `ADMIN_USER`, `ADMIN_PASS`  -> any test values
  - `STORAGE` = `mongo`
  - `SHEETS_MIRROR` = `off`        (keeps the REAL sheet untouched while testing)
  - `GOOGLE_SHEET_ID` = id of the real sheet (only READ by the copy script)
  - `GOOGLE_SERVICE_ACCOUNT_JSON` = paste the whole service-account JSON (same one the VPS uses)

## Step 2 - Check the database works (Render > Shell tab)
    node scripts/storageSmoke.js          # must print PASS
    node scripts/sheetToMongo.js --dry-run   # shows row counts from the sheet, writes nothing
    node scripts/sheetToMongo.js          # copies sheet -> MongoDB, must say "MATCHES the sheet" for every tab and DONE
Then restart the service once (so it picks up the migrated flag).

## Step 3 - Frontend on Render (test copy)
New > Static Site > same repo > Branch **db-test-karma**.
- Build Command: `npm install && npm run build`   Publish directory: `dist`
- Environment variables: copy ALL `VITE_...` variables from your current frontend, but set
  `VITE_API_URL` = your Render backend URL (https://xxxx.onrender.com)
- Add a rewrite rule `/*` -> `/index.html` (Redirects/Rewrites tab).
- Google Maps key: in Google Cloud, allow the new `*.onrender.com` address for the key, or the map stays grey.

## Step 4 - Click-through test (use the Render frontend)
- [ ] Map opens, 458 plots + 58 landmarks visible, cities list OK
- [ ] Admin login; add a polygon (with Party/Broker) -> reload -> still there
- [ ] Edit a plot -> reload -> change is kept
- [ ] Delete a plot -> reload -> gone
- [ ] Rename a city/area; move an area; add a landmark; change a category colour
- [ ] User submits polygon -> admin approves -> it appears on the map
- [ ] Excel import (Import button) works

## Step 5 - Test the Google Sheet copy (safe way)
1. In Google Sheets: File > **Make a copy** of the real sheet. Share the copy with the service-account email (Editor).
2. On the Render backend set `GOOGLE_SHEET_ID` = the COPY's id and `SHEETS_MIRROR` = `on`; redeploy.
3. Make an edit in the app, wait ~5 seconds, open the copy: the change is there.
4. Press the round sync button in admin: "Google Sheet updated from the database".

## Step 6 - Go live (only after everything above is OK)
Merge `db-test-karma` into `main`, then on the VPS:
    cd /opt/apps/karmalandtour && git pull && npm install && npm run build
    cd server && node scripts/sheetToMongo.js     # one time, must say DONE
    add to server/.env:  STORAGE=mongo
    pm2 restart karmalandtour-backend
Hard refresh (Ctrl+Shift+R) and re-check counts.

## Rollback (1 minute)
Change `STORAGE=mongo` to `STORAGE=sheets` (or delete the line) and `pm2 restart karmalandtour-backend`.
The real sheet is only written by the copy AFTER go-live, so before that it is never changed.
After go-live, edits made while on Mongo exist in Mongo + the sheet copy; the sheet copy is current
(press the sync button first if unsure), so rolling back keeps your data.
