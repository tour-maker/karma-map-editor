import sharp from 'sharp';
async function test() {
  const imgBuffer = await sharp({ create: { width: 1000, height: 1000, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  console.log("Generating tiles...");
  try {
    await sharp(imgBuffer)
      .png()
      .tile({ layout: 'google', size: 256 })
      .toFile('test-tiles.zip');
    console.log("Tile zip created!");
  } catch (e) {
    console.error("Tiling error:", e);
  }
}
test();
