// Safety check for the REAL database: runs add/edit/delete/clear on a throwaway tab in MongoDB
// and prints PASS/FAIL. Touches nothing else. Run it after deploying, before trusting the app:
//   node scripts/storageSmoke.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createSheetEngine } from '../storage/sheetEngine.js';
import { mongoRepo } from '../storage/mongoRepo.js';
import SheetTab from '../models/SheetTab.js';
import SheetRow from '../models/SheetRow.js';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });
if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is not set'); process.exit(1); }
await mongoose.connect(process.env.MONGODB_URI);

const TITLE = '__smoke_test__';
const engine = createSheetEngine({ repo: mongoRepo });
const v = engine.spreadsheets.values;
const get = async (range) => (await v.get({ range })).data.values;

try {
  await SheetRow.deleteMany({ sheetId: 987654321 });
  await SheetTab.deleteMany({ title: TITLE });
  await engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ addSheet: { properties: { title: TITLE, sheetId: 987654321 } } }] } });
  await v.update({ range: `${TITLE}!A1`, requestBody: { values: [['id', 'name'], ['s1', 'one'], ['s2', 'two'], ['s3', 'three']] } });
  assert.deepEqual(await get(TITLE), [['id', 'name'], ['s1', 'one'], ['s2', 'two'], ['s3', 'three']]);
  await v.append({ range: `${TITLE}!A:B`, requestBody: { values: [['s4', 'four']] } });
  assert.deepEqual((await get(`${TITLE}!A:A`)).map(r => r[0]), ['id', 's1', 's2', 's3', 's4']);
  await v.update({ range: `${TITLE}!B3`, requestBody: { values: [['TWO']] } });
  assert.deepEqual((await get(`${TITLE}!A3:B3`))[0], ['s2', 'TWO']);
  await engine.spreadsheets.batchUpdate({ requestBody: { requests: [{ deleteDimension: { range: { sheetId: 987654321, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }] } });
  assert.deepEqual((await get(`${TITLE}!A:A`)).map(r => r[0]), ['id', 's2', 's3', 's4']);
  await v.clear({ range: TITLE });
  assert.equal(await get(TITLE), undefined);
  console.log('PASS: the real MongoDB behaves like the sheet (add / edit / append / delete row / clear).');
} catch (e) {
  console.error('FAIL:', e.message);
  process.exitCode = 1;
} finally {
  await SheetRow.deleteMany({ sheetId: 987654321 });
  await SheetTab.deleteMany({ title: TITLE });
  await mongoose.disconnect();
}
