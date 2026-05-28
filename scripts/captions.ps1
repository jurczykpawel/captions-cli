#!/usr/bin/env pwsh
# captions — friendly wrapper around the captions-cli Docker image (Windows / PowerShell).
#
#   captions myvideo.mp4 --lang pl
#
# Pass a normal path to your video; this mounts its folder into the
# container and writes <name>-captioned.mp4 next to it. Override the image
# with $env:CAPTIONS_IMAGE (e.g. ...:full for --engine hf).
# Docs: https://github.com/jurczykpawel/captions-cli
$ErrorActionPreference = "Stop"

$image = if ($env:CAPTIONS_IMAGE) { $env:CAPTIONS_IMAGE } else { "ghcr.io/jurczykpawel/captions-cli:slim" }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Docker isn't installed. Get Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
}

if ($args.Count -eq 0 -or $args[0] -eq "-h" -or $args[0] -eq "--help") {
  docker run --rm $image --help; exit $LASTEXITCODE
}
if ($args[0] -eq "--list-presets" -or $args[0] -eq "--list-engines") {
  docker run --rm $image @args; exit $LASTEXITCODE
}

# The input video is the first argument that is an existing file.
$video = $null
foreach ($a in $args) { if (Test-Path -PathType Leaf $a) { $video = $a; break } }
if (-not $video) {
  Write-Error "couldn't find your video file in the arguments. Try: captions path\to\video.mp4 --lang en"
  exit 1
}

$parent = Split-Path -Parent $video
if (-not $parent) { $parent = "." }
$dir  = (Resolve-Path $parent).Path
$base = Split-Path -Leaf $video

# Translate the host video path to its in-container path; pass the rest through.
$mapped = foreach ($a in $args) { if ($a -eq $video) { "/work/$base" } else { $a } }

docker run --rm -v "${dir}:/work" -v captions-cache:/data $image @mapped
exit $LASTEXITCODE
