// Generates the app icon set from one SVG glyph: a jar with a coin dropping in.
// Run with `npm run icons`. Output goes to public/.
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const PRIMARY = '#0F766E'

// Glyph drawn on a 512 grid, centered around (256, 265).
const glyph = `
  <circle cx="256" cy="132" r="46" fill="#fff"/>
  <circle cx="256" cy="132" r="27" fill="none" stroke="${PRIMARY}" stroke-width="9"/>
  <rect x="190" y="198" width="132" height="38" rx="14" fill="#fff"/>
  <rect x="150" y="246" width="212" height="198" rx="60" fill="#fff"/>
  <rect x="200" y="318" width="112" height="14" rx="7" fill="${PRIMARY}"/>
  <rect x="226" y="350" width="60" height="14" rx="7" fill="${PRIMARY}"/>`

function svg({ rounded, scale }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="${PRIMARY}"/>`
    : `<rect width="512" height="512" fill="${PRIMARY}"/>`
  // Scale around the canvas center, then nudge the glyph's own center (y=265) to the middle.
  const t = `translate(256 256) scale(${scale}) translate(-256 -265)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<g transform="${t}">${glyph}</g></svg>`
}

const rounded = svg({ rounded: true, scale: 1 })
const fullBleed = svg({ rounded: false, scale: 0.9 })
const maskable = svg({ rounded: false, scale: 0.72 })

await writeFile('public/favicon.svg', rounded)
await writeFile('public/icon.svg', rounded)

const png = (source, size, file) => sharp(Buffer.from(source)).resize(size, size).png().toFile(`public/${file}`)

await Promise.all([
  png(rounded, 192, 'icon-192.png'),
  png(rounded, 512, 'icon-512.png'),
  png(maskable, 512, 'icon-maskable-512.png'),
  png(fullBleed, 180, 'apple-touch-icon-180.png'),
])

console.log('Icons written to public/')
