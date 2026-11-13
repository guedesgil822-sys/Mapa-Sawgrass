#!/usr/bin/env python3
"""Acrescenta as lojas do diretório atual (malls.com) que ainda não estão no mapa.

O diretório não dá coordenadas, só pistas ("Ground Floor between Gap Factory and Solaris",
"Oasis Entrance … across from Nike"). Cada loja vai para perto das lojas citadas (no meio,
se forem duas), um pouco para o lado do corredor, ligada ao corredor mais próximo, e marcada
com "approx": true (o app mostra "local aproximado"). Sem pista utilizável, a loja fica de fora.

Uso: python3 tools/add_missing.py RAW_DIR [repo]   (depois de update_stores.py)
"""
import html
import json
import math
import re
import sys
from pathlib import Path

RAW = Path(sys.argv[1])
REPO = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "tools"))
src = (REPO / "tools" / "update_stores.py").read_text().split("def main")[0]
src = src.replace("RAW = Path(sys.argv[1])", "RAW = Path('.')").replace(
    "REPO = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent", "REPO = Path('.')")
U = {}
exec(src, U)
same, NEW_WEB = U["same"], U["NEW_WEB"]

# pista de área -> lugar do mapa
AREAS = [("Oasis Entrance", "The Oasis"), ("The Oasis", "The Oasis"), ("East Entrance near Adidas", "Adidas"),
         ("East Dining Pavilion", "Garden Food Court"), ("West Dining Pavilion", "Market Food Court"),
         ("West Entrance near Marshalls", "Marshalls"), ("Colonnade Outlets Entrance", "Bloomingdale's Outlet"),
         ("The Colonnade Outlets", "The Colonnade Outlets"), ("East Entrance", "Super Target")]
CAT = {
    "Fashion": ("Moda", "Vestuário"), "Jewelry": ("Óticas e joias", "Joias, óculos e acessórios"),
    "Accessories": ("Óticas e joias", "Joias, óculos e acessórios"), "Beauty": ("Beleza", "Beleza e perfumaria"),
    "F&B": ("Alimentação", "Restaurante"), "Sports": ("Esportes", "Artigos esportivos"), "Home": ("Casa", "Casa e decoração"),
    "Electronics": ("Tecnologia", "Eletrônicos"), "Entertainment": ("Lazer", "Entretenimento"),
    "Financial": ("Serviços", "Serviços"), "Luxury": ("Moda", "Vestuário"),
}
FOODY = re.compile(r"empanada|burrito|sushi|crepe|tea|fruta|jediondo|grill|cafe|café", re.I)
WEB = {"Aerie": "ae.com", "Diesel": "diesel.com", "J. Crew Factory": "jcrew.com", "Pandora": "pandora.net", "SKIMS": "skims.com",
       "Zales Outlet": "zales.com", "Agua Bendita": "aguabendita.com", "Citizen": "citizenwatch.com", "Clarins Factory": "clarins.com",
       "Cult Gaia": "cultgaia.com", "Florsheim Shoes": "florsheim.com", "Herve Leger": "herveleger.com", "Hugo": "hugoboss.com",
       "HUK": "hukgear.com", "Invicta": "invictastores.com", "Janie & Jack": "janieandjack.com", "Johnny Was": "johnnywas.com",
       "Lucky Brand": "luckybrand.com", "Luli Fama": "lulifama.com", "Original Penguin": "originalpenguin.com", "Rebag": "rebag.com",
       "Sferra": "sferra.com", "Splendid": "splendid.com", "Watch Station International": "watchstation.com",
       "Zwilling J.A. Henckels": "zwilling.com", "UNOde50": "unode50.com", "Banter by Piercing Pagoda": "banter.com",
       "Diamonds International": "diamondsinternational.com", "The Escape Game": "theescapegame.com", "Cubavera": "cubavera.com",
       "Currency Exchange International": "ceifx.com", "Uniform Advantage": "uniformadvantage.com", "Pro Tech - Garmin": "garmin.com",
       "Babycottons": "babycottons.com", "Purificacion Garcia": "purificaciongarcia.com", "Racing Miami": "", "Bylt": "byltbasics.com"}


def main():
    data = json.loads((REPO / "data" / "mall.json").read_text())
    page = (RAW / "malls.html").read_text(encoding="utf-8", errors="ignore")
    rows = re.findall(r'data-cat="([^"]*)" data-brand="([^"]*)" data-q="([^"]*)"', page)
    ppm = data["meta"]["pxPerMeter"]
    corridor = [n for n in data["nodes"] if n["t"] == "c"]
    pois = data["pois"]
    have = lambda name: any(same(name, p["name"]) for p in pois)
    find = lambda name: next((p for p in pois if same(name, p["name"])), None)

    todo, seen = [], set()
    for cat, brand, q in rows:
        name, q, cat = html.unescape(brand), html.unescape(q), html.unescape(cat)
        if name in seen or have(name) or name in ("Purification Garcia", "Racing", "Seasons"):
            continue
        seen.add(name)
        hint = q[len(name) + len(cat) + 1:].strip()
        todo.append((name, cat, hint))

    added, skipped = [], []
    nid = max(int(re.sub(r"\D", "", p["id"]) or 0) for p in pois) + 1
    for _ in range(3):                      # lojas novas podem servir de referência para outras
        left = []
        for name, cat, hint in todo:
            m = re.search(r"Ground Floor (between|next to|near|across from) (.+)$", hint)
            refs = []
            if m:
                for part in re.split(r"\s+and\s+", m.group(2)):
                    p = find(part.strip())
                    if p:
                        refs.append(p)
            if not refs:
                area = next((t for k, t in AREAS if k in hint), None)
                p = find(area) if area else None
                if p and m is None or (p and not refs and _ == 2):
                    refs = [p]
            if not refs:
                left.append((name, cat, hint)); continue
            x = sum(p["x"] for p in refs) / len(refs)
            y = sum(p["y"] for p in refs) / len(refs)
            near = min(corridor, key=lambda n: math.hypot(n["x"] - x, n["y"] - y))
            if m and m.group(1) == "across from":   # do outro lado do corredor
                x, y = 2 * near["x"] - x, 2 * near["y"] - y
                near = min(corridor, key=lambda n: math.hypot(n["x"] - x, n["y"] - y))
            # metade do caminho até o corredor: fica na frente das lojas, não em cima delas
            x, y = (x + near["x"]) / 2, (y + near["y"]) / 2
            grp, c = CAT.get(cat, ("Moda", "Vestuário"))
            if FOODY.search(name) or cat == "F&B":
                grp, c = "Alimentação", "Restaurante"
            q = {"id": f"p{nid}", "name": name, "f": "L1", "x": round(x, 1), "y": round(y, 1), "node": near["id"],
                 "group": grp, "cat": c, "approx": True}
            w = WEB.get(name) or NEW_WEB.get(name)
            if w:
                q["web"] = w
            pois.append(q); nid += 1
            added.append(f"{name} ← {hint[:70]}")
        todo = left
    skipped = [n for n, _, _ in todo]

    (REPO / "data" / "mall.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    rep = REPO / "tools" / "update_stores_report.json"
    r = json.loads(rep.read_text())
    r["aproximadas"], r["sem_pista"] = added, skipped
    rep.write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print("aproximadas:", len(added), "sem pista:", len(skipped), skipped)


if __name__ == "__main__":
    main()
