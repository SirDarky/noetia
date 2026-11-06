param([switch]$SkipBuild, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$package = Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json
$version = $package.version
$configuration = Get-Content -LiteralPath (Join-Path $project 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
if ($configuration.version -ne $version) { throw 'Versões do frontend e desktop não coincidem.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $project 'release' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
Push-Location $project
try {
  if (-not $SkipBuild) {
    & npm run build:desktop
    if ($LASTEXITCODE -ne 0) { throw 'Falha na compilação desktop.' }
  }
  $exe = Join-Path $project 'src-tauri/target/release/noetia.exe'
  $installer = Join-Path $project "src-tauri/target/release/bundle/nsis/Noetia_${version}_x64-setup.exe"
  foreach ($path in @($exe,$installer)) { if (-not (Test-Path -LiteralPath $path)) { throw "Artefato ausente: $path" } }
  function FileSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
  }
  $signatureStatus = 'NotChecked'
  if (Get-Command Get-AuthenticodeSignature -ErrorAction SilentlyContinue) { $signatureStatus = (Get-AuthenticodeSignature -LiteralPath $exe).Status.ToString() }
  $temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $temporary = Join-Path $temporaryBase ('noetia-package-' + [guid]::NewGuid().ToString('N'))
  $portableName = "Noetia-$version-windows-x64-portable"
  $portable = Join-Path $temporary $portableName
  New-Item -ItemType Directory -Path $portable -Force | Out-Null
  try {
    Copy-Item -LiteralPath $exe -Destination (Join-Path $portable 'Noetia.exe')
    Set-Content -LiteralPath (Join-Path $portable 'noetia.portable') -Value '1' -Encoding UTF8
    foreach ($name in @('LICENSE','ASSETS.md','THIRD_PARTY_NOTICES.md')) {
      Copy-Item -LiteralPath (Join-Path $project $name) -Destination (Join-Path $portable $name)
    }
    Copy-Item -LiteralPath (Join-Path $project 'examples') -Destination (Join-Path $portable 'Exemplos') -Recurse
    @"
Noetia $version - Windows x64 - Portatil

Extraia a pasta completa e abra Noetia.exe. Nao execute de dentro do ZIP.
Requer Windows 10/11 x64 e Microsoft Edge WebView2 Runtime.
O instalador do WebView2 esta no site oficial da Microsoft:
https://developer.microsoft.com/microsoft-edge/webview2/

Dados, sessao, comentarios, rascunhos e backups ficam em NoetiaData,
criada ao lado do executavel. Mantenha o arquivo noetia.portable.
Use uma pasta gravavel, fora de Arquivos de Programas.
Para transportar seu perfil, feche o aplicativo e copie a pasta inteira.
As notas externas continuam em suas pastas: copie-as separadamente se necessario.
Notas dentro desta pasta mantem a identidade quando ela e movida.

No primeiro uso, clique em Adicionar pasta e escolha Exemplos.
As imagens publicadas mostram funcionalidades reais com esses documentos.

Codigo MIT. Consulte LICENSE, ASSETS.md e THIRD_PARTY_NOTICES.md.
Executavel ainda sem assinatura digital. Confira os hashes SHA256 da release.
Repositorio: https://github.com/SirDarky/noetia
"@ | Set-Content -LiteralPath (Join-Path $portable 'LEIA-ME.txt') -Encoding UTF8
    $zip = Join-Path $output "$portableName.zip"
    Compress-Archive -LiteralPath $portable -DestinationPath $zip -Force
    $setup = Join-Path $output "Noetia-$version-windows-x64-setup.exe"
    Copy-Item -LiteralPath $installer -Destination $setup
    $hashes = @($setup,$zip) | ForEach-Object { "$(FileSha256 $_)  $([IO.Path]::GetFileName($_))" }
    $hashes | Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Encoding ASCII
    [ordered]@{ version=$version; platform='windows'; architecture='x64'; portableData='NoetiaData'; signature=$signatureStatus; createdUtc=[DateTime]::UtcNow.ToString('o'); files=@([IO.Path]::GetFileName($setup),[IO.Path]::GetFileName($zip)) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'release-manifest.json') -Encoding UTF8
    Write-Output "Instalador e ZIP portatil gerados em $output"
  } finally {
    $resolved = [IO.Path]::GetFullPath($temporary)
    if ($resolved.StartsWith($temporaryBase.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolved).StartsWith('noetia-package-')) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
} finally { Pop-Location }
