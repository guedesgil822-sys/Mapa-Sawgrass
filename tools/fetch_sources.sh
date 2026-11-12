#!/bin/sh
# Baixa a planta do Sawgrass Mills (PDF para impressão publicado em
# all-maps.com/sawgrass-mills-mall-map/) e extrai a imagem para <pasta_raw>/map.png.
# Uso: sh tools/fetch_sources.sh <pasta_raw> && python3 tools/build_data.py <pasta_raw> .
# Precisa de curl e pdfimages (poppler-utils).
set -e
RAW="${1:?informe a pasta de destino}"
URL="https://all-maps.com/wp-content/uploads/2024/12/Printable-Sawgrass-Mills-Mall-Map-PDF-2024.pdf"
mkdir -p "$RAW"
curl -fsS -A "Mozilla/5.0" "$URL" -o "$RAW/map.pdf"
pdfimages -png "$RAW/map.pdf" "$RAW/img"
mv "$RAW/img-000.png" "$RAW/map.png"
echo "ok: agora rode build_data.py"
