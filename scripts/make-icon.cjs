/**
 * Regenerate the app icon from the brand logo.
 *
 * Reads `build/logo-source.png` (the MDView by KEC logo) and packs PNG-encoded
 * entries at standard sizes into `build/icon.ico`, plus a 256px `build/icon.png`
 * used by the About dialog and window/taskbar.
 *
 * Resizing uses sharp if available; otherwise it falls back to embedding the
 * source PNG at full resolution for the 256 entry only. For best multi-size
 * results, prefer the PowerShell converter `scripts/png-to-ico.ps1`, which uses
 * .NET's high-quality bicubic resampler and needs no extra dependency.
 *
 * Run: `node scripts/make-icon.cjs`
 */
const fs = require('fs')
const path = require('path')

const buildDir = path.join(__dirname, '..', 'build')
const source = path.join(buildDir, 'logo-source.png')
const icoOut = path.join(buildDir, 'icon.ico')
const pngOut = path.join(buildDir, 'icon.png')
const sizes = [16, 24, 32, 48, 64, 128, 256]

function packIco(pngBuffers) {
  // pngBuffers: array of { size, buf }
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngBuffers.length, 4)
  const entries = []
  let offset = 6 + pngBuffers.length * 16
  for (const { size, buf } of pngBuffers) {
    const e = Buffer.alloc(16)
    e[0] = size >= 256 ? 0 : size
    e[1] = size >= 256 ? 0 : size
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(buf.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += buf.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)])
}

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Missing build/logo-source.png — cannot regenerate icon.')
    process.exit(1)
  }

  let sharp = null
  try {
    sharp = require('sharp')
  } catch {
    // optional
  }

  if (sharp) {
    const pngBuffers = []
    for (const size of sizes) {
      const buf = await sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer()
      pngBuffers.push({ size, buf })
    }
    fs.writeFileSync(icoOut, packIco(pngBuffers))
    fs.writeFileSync(pngOut, pngBuffers[pngBuffers.length - 1].buf)
    console.log('Wrote build/icon.ico (%d sizes) and build/icon.png via sharp', sizes.length)
  } else {
    const buf = fs.readFileSync(source)
    fs.writeFileSync(icoOut, packIco([{ size: 256, buf }]))
    fs.writeFileSync(pngOut, buf)
    console.log(
      'sharp not installed: wrote single-size icon. For multi-size, run scripts/png-to-ico.ps1'
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
