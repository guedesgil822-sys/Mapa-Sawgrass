#!/usr/bin/env python3
"""Caixas eletrônicos (ATM) da planta: ícone vermelho com "$".

Posições achadas comparando o desenho (maps/l1.svg) com o ícone "$" em vários tamanhos
(skimage.match_template, correlação >= 0.75); coordenadas já no sistema do app.
Uso: python3 tools/add_atms.py [repo]
"""
import json
import math
import re
import sys
from pathlib import Path

REPO = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
ATMS = [(759, 762), (2515, 793), (918, 876), (2735, 1692), (1952, 1693), (2425, 1510), (1252, 1027)]
SKIP = {"Entradas", "Estacionamento", "Facilidades"}

data = json.loads((REPO / "data" / "mall.json").read_text())
data["pois"] = [p for p in data["pois"] if p.get("cat") != "Caixa eletrônico"]
corridor = [n for n in data["nodes"] if n["t"] == "c"]
stores = [p for p in data["pois"] if p.get("group") not in SKIP and not p.get("approx")]
nid = max(int(re.sub(r"\D", "", p["id"]) or 0) for p in data["pois"]) + 1
for x, y in ATMS:
    near = min(corridor, key=lambda n: math.hypot(n["x"] - x, n["y"] - y))
    ref = min(stores, key=lambda p: math.hypot(p["x"] - x, p["y"] - y))
    data["pois"].append({"id": f"p{nid}", "name": f"Caixa eletrônico · {ref['name']}", "f": "L1", "x": x, "y": y,
                         "node": near["id"], "group": "Facilidades", "cat": "Caixa eletrônico", "label": False})
    nid += 1
(REPO / "data" / "mall.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(len(ATMS), "caixas eletrônicos")
