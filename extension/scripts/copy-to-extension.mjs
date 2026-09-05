import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const extDir   = resolve(__dirname, "..")       // extension/
const distDir  = resolve(extDir, "dist")        // extension/dist/

if (!existsSync(distDir)) {
  console.error("Build output not found. Run 'npm run build' first.")
  process.exit(1)
}

console.log("Copying build output to extension/ …")

// Remove old Vite build artifacts (preserve extension files)
for (const name of ["index.html", "favicon.svg", "icons.svg"]) {
  const p = resolve(extDir, name)
  if (existsSync(p)) rmSync(p)
}
const assetsDir = resolve(extDir, "assets")
if (existsSync(assetsDir)) rmSync(assetsDir, { recursive: true })

function copyRecursive(src, dst) {
  const entries = readdirSync(src)
  for (const entry of entries) {
    const s = resolve(src, entry)
    const d = resolve(dst, entry)
    if (statSync(s).isDirectory()) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true })
      copyRecursive(s, d)
    } else {
      copyFileSync(s, d)
    }
  }
}

copyRecursive(distDir, extDir)

const required = ["manifest.json", "background.js", "content.js", "icons"]
for (const file of required) {
  const p = resolve(extDir, file)
  console.log(`  ${existsSync(p) ? "✓" : "✗"} ${file}`)
}

console.log(`\n✔ Extension ready at: ${extDir}`)
console.log("  → chrome://extensions → Developer Mode → Load unpacked → select the 'extension' folder")
