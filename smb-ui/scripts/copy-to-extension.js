import { copyFileSync, cpSync, existsSync, readdirSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir  = resolve(__dirname, "..")                              // smb-ui/
const distDir  = resolve(rootDir, "dist")                              // smb-ui/dist/
const extDir   = resolve(rootDir, "..", "extension")                   // extension/

if (!existsSync(distDir)) {
  console.error("✗ Build output not found. Run 'npm run build' first.")
  process.exit(1)
}

console.log("Copying build output to extension/ …")

function copyRecursive(src: string, dst: string) {
  const entries = readdirSync(src)
  for (const entry of entries) {
    const s = resolve(src, entry)
    const d = resolve(dst, entry)
    if (statSync(s).isDirectory()) {
      copyRecursive(s, d)
    } else {
      copyFileSync(s, d)
    }
  }
}

// Clear and copy
const TO_CLEAR = ["index.html", "assets"]
for (const item of TO_CLEAR) {
  const target = resolve(extDir, item)
  if (existsSync(target)) {
    try { cpSync(target, target + ".old", { recursive: true }) } catch {}
  }
}

// Copy dist contents to extension/
copyRecursive(distDir, extDir)

// Extension-specific files should already exist (manifest.json, background.js, content.js, icons/)
const required = ["manifest.json", "background.js", "content.js", "icons"]
for (const file of required) {
  const path = resolve(extDir, file)
  console.log(`  ${existsSync(path) ? "✓" : "✗"} ${file}`)
}

console.log(`\n✔ Extension ready at: ${extDir}`)
console.log("  → Open chrome://extensions → Enable Developer Mode → Load unpacked → select the 'extension' folder")
