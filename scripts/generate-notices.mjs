import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
const entries = []
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (!relative || entry.dev) continue
  const directory = path.join(root, relative)
  const manifestPath = path.join(directory, 'package.json')
  if (!fs.existsSync(manifestPath)) continue // Optional binaries for other platforms are not shipped.
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  entries.push({ name: manifest.name, version: manifest.version, license: typeof manifest.license === 'string' ? manifest.license : entry.license || 'Consultar pacote', directory, source: `https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}` })
}
const cargo = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--offline', '--manifest-path', path.join(root, 'src-tauri/Cargo.toml')], { cwd: root, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }))
for (const dependency of cargo.packages) {
  if (dependency.name === 'noetia') continue
  entries.push({ name: dependency.name, version: dependency.version, license: dependency.license || 'Consultar pacote', directory: path.dirname(dependency.manifest_path), extra: dependency.license_file, source: `https://crates.io/crates/${dependency.name}/${dependency.version}` })
}
const bodies = new Map(), sections = []
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))) {
  const paths = fs.readdirSync(entry.directory).filter(name => /^(?:licen[cs]e|copying|copyright|notice)(?:$|[._-])/i.test(name)).map(name => path.join(entry.directory, name))
  if (entry.extra) paths.push(path.resolve(entry.directory, entry.extra))
  const references = []
  for (const file of new Set(paths)) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size > 150000) continue
    const text = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n').trim()
    const digest = createHash('sha256').update(text).digest('hex').slice(0, 16)
    if (!bodies.has(digest)) bodies.set(digest, text)
    references.push(`[${path.basename(file)}](#license-${digest})`)
  }
  sections.push(`| ${entry.name} | ${entry.version} | ${entry.license.replaceAll('|', '\\|')} | [Origem](${entry.source})${references.length ? ' · ' + references.join(', ') : ''} |`)
}
const document = '# Third-party notices\n\nNoetia includes open-source dependencies. Their original licenses and notices remain applicable; the project MIT license does not replace them. This inventory includes runtime JavaScript packages and the locked Rust dependency graph, including build-time dependencies. Optional packages absent from this Windows installation are not bundled here.\n\n| Package | Version | License | Source and notices |\n|---|---|---|---|\n' + sections.join('\n') + '\n\n## License texts\n\n' + [...bodies].map(([id, text]) => `<a id="license-${id}"></a>\n\n### ${id}\n\n\`\`\`text\n${text}\n\`\`\`\n`).join('\n')
fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), document)
console.log(`Third-party notices: ${entries.length} dependency entries, ${bodies.size} notice texts.`)
