import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir  = resolve(__dirname, "..")
const distDir  = resolve(rootDir, "dist")
const extDir   = resolve(rootDir, "..", "extension")

if (!existsSync(distDir)) {
  console.error("Build output not found. Run 'npm run build' first.")
  process.exit(1)
}

console.log("Copying build output to extension/ …")

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
  const path = resolve(extDir, file)
  console.log(`  ${existsSync(path) ? "✓" : "✗"} ${file}`)
}

console.log(`\n✔ Extension ready at: ${extDir}`)
console.log("  → chrome://extensions → Developer Mode → Load unpacked → select the 'extension' folder")
