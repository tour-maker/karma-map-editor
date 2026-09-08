import fs from 'fs';
import { convert } from '@omsimos/pdf-raster';

async function test() {
  const buf = fs.readFileSync('sample.pdf');
  try {
    const images = await convert(buf, { scale: 1 });
    console.log("Returned:", images);
  } catch (e) { console.error(e); }
}
test();
