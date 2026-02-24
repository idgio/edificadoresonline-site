#!/usr/bin/env bash
set -euo pipefail

# Slugify: lowercase, remove accents, spaces->-, keep a-z0-9-
slugify() {
  local s="$1"
  s="${s%.*}"
  s="$(printf "%s" "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf "%s" "$s" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf "%s" "$s")"
  s="$(printf "%s" "$s" | sed -E 's/[[:space:]_]+/-/g; s/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-|-$//g')"
  printf "%s" "$s"
}

# Ensure ImageMagick is installed
if ! command -v magick >/dev/null 2>&1; then
  echo "❌ ImageMagick not found. Install with: brew install imagemagick"
  exit 1
fi

mkdir -p out

shopt -s nullglob nocaseglob
files=( *.jpg *.jpeg *.png )

if [ ${#files[@]} -eq 0 ]; then
  echo "No jpg/jpeg/png files found in this folder."
  exit 0
fi

for f in "${files[@]}"; do
  base="$(basename "$f")"
  outname="$(slugify "$base").webp"
  tmp="/tmp/$outname"

  # Resize max width 1200px, keep aspect ratio, don't enlarge
  magick "$f" -resize '1200x>' -strip -quality 80 "$tmp"

  mv "$tmp" "out/$outname"
  echo "✅ $f -> out/$outname"
done