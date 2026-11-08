import sharp from "sharp";
import { fileURLToPath } from "node:url";

const input = fileURLToPath(new URL("../public/data/mars-mola-topography.jpg", import.meta.url));
const output = fileURLToPath(new URL("../public/data/mars-mola-heightmap.png", import.meta.url));
const width = 2048;
const height = 1024;

const { data, info } = await sharp(input)
  .resize(width, height, { fit: "fill" })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const heightmap = Buffer.alloc(width * height);
const clamp = value => Math.max(0, Math.min(1, value));

for (let pixel = 0; pixel < width * height; pixel++) {
  const offset = pixel * info.channels;
  const r = data[offset] / 255;
  const g = data[offset + 1] / 255;
  const b = data[offset + 2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  let hue = 0;
  if (delta > 0.0001) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = ((hue * 60 + 360) % 360) / 360;
  }

  // The official MOLA palette runs from violet/blue lowlands through green,
  // yellow and red to white highlands. Decode that ordered palette to height.
  let elevation = hue > .82
    ? clamp((hue - .82) / .18)
    : 1 - clamp(hue / .82);
  if (saturation < .18) elevation = .86 + max * .14;
  const luminance = r * .2126 + g * .7152 + b * .0722;
  elevation = clamp(elevation * .9 + luminance * .1);
  heightmap[pixel] = Math.round(elevation * 255);
}

await sharp(heightmap, { raw: { width, height, channels: 1 } })
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

console.log(`Generated ${output} (${width}x${height})`);
