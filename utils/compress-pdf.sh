#!/usr/bin/env bash
set -euo pipefail

# Default Ghostscript profile for web
PDF_PROFILE="/ebook"

slugify() {
  local s="$1"
  s="${s%.*}"
  s="$(printf "%s" "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(printf "%s" "$s" | iconv -f UTF-8 -t ASCII//TRANSLIT 2>/dev/null || printf "%s" "$s")"
  s="$(printf "%s" "$s" | sed -E 's/[[:space:]_]+/-/g; s/[^a-z0-9-]+/-/g; s/-+/-/g; s/^-|-$//g')"
  printf "%s" "$s"
}

# Check Ghostscript
if ! command -v gs >/dev/null 2>&1; then
  echo "❌ Ghostscript not installed"
  echo "Install with: brew install ghostscript"
  exit 1
fi

mkdir -p out

shopt -s nullglob nocaseglob
files=( *.pdf )

if [ ${#files[@]} -eq 0 ]; then
  echo "No PDF files found."
  exit 0
fi

echo "Using compression profile: $PDF_PROFILE"
echo ""

for f in "${files[@]}"; do
  base="$(basename "$f")"
  slug="$(slugify "$base")"
  outname="out/${slug}.pdf"

  original_size=$(stat -f%z "$f")

  gs -sDEVICE=pdfwrite \
     -dCompatibilityLevel=1.4 \
     -dPDFSETTINGS="$PDF_PROFILE" \
     -dDetectDuplicateImages=true \
     -dCompressFonts=true \
     -dNOPAUSE \
     -dBATCH \
     -dQUIET \
     -sOutputFile="$outname" \
     "$f"

  new_size=$(stat -f%z "$outname")

  reduction=$(awk "BEGIN {printf \"%.1f\", (1 - $new_size / $original_size) * 100}")

  echo "✅ $base"
  echo "   -> $outname"
  echo "   reduced ${reduction}%"
  echo ""
done