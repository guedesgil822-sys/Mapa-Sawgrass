#!/usr/bin/env python3
"""Gera data/mall.json e maps/l1.svg a partir da planta oficial em PDF (vetor).

Uso:
  sh tools/fetch_sources.sh /tmp/raw
  python3 tools/build_from_pdf.py /tmp/raw .

Requer: poppler-utils (pdftoppm, pdftotext, pdftocairo), tesseract,
python3 com numpy, scipy, scikit-image, skan e Pillow.

Etapas:
  1. Lista de lojas (texto do PDF): número da loja -> nome e categoria.
  2. Números das lojas na planta: são desenhos, não texto; lidos por OCR
     numa imagem só com as manchas pretas pequenas (os dígitos).
  3. Contorno de cada loja: região colorida limitada pelas linhas pretas.
  4. Corredores: cor bege (internos) e cinza claro (passeios externos),
     reduzidos a um esqueleto e convertidos em nós e arestas.
  5. Porta: ponto do contorno mais próximo de um corredor.
  6. Planta publicada: o próprio vetor do PDF, recortado, sem a lista de lojas
     e sem os números das lojas que ganharam nome no app.

Coordenadas de saída: pontos do PDF, com origem no canto do recorte.
"""
import csv
import html
import json
import math
import re
import subprocess
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure, morphology
from skan import Skeleton, summarize

Image.MAX_IMAGE_PIXELS = None
RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
PDF = RAW / "sawgrassmills.pdf"
X0, Y0, W, H = 80, 2380, 3260, 1870      # recorte da planta (pt)
S = 2.0                                   # px por pt na imagem de análise
PPM = 2.4                                 # pt por metro (estimado)
FLOOR = "L1"
# legendas dentro do recorte (pt da página): lista do Colonnade, ícones, patrocínio
ERASE = [(160, 3600, 690, 4400), (690, 4150, 1330, 4400), (1330, 4180, 2050, 4400)]
UNIT_RX = re.compile(r"^(\d{3,4}[AB]?|R-?[1-9])$")

GROUPS = {
    "Athletic Goods & Apparel": ("Esportes", "Artigos esportivos"),
    "Books - Cards - Gifts": ("Casa", "Livros e presentes"),
    "Children's Shoes & Apparel": ("Infantil", "Roupas e calçados infantis"),
    "Electronics - Music - Photography": ("Tecnologia", "Eletrônicos, música e foto"),
    "Entertainment": ("Lazer", "Entretenimento"),
    "Garden Food Court": ("Alimentação", "Garden Food Court"),
    "Food-Restaurants": ("Alimentação", "Restaurante"),
    "The Market Food Court": ("Alimentação", "Market Food Court"),
    "Footwear - Calzado": ("Calçados", "Calçados"),
    "Hair Styling - Cosmetics": ("Beleza", "Beleza e perfumaria"),
    "Handbags - Luggage": ("Moda", "Bolsas e malas"),
    "Home Furnishings": ("Casa", "Casa e decoração"),
    "Jewelry - Eyewear - Accessories": ("Óticas e joias", "Joias, óculos e acessórios"),
    "Men's Apparel - Ropa de Caballeros": ("Moda", "Moda masculina"),
    "Men's & Women's Apparel": ("Moda", "Moda masculina e feminina"),
    "Miscellaneous Services": ("Serviços", "Serviços"),
    "Specialty Foods/Wine": ("Alimentação", "Doces, cafés e lanches"),
    "Toys - Juguetes": ("Infantil", "Brinquedos"),
    "Women's Apparel": ("Moda", "Moda feminina"),
    "Colonnade": ("Moda", "The Colonnade Outlets (grifes)"),
}

# Âncoras: nome impresso na planta; ponto dentro da loja (pt da página).
ANCHORS = [
    ("Marshalls", "Moda", "Loja de departamento", (380, 2680)),
    ("Neiman Marcus Last Call", "Moda", "Loja de departamento", (400, 3130)),
    ("The Sports Authority", "Esportes", "Artigos esportivos", (815, 2930)),
    ("Rainforest Cafe", "Alimentação", "Restaurante", (1020, 2930)),
    ("VF Factory Outlet", "Moda", "Vestuário", (1200, 2860)),
    ("Books-A-Million", "Casa", "Livraria", (1035, 3215)),
    ("Saks Fifth Avenue OFF 5TH", "Moda", "Loja de departamento", (1150, 3330)),
    ("Gap Outlet", "Moda", "Vestuário", (1260, 3480)),
    ("American Signature Home", "Casa", "Móveis", (1560, 3250)),
    ("Nike Factory Outlet", "Esportes", "Artigos esportivos", (1748, 3297)),
    ("T.J. Maxx", "Moda", "Loja de departamento", (1760, 3450)),
    ("Wannado City", "Lazer", "Parque infantil", (1250, 3880)),
    ("Bed Bath & Beyond", "Casa", "Casa e decoração", (1550, 3950)),
    ("Burlington Coat Factory", "Moda", "Loja de departamento", (2270, 3300)),
    ("Nordstrom Rack", "Moda", "Loja de departamento", (2300, 2980)),
    ("Regal 23 Cinemas", "Lazer", "Cinema", (2550, 2620)),
    ("Ron Jon Surf Shop", "Moda", "Surfwear", (2175, 2765)),
    ("FYE", "Tecnologia", "Música e filmes", (2135, 3770)),
    ("Super Target", "Casa", "Hipermercado", (2735, 3400)),
    ("JCPenney Outlet Store", "Moda", "Loja de departamento", (2500, 4130)),
    ("BrandsMart USA", "Tecnologia", "Eletrônicos", (2900, 3990)),
    ("Beall's Outlet", "Moda", "Loja de departamento", (2525, 3880)),
    ("GameWorks", "Lazer", "Jogos e diversão", (2290, 2515)),
    ("Off Broadway Shoe Warehouse", "Calçados", "Calçados", (2205, 3085)),
    ("Polo Ralph Lauren Factory Store", "Moda", "Moda masculina e feminina", (2190, 3165)),
]
# Pontos sem contorno (pt da página): entradas, praças, banheiros.
PLACES = [
    ("Entrada 1", "Entradas", "Entrada", (305, 2870)),
    ("Entrada da praça de alimentação", "Entradas", "Entrada", (602, 2734)),
    ("Entrada 2", "Entradas", "Entrada", (890, 3250)),
    ("Entrada 3", "Entradas", "Entrada", (2075, 3800)),
    ("Entrada 4", "Entradas", "Entrada", (2780, 3780)),
    ("Entrada sudeste (JCPenney / BrandsMart)", "Entradas", "Entrada", (2720, 4000)),
    ("Entrada Oasis (oeste)", "Entradas", "Entrada", (2035, 2895)),
    ("Entrada Oasis (leste)", "Entradas", "Entrada", (2430, 2970)),
    ("Entrada Oasis (noroeste)", "Entradas", "Entrada", (2215, 2545)),
    ("Entrada Oasis (norte)", "Entradas", "Entrada", (2475, 2420)),
    ("Market Food Court", "Alimentação", "Praça de alimentação", (615, 2860)),
    ("Garden Food Court", "Alimentação", "Praça de alimentação", (2385, 3860)),
    ("The Oasis", "Alimentação", "Restaurantes e lazer ao ar livre", (2325, 2650)),
    ("The Colonnade Outlets", "Moda", "Grifes ao ar livre", (765, 3530)),
    ("Banheiros · Entrada 1", "Facilidades", "Banheiro", (425, 2785)),
    ("Banheiros · Market Food Court", "Facilidades", "Banheiro", (705, 2795)),
    ("Banheiros · Entrada 2", "Facilidades", "Banheiro", (985, 3160)),
    ("Banheiros · Entrada 3", "Facilidades", "Banheiro", (1585, 3770)),   # antes "· Bed Bath & Beyond" (fechou)
    ("Banheiros · Nordstrom Rack", "Facilidades", "Banheiro", (2200, 2995)),
    ("Banheiros · Burlington", "Facilidades", "Banheiro", (2075, 3270)),
    ("Banheiros · Entrada 4", "Facilidades", "Banheiro", (2605, 3730)),
    ("Banheiros · Garden Food Court", "Facilidades", "Banheiro", (2300, 3895)),
    ("Atendimento ao cliente", "Facilidades", "Atendimento e cartões-presente", (1010, 3185)),
    ("Administração e segurança", "Facilidades", "Administração", (2290, 3830)),
]


# Estacionamentos: a planta não os desenha; ficam do lado de fora de cada
# entrada. (nome, ponto do estacionamento, ponto da entrada), em pt da página.
PARKING = [
    ("Estacionamento · Entrada 1", (165, 2880), (305, 2870)),
    ("Estacionamento · Praça de alimentação", (600, 2650), (602, 2734)),
    ("Estacionamento · Entrada 2", (985, 3330), (890, 3250)),
    ("Estacionamento · Entrada 3", (2075, 3905), (2075, 3800)),
    ("Estacionamento · Entrada 4", (2905, 3765), (2780, 3780)),
    ("Estacionamento · JCPenney / BrandsMart", (2790, 4075), (2720, 4000)),
    ("Estacionamento · Oasis (oeste)", (1935, 2895), (2035, 2895)),
    ("Estacionamento · Oasis (leste)", (2530, 3000), (2430, 2970)),
    ("Estacionamento · Oasis (noroeste)", (2120, 2545), (2215, 2545)),
    ("Estacionamento · Oasis (norte)", (2570, 2405), (2475, 2420)),
]


def run(*a):
    subprocess.run(a, check=True, capture_output=True)


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


# ------------------------------------------------------------------ 1. lista
def directory(tmp):
    run("pdftotext", "-bbox", str(PDF), str(tmp / "words.html"))
    words = [(float(a), float(b), float(c), float(d), html.unescape(t)) for a, b, c, d, t in re.findall(
        r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>',
        (tmp / "words.html").read_text())]
    words.sort(key=lambda w: (round(w[1]), w[0]))
    lines = []
    for w in words:
        for L in lines:
            if abs(L["y"] - w[1]) < 2 and 0 <= w[0] - L["x1"] < 70:
                L["w"].append(w); L["x1"] = w[2]; break
        else:
            lines.append({"y": w[1], "x0": w[0], "x1": w[2], "w": [w], "h": w[3] - w[1]})
    for L in lines:
        L["t"] = " ".join(w[4] for w in L["w"])
    lines.sort(key=lambda L: (L["x0"] // 300, L["y"]))
    units = defaultdict(list)
    head, prev_head = None, False
    for L in lines:
        if L["y"] > 3600 and L["x0"] < 700:
            head = "Colonnade"
        elif L["y"] > 2400:
            continue
        elif L["h"] > 30:
            if not prev_head:
                head = L["t"]
            prev_head = True
            continue
        prev_head = False
        tok = L["t"].split(" ", 1)
        if len(tok) < 2 or not UNIT_RX.match(tok[0]) or head not in GROUPS:
            continue
        unit = tok[0].replace("R", "R-").replace("--", "-") if tok[0].startswith("R") else tok[0]
        name = tok[1].strip()
        if not any(norm(name).split()[:2] == norm(n).split()[:2] for n, _ in units[unit]):
            units[unit].append((name, head))
    return units


# ------------------------------------------------------------------ 2. OCR
def render3x(tmp):
    run("pdftoppm", "-r", "216", "-png", "-singlefile", "-x", str(X0 * 3), "-y", str(Y0 * 3),
        "-W", str(W * 3), "-H", str(H * 3), str(PDF), str(tmp / "ocr"))


def tess(img, tmp, psm):
    Image.fromarray(img).save(tmp / "r.png")
    out = subprocess.run(["tesseract", str(tmp / "r.png"), "stdout", "--psm", str(psm), "-c",
                          "tessedit_char_whitelist=0123456789ABR-", "tsv"], capture_output=True, text=True).stdout
    rows = [r for r in csv.DictReader(out.splitlines(), delimiter="\t", quoting=3)
            if (r.get("text") or "").strip() and float(r["conf"]) >= 0]
    if not rows:
        return "", 0
    return "".join(r["text"].strip() for r in rows), min(float(r["conf"]) for r in rows)


def unit_norm(t):
    return t.replace("R", "R-").replace("--", "-") if t.startswith("R") else t


def ocr_regions(lab, tmp):
    """Lê o número dentro de cada loja: recorta só o interior da região."""
    g = np.array(Image.open(tmp / "ocr.png").convert("L"))
    f = 3 / S
    res = []
    for c, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        m = lab[sl] == c
        area = m.sum() / (S * S)
        if area < 25 or area > 20000:
            continue
        m = ndimage.binary_fill_holes(m)
        hh, ww = int(m.shape[0] * f), int(m.shape[1] * f)
        mm = np.array(Image.fromarray(m.astype("uint8") * 255).resize((ww, hh), Image.NEAREST)) > 0
        mm = ndimage.binary_erosion(mm, iterations=3)
        crop = g[int(sl[0].start * f):int(sl[0].start * f) + hh, int(sl[1].start * f):int(sl[1].start * f) + ww]
        mm = mm[:crop.shape[0], :crop.shape[1]]
        img = np.where(mm & (crop < 110), 0, 255).astype("uint8")
        ys, xs = np.nonzero(img == 0)
        if len(ys) < 15:
            continue
        img = np.pad(img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 14, constant_values=255)
        best = ("", 0)
        for k in (0, 1, 3):
            t, conf = tess(np.ascontiguousarray(np.rot90(img, k)), tmp, 7)
            if UNIT_RX.match(t) and conf > best[1]:
                best = (t, conf)
        if best[1] <= 40:
            best = ocr_zoom(lab, c, sl, tmp)
        if best[1] > 40:
            yy, xx = np.nonzero(lab[sl] == c)
            k = len(yy) // 2
            res.append((unit_norm(best[0]), (sl[1].start + xx[k]) / S, (sl[0].start + yy[k]) / S, best[1]))
    return res


def ocr_zoom(lab, c, sl, tmp, z=5):
    """Segunda tentativa: recorte ampliado 5x e ângulos inclinados."""
    x0, y0 = X0 + sl[1].start / S, Y0 + sl[0].start / S
    w, h = (sl[1].stop - sl[1].start) / S, (sl[0].stop - sl[0].start) / S
    run("pdftoppm", "-r", str(72 * z), "-gray", "-png", "-singlefile", "-x", str(int(x0 * z)), "-y", str(int(y0 * z)),
        "-W", str(int(w * z) + 1), "-H", str(int(h * z) + 1), str(PDF), str(tmp / "z"))
    g = np.array(Image.open(tmp / "z.png").convert("L"))
    m = ndimage.binary_fill_holes(lab[sl] == c)
    mm = np.array(Image.fromarray(m.astype("uint8") * 255).resize((g.shape[1], g.shape[0]), Image.NEAREST)) > 0
    mm = ndimage.binary_erosion(mm, iterations=5)
    img = np.where(mm & (g < 110), 0, 255).astype("uint8")
    ys, xs = np.nonzero(img == 0)
    if len(ys) < 30:
        return ("", 0)
    img = np.pad(img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 30, constant_values=255)
    best = ("", 0)
    for ang in (0, 90, -90, 30, -30, 60, -60):
        im = Image.fromarray(img).rotate(ang, expand=True, fillcolor=255)
        for psm in (7, 8):
            t, conf = tess(np.array(im), tmp, psm)
            if UNIT_RX.match(t) and conf > best[1]:
                best = (t, conf)
    return best


def ocr_units(tmp):
    g = np.array(Image.open(tmp / "ocr.png").convert("L"))
    blk = g < 90
    lab, n = ndimage.label(blk)
    keep = np.zeros(n + 1, bool)
    for i, s in enumerate(ndimage.find_objects(lab), 1):
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        keep[i] = (8 <= h <= 34 and w <= 30) or (8 <= w <= 34 and h <= 30)
    clean = np.where(keep[lab], 0, 255).astype("uint8")
    found = []
    Hh, Ww = clean.shape
    for k in (0, 1, 3):
        img = np.rot90(clean, k)
        Image.fromarray(img).save(tmp / "g.png")
        subprocess.run(["tesseract", str(tmp / "g.png"), str(tmp / "g"), "--psm", "11", "-c",
                        "tessedit_char_whitelist=0123456789ABR-", "tsv"], check=True, capture_output=True)
        for row in csv.DictReader(open(tmp / "g.tsv"), delimiter="\t", quoting=3):
            t = (row.get("text") or "").strip()
            if not t or float(row["conf"]) < 60 or not UNIT_RX.match(t):
                continue
            cx = int(row["left"]) + int(row["width"]) / 2
            cy = int(row["top"]) + int(row["height"]) / 2
            if k == 1:
                cx, cy = Ww - 1 - cy, cx
            elif k == 3:
                cx, cy = cy, Hh - 1 - cx
            t = t.replace("R", "R-").replace("--", "-") if t.startswith("R") else t
            found.append((t, cx / 3, cy / 3, float(row["conf"])))
    # um ponto por número (a leitura girada às vezes repete a horizontal)
    out = {}
    for t, x, y, c in sorted(found, key=lambda f: -f[3]):
        if not any(t == u and math.hypot(x - a, y - b) < 15 for u, (a, b) in out.items()):
            out.setdefault(t, (x, y))
    return out


# ------------------------------------------------------------------ 3/4. imagem
def analyse(tmp):
    r = int(72 * S)
    run("pdftoppm", "-r", str(r), "-png", "-singlefile", "-x", str(int(X0 * S)), "-y", str(int(Y0 * S)),
        "-W", str(int(W * S)), "-H", str(int(H * S)), str(PDF), str(tmp / "seg"))
    a = np.array(Image.open(tmp / "seg.png").convert("RGB")).astype(int)
    lum = a.mean(2)
    black = a.max(2) < 125   # escuro nos três canais (o verde e o vermelho da planta não contam)
    bl, n = ndimage.label(black)
    small = np.zeros(n + 1, bool)
    for i, s in enumerate(ndimage.find_objects(bl), 1):
        small[i] = (s[0].stop - s[0].start) <= 12 * S and (s[1].stop - s[1].start) <= 12 * S
    lines = black & ~small[bl]
    bg = (a.min(2) > 240)
    beige = np.abs(a - [240, 224, 192]).sum(2) < 40
    gray = np.abs(a - [232, 232, 224]).sum(2) < 16
    corr = beige | gray
    for x0, y0, x1, y1 in ERASE:
        sl = np.s_[max(0, int((y0 - Y0) * S)):int((y1 - Y0) * S), max(0, int((x0 - X0) * S)):int((x1 - X0) * S)]
        corr[sl] = False
    store = ~(lines | bg | corr)
    lab, _ = ndimage.label(store)
    # corredores: tapa ícones e textos dentro deles, tira restos pequenos
    cm = morphology.remove_small_holes(ndimage.binary_closing(corr, iterations=2), max_size=4000)
    cm = morphology.remove_small_objects(ndimage.binary_opening(cm, iterations=2), max_size=3000)
    return lab, cm


def corridor_graph(cm):
    sk = morphology.skeletonize(cm)
    for _ in range(4):   # poda de ramos curtos que terminam no nada
        skel = Skeleton(sk)
        sm = summarize(skel, separator="_")
        cut = sm[(sm["branch_type"] == 1) & (sm["branch_distance"] < 30)].index
        if not len(cut):
            break
        paths = skel.paths_list()
        for i in cut:
            for j in paths[i]:
                if skel.degrees[j] <= 2:
                    y, x = skel.coordinates[j].astype(int)
                    sk[y, x] = False
        sk = morphology.skeletonize(sk)
    skel = Skeleton(sk)
    nodes, key, edges = [], {}, set()

    def nid(p):
        for (kx, ky), i in key.items():
            if abs(kx - p[0]) <= 4 and abs(ky - p[1]) <= 4:
                return i
        key[(p[0], p[1])] = len(nodes)
        nodes.append((p[1] / S, p[0] / S))
        return len(nodes) - 1

    for i in range(skel.n_paths):
        pts = skel.path_coordinates(i)
        if len(pts) < 2:
            continue
        simp = measure.approximate_polygon(pts.astype(float), 2.0)
        ids = [nid(tuple(simp[0]))]
        for p in simp[1:-1]:
            nodes.append((p[1] / S, p[0] / S)); ids.append(len(nodes) - 1)
        ids.append(nid(tuple(simp[-1])))
        for u, v in zip(ids, ids[1:]):
            if u != v:
                edges.add((min(u, v), max(u, v)))
    return nodes, sorted(edges)


def poly_of(mask):
    m = ndimage.binary_fill_holes(ndimage.binary_closing(mask, iterations=2))
    cs = measure.find_contours(np.pad(m, 1).astype(float), 0.5)
    if not cs:
        return None
    c = measure.approximate_polygon(max(cs, key=len), 1.0)
    return [round(v, 1) for y, x in c[:-1] for v in ((x - 1) / S, (y - 1) / S)]


def comp_at(lab, x, y, r=8):
    r = int(r * S)
    px, py = int(x * S), int(y * S)
    h, w = lab.shape
    if 0 <= py < h and 0 <= px < w and lab[py, px]:
        return lab[py, px]
    win = lab[max(0, py - r):py + r, max(0, px - r):px + r]
    v = win[win > 0]
    return Counter(v.tolist()).most_common(1)[0][0] if v.size else 0


# ------------------------------------------------------------------ 6. SVG
def inside(p, ring):
    c = False
    for i, a in enumerate(ring):
        b = ring[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def base_svg(named_polys):
    import xml.etree.ElementTree as ET
    SVGNS, XL = "http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"
    ET.register_namespace("", SVGNS)
    ET.register_namespace("xlink", XL)
    tmp_svg = OUT / "maps" / ".full.svg"
    run("pdftocairo", "-svg", str(PDF), str(tmp_svg))
    root = ET.parse(tmp_svg).getroot()
    tmp_svg.unlink()
    rings = [[(p[k] + X0, p[k + 1] + Y0) for k in range(0, len(p), 2)] for p in named_polys]
    boxes = [(min(x for x, _ in r), min(y for _, y in r), max(x for x, _ in r), max(y for _, y in r)) for r in rings]

    def bbox(el):
        xs, ys = [], []
        for e in el.iter():
            m = re.search(r"matrix\(([^)]*)\)", e.get("transform", ""))
            if m:
                t = [float(v) for v in m.group(1).split(",")]
                xs.append(t[4]); ys.append(t[5])
            if e.get("d"):
                v = [float(n) for n in re.findall(r"-?\d+\.?\d*(?:e-?\d+)?", e.get("d"))]
                if e.tag.endswith("path") and not e.get("id"):
                    xs += v[0::2]; ys += v[1::2]
            if e.tag.endswith("use") and e.get("x") is not None:
                xs.append(float(e.get("x"))); ys.append(float(e.get("y")))
        return (min(xs), min(ys), max(xs), max(ys)) if xs else None

    dropped = 0
    for el in list(root):
        if el.tag.endswith("defs"):
            continue
        bb = bbox(el)
        if bb is None:
            continue
        bx0, by0, bx1, by1 = bb
        if bx1 - bx0 > 3300 and by1 - by0 > 4000:   # moldura da página do PDF
            root.remove(el); continue
        if bx1 < X0 or bx0 > X0 + W or by1 < Y0 or by0 > Y0 + H:
            root.remove(el); continue
        cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in ERASE):
            root.remove(el); continue
        if (el.tag.endswith("path") and el.get("fill") == "rgb(0%, 0%, 0%)" and not el.get("stroke")
                and bx1 - bx0 < 16 and by1 - by0 < 16
                and any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] and inside((cx, cy), r) for r, b in zip(rings, boxes))):
            root.remove(el); dropped += 1   # número de loja que ganhou nome no app
    root.set("width", str(W)); root.set("height", str(H)); root.set("viewBox", f"{X0} {Y0} {W} {H}")
    bg = ET.Element(f"{{{SVGNS}}}rect", {"x": str(X0), "y": str(Y0), "width": str(W), "height": str(H), "fill": "#fff"})
    root.insert(1, bg)
    ET.ElementTree(root).write(OUT / "maps" / "l1.svg", encoding="unicode", xml_declaration=False)
    return (OUT / "maps" / "l1.svg").stat().st_size // 1024, dropped


# ------------------------------------------------------------------ main
def proj(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    q = (a[0] + t * dx, a[1] + t * dy)
    return math.hypot(p[0] - q[0], p[1] - q[1]), q


def main():
    tmp = Path(tempfile.mkdtemp())
    units = directory(tmp)
    render3x(tmp)
    lab, cm = analyse(tmp)
    # números das lojas: leitura por loja (principal) + leitura geral (reserva).
    # Guardados em cache na pasta raw, porque o OCR é lento.
    cache = RAW / "ocr_cache.json"
    if cache.exists():
        c = json.loads(cache.read_text())
        regional, general = c["regional"], {k: tuple(v) for k, v in c["general"].items()}
    else:
        regional, general = ocr_regions(lab, tmp), ocr_units(tmp)
        cache.write_text(json.dumps({"regional": regional, "general": general}))
    def in_legend(x, y):
        return any(x0 <= x + X0 <= x1 and y0 <= y + Y0 <= y1 for x0, y0, x1, y1 in ERASE)

    found = {}
    for t, x, y, conf in sorted(regional, key=lambda r: -r[3]):
        if not in_legend(x, y):
            found.setdefault(t, (x, y))
    for t, (x, y) in general.items():
        if not in_legend(x, y):
            found.setdefault(t, (x, y))
    cnodes, cedges = corridor_graph(cm)
    print(f"lista: {len(units)} números; OCR: {len(found)} números; corredores: {len(cnodes)} nós")

    nodes = [{"id": i, "f": FLOOR, "x": round(x, 1), "y": round(y, 1), "t": "c"} for i, (x, y) in enumerate(cnodes)]
    edges = [{"a": a, "b": b, "t": "walk"} for a, b in cedges]
    # redes de corredores separadas por uma linha (portas, limites de ala):
    # liga cada rede à principal pelo par de nós mais próximo, se estiver perto
    def components():
        adj = defaultdict(set)
        for e in edges:
            adj[e["a"]].add(e["b"]); adj[e["b"]].add(e["a"])
        seen, comps = set(), []
        for s0 in adj:
            if s0 in seen:
                continue
            comp, st = set(), [s0]
            while st:
                u = st.pop()
                if u not in comp:
                    comp.add(u); st.extend(adj[u])
            seen |= comp
            comps.append(comp)
        return sorted(comps, key=len, reverse=True)

    while True:
        comps = components()
        main_c, linked = comps[0], False
        for comp in comps[1:]:
            if len(comp) < 3:
                continue
            d, u, v = min((math.hypot(nodes[u]["x"] - nodes[v]["x"], nodes[u]["y"] - nodes[v]["y"]), u, v)
                          for u in comp for v in main_c)
            if d < 90:
                edges.append({"a": u, "b": v, "t": "walk"}); linked = True
                break
        if not linked:
            break
    keep_n = components()[0]
    edges = [e for e in edges if e["a"] in keep_n]

    def attach(pt):
        """Liga um ponto ao corredor mais próximo; devolve o nó do corredor."""
        bd, be, bq = 1e9, None, None
        for e in edges:
            a, b = nodes[e["a"]], nodes[e["b"]]
            if "door" in (a["t"], b["t"]):
                continue
            d, q = proj(pt, (a["x"], a["y"]), (b["x"], b["y"]))
            if d < bd:
                bd, be, bq = d, e, q
        a, b = nodes[be["a"]], nodes[be["b"]]
        for n in (a, b):
            if math.hypot(n["x"] - bq[0], n["y"] - bq[1]) < 4:
                return n["id"]
        nodes.append({"id": len(nodes), "f": FLOOR, "x": round(bq[0], 1), "y": round(bq[1], 1), "t": "c"})
        c = len(nodes) - 1
        edges.remove(be)
        edges.extend([{"a": be["a"], "b": c, "t": "walk"}, {"a": c, "b": be["b"], "t": "walk"}])
        return c

    dist = ndimage.distance_transform_edt(~cm)

    def door_of(comp_mask):
        edge = comp_mask & ~ndimage.binary_erosion(comp_mask)
        ys, xs = np.nonzero(edge)
        k = np.argmin(dist[ys, xs])
        return xs[k] / S, ys[k] / S

    pois, named_polys, used = [], [], {}

    def add(name, group, cat, pt, poly, label, door=None):
        door = door or pt
        cid = attach(door)
        c = nodes[cid]
        if math.hypot(door[0] - c["x"], door[1] - c["y"]) < 2:
            door = (c["x"] + 2, c["y"])
        nodes.append({"id": len(nodes), "f": FLOOR, "x": round(door[0], 1), "y": round(door[1], 1), "t": "door"})
        edges.append({"a": len(nodes) - 1, "b": cid, "t": "walk"})
        p = {"id": f"p{len(pois)}", "name": name, "f": FLOOR, "x": round(pt[0], 1), "y": round(pt[1], 1),
             "node": len(nodes) - 1, "group": group, "cat": cat}
        if poly:
            p["poly"] = poly
        if not label:
            p["label"] = False
        pois.append(p)
        return p

    # âncoras
    for name, group, cat, (px, py) in ANCHORS:
        x, y = px - X0, py - Y0
        c = comp_at(lab, x, y, 25)
        poly = poly_of(lab == c) if c else None
        door = door_of(lab == c) if c else None
        if c:
            used[c] = name
        else:
            print("âncora sem contorno:", name)
        add(name, group, cat, (x, y), poly, False, door)
    # lojas numeradas
    missing = []
    anchor_names = {norm(a[0]).split()[0] for a in ANCHORS}
    for unit, names in sorted(units.items()):
        names = [(n, h) for n, h in names if not (norm(n).split()[0] in anchor_names and len(names) == 1
                                                  and any(norm(n)[:8] == norm(a[0])[:8] for a in ANCHORS))]
        if not names:
            continue
        if unit not in found:
            missing.append(unit); continue
        x, y = found[unit]
        c = comp_at(lab, x, y)
        m = lab == c if c else None
        if not c or c in used or m.sum() > 20000 * S * S:
            # loja fundida com a vizinha na imagem: entra como ponto, sem contorno
            for k, (name, head) in enumerate(names):
                group, cat = GROUPS[head]
                add(name, group, cat + f" · loja {unit}", (x, y), None, k == 0)
            continue
        used[c] = unit
        poly = poly_of(m)
        door = door_of(m)
        if poly:
            xs, ys = poly[0::2], poly[1::2]
            pt = (sum(xs) / len(xs), sum(ys) / len(ys))
        else:
            pt = (x, y)
        for k, (name, head) in enumerate(names):
            group, cat = GROUPS[head]
            add(f"{name}", group, cat + f" · loja {unit}", pt, poly, k == 0, door)
        if poly:
            named_polys.append(poly)
    for name, group, cat, (px, py) in PLACES:
        add(name, group, cat, (px - X0, py - Y0), None, False)
    # estacionamentos: caminho a pé lá fora, da entrada até o estacionamento
    for name, (px, py), (ex, ey) in PARKING:
        cid = attach((ex - X0, ey - Y0))
        nodes.append({"id": len(nodes), "f": FLOOR, "x": ex - X0, "y": ey - Y0, "t": "c"})
        gate = len(nodes) - 1
        edges.append({"a": cid, "b": gate, "t": "walk"})
        nodes.append({"id": len(nodes), "f": FLOOR, "x": px - X0, "y": py - Y0, "t": "door"})
        edges.append({"a": gate, "b": len(nodes) - 1, "t": "walk"})
        pois.append({"id": f"p{len(pois)}", "name": name, "f": FLOOR, "x": px - X0, "y": py - Y0,
                     "node": len(nodes) - 1, "group": "Estacionamento", "cat": "Estacionamento"})

    # numeração final dos nós/arestas usados
    alive = {e["a"] for e in edges} | {e["b"] for e in edges}
    remap = {}
    for n in nodes:
        if n["id"] in alive:
            remap[n["id"]] = len(remap)
    nodes = [dict(n, id=remap[n["id"]]) for n in nodes if n["id"] in remap]
    edges = [dict(e, a=remap[e["a"]], b=remap[e["b"]]) for e in edges]
    for p in pois:
        p["node"] = remap[p["node"]]

    (OUT / "maps").mkdir(parents=True, exist_ok=True)
    kb, dropped = base_svg(named_polys)
    data = {
        "meta": {"name": "Sawgrass Mills", "schema": 1, "pxPerMeter": PPM,
                 "source": "Planta oficial em PDF (simon.com, 'Sawgrass Mills - same map for all locations - 4/07')"},
        "floors": [{"id": FLOOR, "name": "Piso único", "level": 1, "image": "maps/l1.svg", "width": W, "height": H}],
        "nodes": nodes, "edges": edges, "pois": pois,
    }
    (OUT / "data").mkdir(parents=True, exist_ok=True)
    (OUT / "data" / "mall.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(pois)} pontos, {len(nodes)} nós, {len(edges)} arestas; planta {kb} KB "
          f"({dropped} números removidos); sem posição: {len(missing)} -> {' '.join(missing)}")


main()
