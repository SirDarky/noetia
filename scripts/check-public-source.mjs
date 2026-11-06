import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
if (!files.length) throw new Error('Nenhum arquivo versionado: prepare o índice antes da verificação pública.')
const findings = []
const forbidden = /(?:^|\/)(?:\.env(?:\.|$)|NoetiaData\/|library\.json$|node_modules\/|target\/|artifacts\/|release\/|\.tmp\/)/i
const secrets = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, /\bgithub_pat_[A-Za-z0-9_]{40,}\b/, /\bsk-[A-Za-z0-9_-]{32,}\b/]
const publicMarkdown = new Set(['README.md', 'ASSETS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md', 'docs/USER_GUIDE.md', 'docs/PRIVACY.md', 'docs/TEST_REPORT.md'])
for (const name of files) {
  if (/\.md$/i.test(name) && !publicMarkdown.has(name) && !name.startsWith('examples/')) findings.push({ file: name, reason: 'Documento interno fora da lista de documentação pública permitida.' })
  if (forbidden.test(name)) findings.push({ file: name, reason: 'Arquivo de dados/segredo/build não deve ser publicado.' })
  const filename = path.join(root, name), stat = fs.statSync(filename)
  if (stat.size > 2000000 || /\.(png|jpe?g|ico|icns|webp|woff2?|ttf)$/i.test(name)) continue
  const text = fs.readFileSync(filename, 'utf8')
  for (const pattern of secrets) if (pattern.test(text)) findings.push({ file: name, reason: 'Possível credencial ou chave privada; valor omitido.' })
  if (/C:(?:\\{1,8}|\/)Users(?:\\{1,8}|\/)[^\\/\s'"<>]+/i.test(text)) findings.push({ file: name, reason: 'Caminho de perfil pessoal da máquina de desenvolvimento.' })
}
if (findings.length) { console.error(JSON.stringify(findings, null, 2)); process.exitCode = 1 }
else console.log(`Verificação pública: ${files.length} arquivos; nenhum padrão de credencial, perfil local ou caminho pessoal detectado.`)
