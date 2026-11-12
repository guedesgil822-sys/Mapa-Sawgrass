#!/usr/bin/env python3
"""Gera data/mall.json a partir da planta do Sawgrass Mills.

Uso:
  sh tools/fetch_sources.sh /tmp/raw
  python3 tools/build_data.py /tmp/raw .

A planta não traz dados estruturados (é só uma imagem), então os corredores,
as portas e os contornos abaixo foram traçados à mão sobre ela. As coordenadas
estão em pixels da área recortada da planta original (1920 px de largura,
recorte a partir de y=1280); a saída é ampliada por SCALE.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])
CROP = (0, 1280, 1920, 2430)   # área da planta dentro da imagem do PDF
SCALE = 1.5                    # ampliação da imagem publicada
PX_PER_M = 2.0                 # escala estimada na imagem publicada
FLOOR = "L1"

# ---------------------------------------------------------------------------
# Corredores: cada linha é uma sequência de pontos ligados a pé.
# Pontos com nome (str) são reaproveitados entre linhas.
P = {
    "E1": (180, 330), "P1": (245, 355), "FCJ": (335, 385), "J2": (570, 445),
    "PV": (615, 405), "E2P": (530, 520), "E2": (505, 545), "E2X": (470, 585),
    "JL": (805, 705), "BL": (805, 790), "B930": (930, 795), "BR": (1165, 790),
    "H3": (1200, 735), "TR": (1165, 625), "TN": (1145, 622), "TL": (870, 625),
    "PO": (1235, 340), "OZ": (1305, 205), "G1370": (1370, 812), "J4": (1480, 875),
    "J4E": (1520, 840), "S4": (1475, 960),
}
LINES = [
    # Ala amarela: Entrada 1 → Entrada 2
    ["E1", (215, 335), "P1", (290, 378), "FCJ", (400, 402), (460, 418), (520, 435), "J2"],
    ["P1", (225, 312)],
    ["FCJ", (340, 340), (338, 300), (338, 265)],                 # Praça de alimentação Market
    ["J2", (595, 425), "PV", (625, 378)],                        # praça do VF
    ["J2", (555, 480), "E2P", "E2"],
    # Ala laranja: praça do VF → anel central
    ["PV", (650, 440), (680, 490), (705, 540), (730, 590), (750, 630), (775, 665), "JL"],
    # Anel central (T.J. Maxx no meio)
    ["JL", (805, 760), "BL", "B930", (1050, 790), "BR", (1180, 755), "H3",
     (1190, 690), (1180, 650), "TR", "TN", (1000, 622), "TL", (840, 655), (815, 690), "JL"],
    ["B930", (930, 818)],
    ["BL", (790, 805)],
    ["BR", (1168, 830), (1165, 852)],                            # Entrada 3
    # Ala roxa: The Oasis
    ["TN", (1142, 560), (1140, 520), (1160, 480), (1185, 425), (1205, 375), "PO"],
    ["PO", (1190, 343), (1150, 345)],
    ["PO", (1290, 362), (1355, 385)],
    ["PO", (1260, 290), (1282, 240), "OZ"],
    ["OZ", (1270, 165), (1250, 150)],
    ["OZ", (1340, 140), (1365, 100), (1385, 75)],
    # Ala verde: Entrada 3 → Entrada 4
    ["H3", (1240, 738), (1275, 760), (1320, 785), "G1370", (1420, 838), "J4"],
    ["G1370", (1355, 850), (1340, 880)],                         # Praça de alimentação Garden
    ["J4", "J4E", (1550, 840)],
    ["J4E", (1535, 815)],
    ["J4", (1480, 920), "S4", (1450, 975)],
    ["S4", (1505, 975)],
    # Colonnade Outlets (área externa, pela Entrada 2)
    ["E2", "E2X", (455, 625), (475, 675), (505, 725), (530, 775), (545, 830), (550, 880)],
    ["E2X", (410, 630), (360, 690), (330, 720)],
]

# ---------------------------------------------------------------------------
# Pontos de interesse: nome, grupo, categoria, porta, contorno (opcional),
# e se o nome já aparece impresso na planta (label=False).
ANCHOR = "Lojas âncora"
POIS = [
    # nome, grupo, categoria, porta, contorno, rótulo
    ("Marshalls", "Moda", "Loja de departamento", (215, 300),
     [122, 220, 255, 142, 300, 245, 300, 265, 200, 300], False),
    ("Neiman Marcus Last Call", "Moda", "Loja de departamento", (235, 385),
     [145, 478, 205, 395, 255, 385, 300, 475, 225, 555], False),
    ("Market Food Court", "Alimentação", "Praça de alimentação", (345, 320),
     [325, 290, 375, 290, 370, 365, 330, 365], False),
    ("The Sports Authority", "Esportes", "Artigos esportivos", (455, 405),
     [380, 293, 533, 323, 520, 415, 400, 400, 375, 380], False),
    ("Rainforest Cafe", "Alimentação", "Restaurante", (560, 410),
     [533, 323, 610, 357, 600, 390, 525, 385], False),
    ("VF Factory Outlet", "Moda", "Vestuário", (630, 370),
     [610, 205, 762, 285, 700, 400, 673, 387, 580, 333, 610, 273, 583, 253], False),
    ("Books-A-Million", "Casa", "Livraria", (560, 520),
     [535, 515, 590, 505, 615, 545, 575, 575, 550, 560], False),
    ("Off 5th Saks Fifth Avenue Outlet", "Moda", "Loja de departamento", (695, 565),
     [575, 560, 640, 540, 715, 600, 720, 640, 650, 680, 600, 620], False),
    ("Gap Outlet", "Moda", "Vestuário", (760, 680),
     [650, 690, 720, 650, 760, 700, 700, 760], False),
    ("American Signature Home", "Casa", "Móveis", (900, 612),
     [800, 500, 935, 500, 940, 600, 850, 615, 815, 560], False),
    ("Nike Factory Outlet", "Esportes", "Artigos esportivos", (980, 612),
     [945, 505, 1010, 505, 1010, 600, 945, 600], False),
    ("T.J. Maxx", "Moda", "Loja de departamento", (985, 640),
     [925, 667, 1043, 667, 1043, 722, 925, 722], False),
    ("Wannado City", "Lazer", "Parque infantil", (785, 805),
     [636, 795, 770, 795, 770, 980, 636, 980], False),
    ("Bed Bath & Beyond", "Casa", "Casa e decoração", (930, 830),
     [820, 860, 920, 860, 920, 1010, 820, 1010], False),
    ("Burlington Coat Factory", "Moda", "Loja de departamento", (1190, 620),
     [1150, 530, 1330, 525, 1400, 600, 1330, 690, 1200, 690, 1185, 620], False),
    ("Nordstrom Rack", "Moda", "Loja de departamento", (1215, 395),
     [1235, 355, 1352, 400, 1300, 500, 1185, 490], False),
    ("Regal 23 Cinemas", "Lazer", "Cinema", (1325, 190),
     [1350, 145, 1530, 170, 1505, 250, 1360, 325, 1330, 225], False),
    ("The Oasis", "Alimentação", "Restaurantes e lazer ao ar livre", (1300, 215), None, False),
    ("FYE", "Tecnologia", "Música e filmes", (1230, 765),
     [1180, 775, 1240, 765, 1260, 845, 1190, 860], False),
    ("Garden Food Court", "Alimentação", "Praça de alimentação", (1335, 890), None, False),
    ("Super Target", "Casa", "Hipermercado", (1540, 805),
     [1440, 500, 1640, 560, 1580, 760, 1500, 785, 1390, 717], False),
    ("JCPenney Outlet Store", "Moda", "Loja de departamento", (1450, 985),
     [1320, 990, 1440, 960, 1500, 1060, 1400, 1140, 1310, 1100], False),
    ("BrandsMart USA", "Tecnologia", "Eletrônicos", (1510, 985),
     [1540, 880, 1720, 960, 1700, 1040, 1520, 990], False),
    ("The Colonnade Outlets", "Moda", "Lojas de luxo ao ar livre", (430, 700), None, False),
    # Entradas
    ("Entrada 1", "Entradas", "Entrada", (172, 330), None, False),
    ("Entrada da praça de alimentação", "Entradas", "Entrada", (338, 255), None, False),
    ("Entrada 2", "Entradas", "Entrada", (500, 550), None, False),
    ("Entrada 3", "Entradas", "Entrada", (1165, 860), None, False),
    ("Entrada 4", "Entradas", "Entrada", (1560, 842), None, False),
    ("Entrada Oasis (oeste)", "Entradas", "Entrada", (1142, 345), None, False),
    ("Entrada Oasis (leste)", "Entradas", "Entrada", (1363, 388), None, False),
    ("Entrada Oasis (noroeste)", "Entradas", "Entrada", (1243, 147), None, False),
    ("Entrada Oasis (norte)", "Entradas", "Entrada", (1390, 68), None, False),
    # Banheiros (ícones da planta)
    ("Banheiros · Entrada 1", "Facilidades", "Banheiro", (240, 285), None, False),
    ("Banheiros · Market Food Court", "Facilidades", "Banheiro", (395, 292), None, False),
    ("Banheiros · Entrada 2", "Facilidades", "Banheiro", (553, 495), None, False),
    ("Banheiros · perto da Bed Bath & Beyond", "Facilidades", "Banheiro", (890, 835), None, False),
    ("Banheiros · Nordstrom Rack", "Facilidades", "Banheiro", (1235, 402), None, False),
    ("Banheiros · Burlington", "Facilidades", "Banheiro", (1165, 555), None, False),
    ("Banheiros · Entrada 4", "Facilidades", "Banheiro", (1463, 815), None, False),
    ("Banheiros · Garden Food Court", "Facilidades", "Banheiro", (1290, 900), None, False),
    ("Administração e segurança", "Facilidades", "Administração", (1285, 860), None, False),
]


# ---------------------------------------------------------------------------
def proj(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    q = (a[0] + t * dx, a[1] + t * dy)
    return math.hypot(p[0] - q[0], p[1] - q[1]), t, q


def main():
    nodes, edges, key = [], [], {}

    def node(pt, t="c"):
        k = pt if isinstance(pt, str) else tuple(pt)
        if k in key:
            return key[k]
        x, y = P[pt] if isinstance(pt, str) else pt
        nodes.append({"id": len(nodes), "f": FLOOR, "x": x, "y": y, "t": t})
        key[k] = len(nodes) - 1
        return key[k]

    def link(a, b):
        if a != b and not any({e["a"], e["b"]} == {a, b} for e in edges):
            edges.append({"a": a, "b": b, "t": "walk"})

    for line in LINES:
        ids = [node(p) for p in line]
        for a, b in zip(ids, ids[1:]):
            link(a, b)

    pois = []
    for i, (name, group, cat, door, poly, label) in enumerate(POIS):
        # ponto do corredor mais próximo da porta (divide a aresta se preciso)
        best = None
        for e in edges:
            a, b = nodes[e["a"]], nodes[e["b"]]
            if "door" in (a["t"], b["t"]):
                continue
            d, t, q = proj(door, (a["x"], a["y"]), (b["x"], b["y"]))
            if best is None or d < best[0]:
                best = (d, t, q, e)
        d, t, q, e = best
        a, b = nodes[e["a"]], nodes[e["b"]]
        if math.hypot(q[0] - a["x"], q[1] - a["y"]) < 6:
            cid = a["id"]
        elif math.hypot(q[0] - b["x"], q[1] - b["y"]) < 6:
            cid = b["id"]
        else:
            nodes.append({"id": len(nodes), "f": FLOOR, "x": q[0], "y": q[1], "t": "c"})
            cid = len(nodes) - 1
            edges.remove(e)
            link(e["a"], cid)
            link(cid, e["b"])
        if math.hypot(door[0] - q[0], door[1] - q[1]) < 3:   # porta encostada no corredor
            ang = math.atan2(door[1] - q[1], door[0] - q[0]) if d else 0
            door = (q[0] + 4 * math.cos(ang), q[1] + 4 * math.sin(ang))
        nodes.append({"id": len(nodes), "f": FLOOR, "x": door[0], "y": door[1], "t": "door"})
        did = len(nodes) - 1
        link(did, cid)
        if poly:
            xs, ys = poly[0::2], poly[1::2]
            lx, ly = sum(xs) / len(xs), sum(ys) / len(ys)
        else:
            lx, ly = door
        p = {"id": f"p{i}", "name": name, "f": FLOOR, "x": lx, "y": ly, "node": did,
             "group": group, "cat": cat}
        if poly:
            p["poly"] = poly
        if not label:
            p["label"] = False
        pois.append(p)

    s = lambda v: round(v * SCALE, 1)
    for n in nodes:
        n["x"], n["y"] = s(n["x"]), s(n["y"])
    for p in pois:
        p["x"], p["y"] = s(p["x"]), s(p["y"])
        if "poly" in p:
            p["poly"] = [s(v) for v in p["poly"]]

    src = Image.open(RAW / "map.png").convert("RGB").crop(CROP)
    w, h = round(src.width * SCALE), round(src.height * SCALE)
    # a imagem publicada é o vetor gerado por vectorize.py (maps/l1.svg)

    data = {
        "meta": {"name": "Sawgrass Mills", "schema": 1, "pxPerMeter": PX_PER_M,
                 "source": "Planta do Sawgrass Mills publicada em all-maps.com (PDF para impressão)"},
        "floors": [{"id": FLOOR, "name": "Piso único", "level": 1, "image": "maps/l1.svg",
                    "width": w, "height": h}],
        "nodes": nodes, "edges": edges, "pois": pois,
    }
    (OUT / "data").mkdir(parents=True, exist_ok=True)
    (OUT / "data" / "mall.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(pois)} pontos, {len(nodes)} nós, {len(edges)} arestas, imagem {w}x{h}")


main()
