# ============================================================
# serve.ps1 - simple static file server for local preview.
#
#   powershell -ExecutionPolicy Bypass -File serve.ps1
#   then open http://localhost:8080   (Ctrl+C to stop)
#
# Needs only Windows PowerShell - no Node.js, no Python.
#
# NOTE: this file is intentionally ASCII-only. Windows PowerShell 5.1
# reads .ps1 files without a BOM as ANSI, so Cyrillic comments here
# would break the parser.
# ============================================================

param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.js'    = 'application/javascript; charset=utf-8'
  '.svg'   = 'image/svg+xml'
  '.woff2' = 'font/woff2'
  '.jpg'   = 'image/jpeg'
  '.jpeg'  = 'image/jpeg'
  '.png'   = 'image/png'
  '.webp'  = 'image/webp'
  '.ico'   = 'image/x-icon'
  '.json'  = 'application/json; charset=utf-8'
  '.md'    = 'text/markdown; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Sherikkon Consulting - local static server"
Write-Host "  root: $Root"
Write-Host "  url:  http://localhost:$Port"
Write-Host "  stop: Ctrl+C"
Write-Host ""

$fullRoot = [System.IO.Path]::GetFullPath($Root)

try {
  while ($listener.IsListening) {
    $context  = $listener.GetContext()
    $request  = $context.Request
    $response = $context.Response

    $rel = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    $path = Join-Path $Root ($rel.Replace('/', [char]92))

    # Never serve anything outside the project folder
    $fullPath = $null
    try { $fullPath = [System.IO.Path]::GetFullPath($path) } catch { $fullPath = $null }

    $ok = $false
    if ($fullPath) {
      if ($fullPath.StartsWith($fullRoot) -and (Test-Path $fullPath -PathType Leaf)) { $ok = $true }
    }

    if ($ok) {
      $ext  = [System.IO.Path]::GetExtension($fullPath).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }

      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      $response.ContentType     = $type
      $response.ContentLength64 = $bytes.Length
      $response.AddHeader('Cache-Control', 'no-cache')
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host ("200  " + $rel)
    }
    else {
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 not found')
      $response.StatusCode      = 404
      $response.ContentType     = 'text/plain; charset=utf-8'
      $response.ContentLength64 = $body.Length
      $response.OutputStream.Write($body, 0, $body.Length)
      Write-Host ("404  " + $rel)
    }

    $response.OutputStream.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
