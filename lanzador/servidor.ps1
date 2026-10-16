# Servidor local mínimo para Copiloto PO (Windows, sin instalar nada).
# Sirve solo los archivos de esta carpeta, solo para este equipo (localhost).
# Usa siempre el puerto 8765: el navegador guarda tus proyectos asociados a esa dirección.
param(
    [int]$Puerto = 8765,
    [switch]$SinAbrir
)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$direccion = "http://localhost:$Puerto/"

$tipos = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
    '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'
}

# Si ya está abierto (por ejemplo, otra ventana), solo abre el navegador
try {
    $null = Invoke-WebRequest -Uri $direccion -UseBasicParsing -TimeoutSec 2
    Write-Host "Copiloto PO ya está abierto en $direccion"
    if (-not $SinAbrir) { Start-Process $direccion }
    exit 0
} catch { }

$escucha = New-Object System.Net.HttpListener
$escucha.Prefixes.Add($direccion)
try {
    $escucha.Start()
} catch {
    Write-Host "No se pudo usar el puerto $Puerto. ¿Otro programa lo está usando?" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '  Copiloto PO está abierto en:' -ForegroundColor Cyan
Write-Host "  $direccion"
Write-Host ''
Write-Host '  Deja esta ventana abierta mientras lo usas. Para terminar, ciérrala.'
Write-Host '  Tus datos quedan en el navegador de este equipo.'
Write-Host ''
if (-not $SinAbrir) { Start-Process $direccion }

try {
    while ($escucha.IsListening) {
        $contexto = $escucha.GetContext()
        $respuesta = $contexto.Response
        try {
            $ruta = [Uri]::UnescapeDataString($contexto.Request.Url.AbsolutePath).TrimStart('/')
            if ($ruta -eq '') { $ruta = 'index.html' }
            $archivo = [IO.Path]::GetFullPath((Join-Path $raiz $ruta))
            # Nunca servir fuera de la carpeta ni archivos ocultos (.git, etc.)
            if (-not $archivo.StartsWith($raiz + [IO.Path]::DirectorySeparatorChar) -or $ruta -match '(^|/)\.') {
                $respuesta.StatusCode = 403
            } elseif (Test-Path $archivo -PathType Leaf) {
                $bytes = [IO.File]::ReadAllBytes($archivo)
                $extension = [IO.Path]::GetExtension($archivo).ToLower()
                $respuesta.ContentType = if ($tipos.ContainsKey($extension)) { $tipos[$extension] } else { 'application/octet-stream' }
                $respuesta.Headers.Add('Cache-Control', 'no-cache')
                $respuesta.Headers.Add('X-Content-Type-Options', 'nosniff')
                $respuesta.ContentLength64 = $bytes.Length
                $respuesta.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $respuesta.StatusCode = 404
            }
        } catch {
            $respuesta.StatusCode = 500
        } finally {
            $respuesta.Close()
        }
    }
} finally {
    $escucha.Stop()
}
