#!/bin/sh
# Baixa a planta oficial do Sawgrass Mills em PDF (vetor), publicada pela Simon:
# simon.com/assets/mall/1262/mall_floorplan_doc/sawgrassmills.pdf
# Uso: sh tools/fetch_sources.sh <pasta_raw> && python3 tools/build_from_pdf.py <pasta_raw> .
set -e
RAW="${1:?informe a pasta de destino}"
mkdir -p "$RAW"
curl -fsS -A "Mozilla/5.0" "https://www.simon.com/assets/mall/1262/mall_floorplan_doc/sawgrassmills.pdf" -o "$RAW/sawgrassmills.pdf"
echo "ok: agora rode build_from_pdf.py"
# Ruas e estacionamentos em volta do shopping (OpenStreetMap, licença ODbL)
curl -fsS -A "mapa-sawgrass/1.0" "https://api.openstreetmap.org/api/0.6/map.json?bbox=-80.3340,26.1420,-80.3100,26.1600" -o "$RAW/osm.json"
echo "ok: depois rode add_osm.py"
