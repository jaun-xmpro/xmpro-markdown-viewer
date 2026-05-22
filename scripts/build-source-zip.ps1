# Rebuild the source ZIP from the current metablock/ contents.
# Run from the repo root.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'metablock'
$dst  = Join-Path $root 'dist\xmpro-markdown-viewer-source.zip'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
Compress-Archive -Path "$src\*" -DestinationPath $dst -Force
Write-Host "Wrote dist/xmpro-markdown-viewer-source.zip"
