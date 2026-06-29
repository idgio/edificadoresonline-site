#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# Aggressive defaults for web/mobile PDFs. Override per run, for example:
# PDF_PROFILE=/ebook PDF_IMAGE_DPI=120 PDF_JPEG_QUALITY=65 sh compress-pdf.sh
PDF_PROFILE="${PDF_PROFILE:-/screen}"
IMAGE_DPI="${PDF_IMAGE_DPI:-96}"
MONO_DPI="${PDF_MONO_DPI:-150}"
JPEG_QUALITY="${PDF_JPEG_QUALITY:-55}"

slugify() {
  local s="$1"
  local normalized
  s="${s%.*}"
  if normalized="$(printf "%s" "$s" | perl -MUnicode::Normalize -CS -pe '$_=lc NFD($_); s/\p{Mn}//g' 2>/dev/null)"; then
    s="$normalized"
  else
    s="$(printf "%s" "$s" | tr '[:upper:]' '[:lower:]')"
  fi
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
echo "Image DPI: $IMAGE_DPI, mono DPI: $MONO_DPI, JPEG quality: $JPEG_QUALITY"
echo ""

for f in "${files[@]}"; do
  base="$(basename "$f")"
  slug="$(slugify "$base")"
  outname="out/${slug}.pdf"
  input="./$f"

  original_size=$(stat -f%z "$f")

  gs -sDEVICE=pdfwrite \
     -dCompatibilityLevel=1.4 \
     -dPDFSETTINGS="$PDF_PROFILE" \
     -dDetectDuplicateImages=true \
     -dCompressFonts=true \
     -dDownsampleColorImages=true \
     -dColorImageDownsampleType=/Bicubic \
     -dColorImageResolution="$IMAGE_DPI" \
     -dDownsampleGrayImages=true \
     -dGrayImageDownsampleType=/Bicubic \
     -dGrayImageResolution="$IMAGE_DPI" \
     -dDownsampleMonoImages=true \
     -dMonoImageDownsampleType=/Subsample \
     -dMonoImageResolution="$MONO_DPI" \
     -dAutoFilterColorImages=false \
     -dColorImageFilter=/DCTEncode \
     -dAutoFilterGrayImages=false \
     -dGrayImageFilter=/DCTEncode \
     -dJPEGQ="$JPEG_QUALITY" \
     -dNOPAUSE \
     -dBATCH \
     -dQUIET \
     -sOutputFile="$outname" \
     -f "$input"

  new_size=$(stat -f%z "$outname")

  reduction=$(awk "BEGIN {printf \"%.1f\", (1 - $new_size / $original_size) * 100}")

  echo "✅ $base"
  echo "   -> $outname"
  echo "   reduced ${reduction}%"
  echo ""
done
