import { writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, "icons")
mkdirSync(outDir, { recursive: true })

// Generate minimal valid PNG files for extension icons
// These are 1x1 red PNGs — Chrome requires the files to exist at build time.
// Replace with real icons (e.g. viasharp or manual design).
function makeMinimalPNG(size: number): Uint8Array {
  // Minimal 1-color square PNG header
  const header = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, size >> 8, size & 0xFF, // width
    0x00, 0x00, size >> 8, size & 0xFF, // height
    0x08, 0x02, // bit depth 8, color type (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x01, 0x00, 0x41, 0x0E, 0x23, 0x09, // CRC placeholder-ish
    0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, // IDAT
  ])

  // Build raw RGB pixels (red square + white border)
  const rowBytes = size * 3
  const raw = new Uint8Array(size * (rowBytes + 1)) // +1 filter byte per row

  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const i = y * (rowBytes + 1) + 1 + x * 3
      const border = x === 0 || y === 0 || x === size - 1 || y === size - 1
      raw[i] = border ? 255 : 0x3B       // R
      raw[i + 1] = border ? 255 : 0x6E   // G
      raw[i + 2] = border ? 255 : 0xF0   // B
    }
  }

  return Buffer.concat([header, Buffer.from(raw), Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])]) // IEND
}

;[16, 48, 128].forEach((size) => {
  const png = makeMinimalPNG(size)
  writeFileSync(resolve(outDir, `icon-${size}.png`), png)
  console.log(`Generated icon-${size}.png (${size}x${size})`)
})

console.log("Done. Replace with real branded icons.")
