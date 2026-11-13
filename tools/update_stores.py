#!/usr/bin/env python3
"""Atualiza as lojas da planta de 2007 com dados atuais.

Fontes (baixadas por fetch_sources.sh em RAW):
  - osm.json   : OpenStreetMap (lojas e restaurantes com posição)
  - malls.html : diretório atual do shopping no malls.com (só nomes)

Regras, para cada loja da planta (contorno = "poly"):
  - há loja do OSM dentro com o mesmo nome      -> mantém o lugar e usa o nome atual
  - há 1 ou 2 lojas do OSM dentro, outro nome   -> o espaço virou a loja mais central
  - há 3 ou mais                                -> o espaço foi dividido: some o nome antigo,
                                                   cada loja nova vira um ponto
  - nenhuma: o nome aparece no OSM em outro lugar -> mudou de lugar (sai daqui)
             o nome está no diretório atual       -> continua (o OSM só não tem)
             nada                                 -> fechou (sai do mapa)
Lojas do OSM que não caíram em nenhum contorno viram pontos ligados ao corredor mais próximo.
Nas lojas que mudaram ou fecharam, o nome antigo é apagado do desenho (maps/l1.svg) e o app
passa a escrever o nome novo.

Uso: python3 tools/update_stores.py RAW_DIR [repo]   (rodar uma vez, depois de add_osm.py)
"""
import html
import json
import math
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

RAW = Path(sys.argv[1])
REPO = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
MALL = REPO / "data" / "mall.json"
SVG = REPO / "maps" / "l1.svg"
BRANDS = REPO / "tools" / "brands.json"

KEEP_GROUPS = {"Entradas", "Estacionamento", "Facilidades", "Serviços"}  # não são lojas
GENERIC = {"outlet", "factory", "store", "stores", "company", "co", "the", "shop", "usa", "inc", "warehouse",
           "house", "collection", "outlets", "by", "and", "de", "of", "new", "york", "paris", "official"}
# áreas do shopping (praças de alimentação, cinema, parque…), não lojas
AREAS = {"Praça de alimentação", "Grifes ao ar livre", "Restaurantes e lazer ao ar livre", "Cinema"}  # (a Wannado City fechou)
FOOD = {"restaurant", "fast_food", "cafe", "coffee", "ice_cream", "bakery", "chocolate"}

# segmento e categoria (em português, como no resto dos dados) a partir das etiquetas do OSM
def classify(tags, name):
    k = tags.get("shop") or tags.get("amenity") or ""
    kids = tags.get("clothes") == "children" or re.search(r"\b(kids|children|baby|babycottons)\b", name, re.I)
    if k in ("restaurant", "fast_food"):
        return "Alimentação", "Restaurante"
    if k in FOOD:
        return "Alimentação", "Doces, cafés e lanches"
    if kids and k in ("clothes", "shoes", ""):
        return "Infantil", "Roupas e calçados infantis"
    return {
        "clothes": ("Moda", "Vestuário"), "shoes": ("Calçados", "Calçados"), "sports": ("Esportes", "Artigos esportivos"),
        "department_store": ("Moda", "Loja de departamento"), "bag": ("Moda", "Bolsas e malas"),
        "jewelry": ("Óticas e joias", "Joias, óculos e acessórios"), "watches": ("Óticas e joias", "Joias, óculos e acessórios"),
        "optician": ("Óticas e joias", "Joias, óculos e acessórios"), "fashion_accessories": ("Óticas e joias", "Joias, óculos e acessórios"),
        "cosmetics": ("Beleza", "Beleza e perfumaria"), "perfumery": ("Beleza", "Beleza e perfumaria"), "beauty": ("Beleza", "Beleza e perfumaria"),
        "electronics": ("Tecnologia", "Eletrônicos"), "mobile_phone": ("Tecnologia", "Eletrônicos"),
        "toys": ("Infantil", "Brinquedos"), "houseware": ("Casa", "Casa e decoração"), "interior_decoration": ("Casa", "Casa e decoração"),
        "furniture": ("Casa", "Móveis"), "books": ("Lazer", "Livraria"), "gift": ("Lazer", "Livros e presentes"),
        "variety_store": ("Casa", "Casa e decoração"), "pharmacy": ("Serviços", "Serviços"),
    }.get(k, ("Moda", "Vestuário"))

# site oficial (para o logo) das marcas novas
NEW_WEB = {
    "7 For All Mankind": "7forallmankind.com", "ASICS": "asics.com", "Abercrombie Kids": "abercrombie.com", "Aldo Outlet": "aldoshoes.com",
    "AllSaints": "allsaints.com", "American Eagle Outfitters": "ae.com", "Ariat": "ariat.com", "Aritzia": "aritzia.com", "Armani": "armani.com",
    "Armani Exchange": "armaniexchange.com", "Asian Chao": "asianchao.com", "Banana Republic": "bananarepublic.com", "Baskin-Robbins": "baskinrobbins.com",
    "Birkenstock": "birkenstock.com", "Bloomingdale's Outlet": "bloomingdales.com", "Boss": "hugoboss.com", "BoxLunch": "boxlunch.com",
    "BrandsMart": "brandsmartusa.com", "Burlington": "burlington.com", "CVS Pharmacy": "cvs.com", "California Pizza Kitchen": "cpk.com",
    "Calvin Klein": "calvinklein.us", "Calzedonia": "calzedonia.com", "Charleys Philly Steaks": "charleys.com", "Chipotle": "chipotle.com",
    "Churromania": "churromania.com", "Clarks": "clarks.com", "Coach": "coach.com", "Columbia": "columbia.com", "Converse": "converse.com",
    "Crocs": "crocs.com", "Desigual": "desigual.com", "Dick's Sporting Goods": "dickssportinggoods.com", "Dunkin'": "dunkindonuts.com",
    "Ecco": "ecco.com", "Express Factory Outlet": "express.com", "Fabletics": "fabletics.com", "Famous Footwear": "famousfootwear.com",
    "Ferragamo": "ferragamo.com", "Firehouse Subs": "firehousesubs.com", "Five Below": "fivebelow.com", "Five Guys": "fiveguys.com",
    "Foot Locker": "footlocker.com", "Fossil": "fossil.com", "G by Guess": "gbyguess.com", "G-Star Raw": "g-star.com", "Gap": "gapfactory.com",
    "Garage": "garageclothing.com", "Guess": "guess.com", "H&M": "hm.com", "Hollister": "hollisterco.com", "HomeSense": "homesense.com",
    "Hurley": "hurley.com", "Häagen-Dazs": "haagendazs.us", "Intimissimi": "intimissimi.com", "J.Crew": "jcrew.com", "JD Sports": "jdsports.com",
    "Jimmy Choo": "jimmychoo.com", "Journeys": "journeys.com", "Juan Valdez Café": "juanvaldezcafe.com", "KIKO Milano": "kikocosmetics.com",
    "Karl Lagerfeld": "karl.com", "Kate Spade New York": "katespade.com", "Kay Jewelers": "kay.com", "Kipling": "kipling-usa.com",
    "L'Occitane": "loccitane.com", "Lacoste": "lacoste.com", "Lafayette 148": "lafayette148ny.com", "Lego": "lego.com", "Lids": "lids.com",
    "Lululemon": "lululemon.com", "Läderach": "laderach.com", "Marshalls": "marshalls.com", "Michael Kors": "michaelkors.com",
    "Michael Kors Mens": "michaelkors.com", "Moncler": "moncler.com", "Movado": "movado.com", "Nathan's": "nathansfamous.com",
    "New Balance Factory Store": "newbalance.com", "Nike Factory Store": "nike.com", "Nordstrom Rack": "nordstromrack.com",
    "Oakley Vault": "oakley.com", "Off Broadway Shoes Warehouse": "offbroadwayshoes.com", "Old Navy Outlet": "oldnavy.com",
    "Greg Norman": "gregnorman.com", "OshKosh B'gosh": "oshkosh.com", "Osmow's": "osmows.com", "P.F. Chang's": "pfchangs.com",
    "PacSun": "pacsun.com", "Paul's Bakery": "paul-usa.com", "Perfumania": "perfumania.com", "Perry Ellis": "perryellis.com",
    "Philipp Plein": "plein.com", "Polo Ralph Lauren": "ralphlauren.com", "Polo Ralph Lauren Children": "ralphlauren.com", "Popeyes": "popeyes.com",
    "Primark": "primark.com", "Puma Outlet": "puma.com", "Pure Green": "puregreen.com", "Rack Room Shoes": "rackroomshoes.com",
    "Rainforest Cafe": "rainforestcafe.com", "Reebok": "reebok.com", "Robert Graham": "robertgraham.us", "Roberto Cavalli": "robertocavalli.com",
    "Saks Off 5th": "saksoff5th.com", "Samsonite": "samsonite.com", "Samsung": "samsung.com", "Sbarro": "sbarro.com", "Sephora": "sephora.com",
    "Shake Shack": "shakeshack.com", "Shoe Palace": "shoepalace.com", "Skechers": "skechers.com", "Spencer's": "spencersonline.com",
    "St. John Outlet": "stjohnknits.com", "Starbucks": "starbucks.com", "Steve Madden": "stevemadden.com", "Stuart Weitzman": "stuartweitzman.com",
    "Sunglass Hut": "sunglasshut.com", "Swarovski": "swarovski.com", "Swatch": "swatch.com", "T-Mobile": "t-mobile.com", "TAG Heuer": "tagheuer.com",
    "TJ Maxx": "tjmaxx.com", "Target": "target.com", "Texas de Brazil": "texasdebrazil.com", "The Baked Bear": "thebakedbear.com",
    "The Cheesecake Factory": "thecheesecakefactory.com", "The Children's Place": "childrensplace.com", "The North Face": "thenorthface.com",
    "Theory Men": "theory.com", "Theory Women": "theory.com", "Timberland": "timberland.com", "Tissot": "tissotwatches.com",
    "Tommy Bahama": "tommybahama.com", "Tommy Hilfiger": "tommy.com", "Tommy Hilfiger Kids": "tommy.com", "Toys R Us": "toysrus.com",
    "U.S. Polo Assn.": "uspoloassn.com", "Under Armour": "underarmour.com", "VINCE.": "vince.com", "Valentino": "valentino.com", "Vans": "vans.com",
    "Victoria's Secret & Pink": "victoriassecret.com", "Vilebrequin": "vilebrequin.com", "Vineyard Vines": "vineyardvines.com",
    "Wetzel's Pretzels": "wetzels.com", "Windsor": "windsorstore.com", "Yard House": "yardhouse.com", "Zadig & Voltaire": "zadig-et-voltaire.com",
    "Zumiez": "zumiez.com", "claire's": "claires.com", "David Yurman": "davidyurman.com", "Le Creuset": "lecreuset.com", "Cinnabon": "cinnabon.com",
    "Auntie Anne's": "auntieannes.com", "Burger King": "bk.com", "Champs Sports": "champssports.com", "Charlotte Russe": "charlotterusse.com",
    "Bath & Body Works": "bathandbodyworks.com", "Books-A-Million": "booksamillion.com", "Brooks Brothers": "brooksbrothers.com",
    "Burberry": "burberry.com", "Carter's": "carters.com", "Cole Haan": "colehaan.com", "Hot Topic": "hottopic.com", "Grand Lux Cafe": "grandluxcafe.com",
    "Sportive": "", "Epic Athletic Club": "", "Q": "", "James Bark": "jamesbark.com", "Fragrance Outlet": "fragranceoutlet.com",
    "Concept by P.": "", "Crystal Laser Studios": "crystallaserstudios.com", "Villagio": "", "La Doña Seafood & Grill": "",
    "Apropo Crepes": "", "Arepasmania": "", "Baba's Halal": "", "Green Leaf's & Bananas": "", "Kelly's Cajun Grill": "",
    "Lucciano's": "lucianos.com", "The Taco Stand": "thetacostand.com", "Oreg Norman": "gregnorman.com",
    "Prada": "prada.com", "Gucci": "gucci.com", "Fendi": "fendi.com", "Balenciaga": "balenciaga.com", "Saint Laurent": "ysl.com",
    "Versace": "versace.com", "Tory Burch": "toryburch.com", "Tumi": "tumi.com", "Christian Louboutin": "christianlouboutin.com",
    "Dolce & Gabbana": "dolcegabbana.com", "Zegna": "zegna.com", "Brunello Cucinelli": "brunellocucinelli.com", "Loro Piana": "loropiana.com",
    "Balmain": "balmain.com", "Marc Jacobs": "marcjacobs.com", "Sandro": "sandro-paris.com", "Maje": "maje.com", "Wolford": "wolford.com",
    "Montblanc": "montblanc.com", "Breitling": "breitling.com", "Tod's": "tods.com", "Etro": "etro.com", "ETRO": "etro.com", "AMIRI": "amiri.com",
    "Anine Bing": "aninebing.com", "Zimmerman": "zimmermann.com", "rag & bone": "rag-bone.com", "Psycho Bunny": "psychobunny.com",
    "Carolina Herrera": "carolinaherrera.com", "Peserico": "peserico.com", "Monnalisa": "monnalisa.com", "FRETTE": "frette.com",
    "Matchbox": "matchboxrestaurants.com", "Seasons 52": "seasons52.com", "Aguabendita": "aguabendita.com", "Valentino": "valentino.com",
}
FIX_NAME = {"Oreg Norman": "Greg Norman"}  # erro de digitação no OSM
# nomes impressos fora do contorno que a planta deu à loja (x0, y0, x1, y1 no app)
EXTRA_TEXT = {"T.J. Maxx": (1970, 1438, 2132, 1472)}


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("'", "").replace("’", "").replace(".", "")
    return [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in GENERIC]


def same(a, b):
    """Mesma marca? Compara os nomes sem palavras genéricas (outlet, factory, store…)."""
    x, y = norm(a), norm(b)
    if not x or not y:
        return False
    if x == y or " ".join(x) in " ".join(y) or " ".join(y) in " ".join(x):
        return True
    return x[0] == y[0] and len(x[0]) >= 4


def inside(x, y, poly):
    c, n = False, len(poly) // 2
    for i in range(n):
        x1, y1, x2, y2 = poly[2 * i], poly[2 * i + 1], poly[2 * ((i + 1) % n)], poly[2 * ((i + 1) % n) + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def centroid(poly):
    xs, ys = poly[0::2], poly[1::2]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def main():
    data = json.loads(MALL.read_text())
    g, ppm = data["meta"]["geo"], data["meta"]["pxPerMeter"]
    brands = json.loads(BRANDS.read_text())

    def tomap(lat, lon):
        dl, dt = lon - g["lon0"], lat - g["lat0"]
        return g["x0"] + g["xLon"] * dl + g["xLat"] * dt, g["y0"] + g["yLon"] * dl + g["yLat"] * dt

    # ---- diretório atual (só nomes)
    page = (RAW / "malls.html").read_text(encoding="utf-8", errors="ignore")
    directory = [html.unescape(b) for b in re.findall(r'data-brand="([^"]*)"', page)]

    # ---- lojas atuais do OSM dentro do shopping
    osm = json.loads((RAW / "osm.json").read_text())["elements"]
    onode = {e["id"]: (e["lat"], e["lon"]) for e in osm if e["type"] == "node"}
    corridor = [n for n in data["nodes"] if n["t"] == "c"]
    stores_poly = [p for p in data["pois"] if p.get("poly") and p.get("group") not in ("Estacionamento",)]
    cur = []
    for e in osm:
        t = e.get("tags", {})
        name = t.get("name")
        if not name or name == "Sawgrass Mills":
            continue
        if not (t.get("shop") or t.get("amenity") in FOOD | {"pharmacy"}):
            continue
        if e["type"] == "node":
            x, y = tomap(e["lat"], e["lon"])
        else:
            ns = [onode[n] for n in e.get("nodes", []) if n in onode]
            if not ns:
                continue
            x, y = tomap(sum(a for a, _ in ns) / len(ns), sum(b for _, b in ns) / len(ns))
        inpoly = any(inside(x, y, p["poly"]) for p in stores_poly)
        near = min(corridor, key=lambda n: math.hypot(n["x"] - x, n["y"] - y))
        dist = math.hypot(near["x"] - x, near["y"] - y) / ppm
        name = FIX_NAME.get(name, name)
        # longe dos corredores da planta (ex.: a parte nova do Colonnade): só se a loja está no diretório atual
        far = not inpoly and dist > 30
        if far and (dist > 160 or not any(same(name, dname) for dname in directory)):
            continue
        cur.append({"name": name, "x": x, "y": y, "tags": t, "near": near["id"], "far": far, "used": False})
    # mesmo nome a menos de 15 m = mesma loja mapeada duas vezes
    uniq = []
    for c in cur:
        if not any(u["name"] == c["name"] and math.hypot(u["x"] - c["x"], u["y"] - c["y"]) < 15 * ppm for u in uniq):
            uniq.append(c)
    cur = uniq

    def web_for(name, tags):
        w = tags.get("website") or tags.get("brand:website") or ""
        dom = re.sub(r"^https?://(www\.)?", "", w).split("/")[0]
        if dom and not any(k in dom for k in ("stores.", "store-locations", "locator")):
            return dom
        return NEW_WEB.get(name) or brands.get(name) or ""

    report = {"renomeadas": [], "trocadas": [], "divididas": [], "fecharam": [], "mudaram": [], "confirmadas_diretorio": [], "novas": []}
    erase = []          # contornos cujo nome antigo sai do desenho
    keep_pois = []
    for p in data["pois"]:
        if (p.get("group") in KEEP_GROUPS or p["id"].startswith("__") or p.get("cat", "").split(" · ")[0] in AREAS
                or re.search(r"food court|colonnade|oasis", p["name"], re.I)):
            keep_pois.append(p); continue
        poly = p.get("poly")
        if poly and len(poly) >= 6:
            inn = [c for c in cur if not c["used"] and inside(c["x"], c["y"], poly)]
            match = [c for c in inn if same(c["name"], p["name"])]
            if match:
                c = match[0]; c["used"] = True
                if c["name"] != p["name"]:
                    report["renomeadas"].append(f'{p["name"]} → {c["name"]}')
                    p["name"] = c["name"]
                    w = web_for(c["name"], c["tags"])
                    if w: p["web"] = w
                keep_pois.append(p); continue
            if len(inn) >= 3:
                report["divididas"].append(f'{p["name"]} → {", ".join(c["name"] for c in inn)}')
                erase.append(p); continue          # as lojas de dentro viram pontos logo abaixo
            if inn:
                cx, cy = centroid(poly)
                c = min(inn, key=lambda c: math.hypot(c["x"] - cx, c["y"] - cy)); c["used"] = True
                report["trocadas"].append(f'{p["name"]} → {c["name"]}')
                grp, cat = classify(c["tags"], c["name"])
                num = re.search(r"loja [\w-]+", p.get("cat", ""))
                p.update(name=c["name"], group=grp, cat=cat + (f" · {num.group(0)}" if num else ""), label=True)
                w = web_for(c["name"], c["tags"])
                if w: p["web"] = w
                else: p.pop("web", None)
                erase.append(p); keep_pois.append(p); continue
        # nenhuma loja do OSM no lugar (ou ponto sem contorno)
        if any(same(c["name"], p["name"]) for c in cur):
            report["mudaram"].append(p["name"])
            if poly: erase.append(p)
            continue
        if any(same(d, p["name"]) for d in directory):
            report["confirmadas_diretorio"].append(p["name"])
            keep_pois.append(p); continue
        report["fecharam"].append(p["name"])
        if poly: erase.append(p)

    # ---- lojas novas (sem contorno): ponto no lugar do OSM, ligado ao corredor mais próximo
    nid = max(int(re.sub(r"\D", "", p["id"]) or 0) for p in data["pois"]) + 1
    for c in cur:
        if c["used"]:
            continue
        grp, cat = classify(c["tags"], c["name"])
        node = c["near"]
        if c["far"]:   # caminho a pé direto até o corredor mais próximo
            node = max(n["id"] for n in data["nodes"]) + 1
            data["nodes"].append({"id": node, "f": "L1", "x": round(c["x"], 1), "y": round(c["y"], 1), "t": "c"})
            data["edges"].append({"a": node, "b": c["near"], "t": "walk"})
        q = {"id": f"p{nid}", "name": c["name"], "f": "L1", "x": round(c["x"], 1), "y": round(c["y"], 1),
             "node": node, "group": grp, "cat": cat}
        w = web_for(c["name"], c["tags"])
        if w: q["web"] = w
        keep_pois.append(q); nid += 1
        report["novas"].append(c["name"])

    data["pois"] = keep_pois
    data["meta"]["source"] = re.sub(r"; lojas atualizadas.*$", "", data["meta"]["source"]) + \
        "; lojas atualizadas com OpenStreetMap e o diretório do malls.com (2026)"
    MALL.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    # marcas novas no registro de sites (logos)
    for p in keep_pois:
        if p.get("web") and p["name"] not in brands:
            brands[p["name"]] = p["web"]
    BRANDS.write_text(json.dumps(brands, ensure_ascii=False, indent=0))

    # ---- apaga do desenho os nomes antigos das lojas que mudaram ou fecharam
    gone = {q["id"] for q in keep_pois}
    for name, (x0, y0, x1, y1) in EXTRA_TEXT.items():
        if not any(q["name"] == name and q["id"] in gone for q in data["pois"]):
            erase.append({"poly": [x0, y0, x1, y0, x1, y1, x0, y1]})
    erased = erase_names(erase)
    report["letras_apagadas"] = erased
    (REPO / "tools" / "update_stores_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    for k, v in report.items():
        print(f"{k}: {len(v) if isinstance(v, list) else v}")


def erase_names(pois):
    SVGNS = "http://www.w3.org/2000/svg"
    ET.register_namespace("", SVGNS)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    tree = ET.parse(SVG)
    root = tree.getroot()
    vb = [float(v) for v in root.get("viewBox").split()]
    ox, oy = vb[0], vb[1]               # ponto (0,0) do app no desenho
    rings = [[(p["poly"][k] + ox, p["poly"][k + 1] + oy) for k in range(0, len(p["poly"]), 2)] for p in pois]
    flat = [[v for xy in r for v in xy] for r in rings]
    boxes = [(min(x for x, _ in r), min(y for _, y in r), max(x for x, _ in r), max(y for _, y in r)) for r in rings]
    TEXT_FILL = ("rgb(7.450867%, 7.058716%, 6.666565%)", "rgb(0%, 0%, 0%)")
    n = 0

    def target(x, y):
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] and inside(x, y, fp) for fp, b in zip(flat, boxes))

    for el in list(root):
        tag = el.tag.split("}")[-1]
        if tag == "g" and el.get("id") != "osm":
            # texto em fonte: grupos de <use> (uma letra cada, x/y = início da letra)
            for u in list(el):
                if u.tag.endswith("use") and u.get("x") is not None and target(float(u.get("x")) + 4, float(u.get("y")) - 4):
                    el.remove(u); n += 1
            if not len(el):
                root.remove(el)
            continue
        if tag != "path" or el.get("fill") not in TEXT_FILL or el.get("stroke"):
            continue
        v = [float(t) for t in re.findall(r"-?\d+\.?\d*(?:e-?\d+)?", el.get("d", ""))]
        if len(v) < 4:
            continue
        xs, ys = v[0::2], v[1::2]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        # letra desenhada: pequena e "quadradinha" (linhas finas que dividem lojas ficam)
        if max(w, h) > 45 or max(w, h) > 8 * max(min(w, h), 0.5):
            continue
        if target((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2):
            root.remove(el); n += 1
    tree.write(SVG, encoding="unicode", xml_declaration=False)
    return n


if __name__ == "__main__":
    main()
