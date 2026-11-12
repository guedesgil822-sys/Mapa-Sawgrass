#!/usr/bin/env python3
"""Converte a planta (imagem) em vetor: maps/l1.svg.

A planta original é uma imagem pequena e borrada; ampliada no celular, vira
borrão. Aqui cada pixel é classificado numa das cores lisas da planta, as
manchas de cor viram polígonos, as linhas escuras (divisas de lojas) viram
traços, e os textos borrados são apagados e reescritos como texto SVG nítido
(nomes das âncoras, entradas, banheiros).

Uso: python3 tools/vectorize.py <pasta_raw> .   (depois de build_data.py)
Requer numpy, scipy e scikit-image.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import measure, morphology

RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
CROP = (0, 1280, 1920, 2430)
SCALE = 1.5

# Cores lisas da planta (amostradas da imagem) e a cor final no SVG.
FILLS = [
    ("bg", (255, 255, 255), None),
    ("corr", (240, 231, 195), "#f3ecd2"),
    ("yellow", (238, 198, 30), "#f2c73a"),
    ("orange", (232, 162, 115), "#eeab7c"),
    ("red", (230, 103, 62), "#e9724a"),
    ("purple", (180, 162, 192), "#bcaad0"),
    ("blue", (67, 156, 193), "#4ea3cc"),
    ("green", (121, 181, 112), "#86bf7c"),
    ("gray", (160, 160, 170), "#b2b2bc"),
]
LINE = "#5b4632"

# Áreas a apagar (coordenadas da planta recortada): lista de lojas, logos,
# legenda e patrocinadores; ficam só os prédios.
ERASE = [(0, 0, 1920, 40), (0, 730, 330, 1150), (40, 640, 190, 730),
         (370, 1040, 1300, 1150), (1000, 140, 1215, 245), (290, 165, 385, 248)]

# Rótulos desenhados no SVG (coordenadas da planta recortada).
LABELS = [
    # texto, x, y, tamanho, rotação
    ("MARSHALLS", 210, 225, 15, -32), ("NEIMAN MARCUS", 222, 455, 11, 0), ("LAST CALL", 222, 470, 11, 0),
    ("THE SPORTS", 455, 362, 12, 12), ("AUTHORITY", 455, 377, 12, 12),
    ("RAINFOREST", 568, 362, 8.5, 18), ("CAFE", 568, 373, 8.5, 18),
    ("VF FACTORY", 672, 300, 13, 0), ("OUTLET", 672, 316, 13, 0),
    ("BOOKS-A-", 578, 537, 7.5, 0), ("MILLION", 578, 546, 7.5, 0),
    ("OFF 5TH", 650, 592, 9, 0), ("SAKS FIFTH", 650, 603, 9, 0), ("AVENUE", 650, 614, 9, 0), ("OUTLET", 650, 625, 9, 0),
    ("GAP", 703, 693, 11, 0), ("OUTLET", 703, 707, 11, 0),
    ("AMERICAN", 875, 538, 11, 0), ("SIGNATURE", 875, 552, 11, 0), ("HOME", 875, 566, 11, 0),
    ("NIKE", 978, 545, 9, 0), ("FACTORY", 978, 556, 9, 0), ("OUTLET", 978, 567, 9, 0),
    ("T.J. MAXX", 985, 699, 13, 0),
    ("WANNADO", 703, 885, 12, 0), ("CITY", 703, 900, 12, 0),
    ("BED BATH &", 870, 938, 10, 0), ("BEYOND", 870, 951, 10, 0),
    ("BURLINGTON", 1275, 612, 13, 0), ("COAT FACTORY", 1275, 628, 13, 0),
    ("NORDSTROM", 1290, 418, 9, 0), ("RACK", 1290, 429, 9, 0),
    ("REGAL 23", 1430, 216, 13, 0), ("CINEMAS", 1430, 232, 13, 0),
    ("THE", 1300, 185, 9, 0), ("OASIS", 1300, 196, 9, 0),
    ("FYE", 1214, 812, 11, 0),
    ("SUPER", 1525, 636, 13, 0), ("TARGET", 1525, 652, 13, 0),
    ("JCPENNEY", 1405, 1050, 12, 0), ("OUTLET STORE", 1405, 1065, 12, 0),
    ("BRANDSMART", 1625, 960, 12, 0), ("USA", 1625, 975, 12, 0),
    ("MARKET", 350, 322, 6, 0), ("FOOD COURT", 350, 330, 6, 0),
    ("GARDEN", 1345, 902, 6, 0), ("FOOD COURT", 1345, 910, 6, 0),
    ("THE COLONNADE", 400, 770, 11, 0), ("OUTLETS", 400, 784, 11, 0),
]
ENTRIES = [("1", 150, 330), ("2", 490, 565), ("3", 1165, 885), ("4", 1590, 842),
           ("", 338, 245), ("", 1130, 345), ("", 1375, 392), ("", 1232, 140), ("", 1395, 58)]


# Tons escuros de cada cor = divisas entre lojas.
DARK = [(164, 101, 58), (125, 90, 52), (80, 62, 40), (100, 82, 112), (66, 48, 72),
        (60, 104, 50), (50, 82, 48), (40, 95, 125), (56, 112, 135), (150, 120, 25), (120, 95, 20)]


def classify(a):
    lum = a.mean(2)
    text = ndimage.binary_dilation(lum < 62, iterations=3)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    icon = (r > 170) & (g < 80) & (b < 90)                # ícones vermelhos
    icon |= (r > 200) & (g > 110) & (g < 190) & (b < 90)  # ícones laranja (restaurantes)
    icon = ndimage.binary_closing(icon, iterations=3)
    icon = ndimage.binary_fill_holes(icon)
    icon = ndimage.binary_dilation(icon, iterations=3)
    pal = np.array([c for _, c, _ in FILLS] + DARK, float)
    d = ((a[..., None, :] - pal[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1)
    nf = len(FILLS)
    line = (lab >= nf) & ~text & ~icon
    line = morphology.remove_small_objects(line, max_size=10)
    bad = text | icon | (lab >= nf)
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    lab = lab[idx[0], idx[1]]
    lab[lab >= nf] = 0
    onehot = np.stack([ndimage.uniform_filter((lab == i).astype(float), 5) for i in range(nf)])
    lab = onehot.argmax(0)
    # só prédios: componentes grandes (ou blocos do Colonnade, vermelhos)
    solid = ndimage.binary_closing(lab > 0, iterations=2)
    cl, n = ndimage.label(solid)
    size = ndimage.sum(solid, cl, range(1, n + 1))
    red = ndimage.sum(lab == 4, cl, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = (size > 8000) | ((red > 0.6 * size) & (size > 400))
    lab[~keep[cl]] = 0
    line &= ndimage.binary_dilation(keep[cl], iterations=2)
    return lab, line


def path_of(mask, tol=0.6):
    mask = np.pad(mask, 1)
    parts = []
    for c in measure.find_contours(mask.astype(float), 0.5):
        if len(c) < 8:
            continue
        c = measure.approximate_polygon(c, tol)
        pts = [(round((x - 1) * SCALE, 1), round((y - 1) * SCALE, 1)) for y, x in c]
        parts.append("M" + "L".join(f"{x} {y}" for x, y in pts) + "Z")
    return "".join(parts)


def main():
    a = np.array(Image.open(RAW / "map.png").convert("RGB").crop(CROP)).astype(float)
    for x0, y0, x1, y1 in ERASE:
        a[y0:y1, x0:x1] = 255
    lab, line = classify(a)
    h, w = lab.shape
    W, H = round(w * SCALE), round(h * SCALE)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
           f'<rect width="{W}" height="{H}" fill="#ffffff"/>']
    data = json.loads((OUT / "data" / "mall.json").read_text())
    nodes = {n["id"]: n for n in data["nodes"]}
    # 1) contorno dos prédios, pintado pela cor da ala mais próxima
    solid = morphology.remove_small_holes(ndimage.binary_closing(lab > 0, iterations=3), max_size=400)
    wing = np.zeros_like(solid)
    for i in range(2, 8):   # só manchas grandes de cada cor; o resto é borda borrada
        wing |= morphology.remove_small_objects(ndimage.binary_opening(lab == i, morphology.disk(2)), max_size=900)
    idx = ndimage.distance_transform_edt(~wing, return_distances=False, return_indices=True)
    wl = np.where(solid, lab[idx[0], idx[1]], 0)
    votes = np.stack([ndimage.uniform_filter((wl == i).astype(float), 13) for i in range(8)])
    wl = np.where(solid, votes.argmax(0), 0)
    for i in range(2, 8):
        _, _, color = FILLS[i]
        m = morphology.remove_small_holes(morphology.remove_small_objects(wl == i, max_size=60), max_size=60)
        d = path_of(m, tol=1.2)
        if d:
            out.append(f'<path d="{d}" fill="{color}" stroke="{color}" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd"/>')
    # 2) divisas das lojas, bem discretas
    ln = morphology.remove_small_objects(ndimage.binary_closing(line, iterations=1), max_size=25)
    ln = morphology.thin(ln, max_num_iter=1) & solid
    out.append(f'<path d="{path_of(ln, tol=0.8)}" fill="{LINE}" fill-opacity=".28"/>')
    # 3) lojas âncora, um tom mais escuro da ala
    for p in data["pois"]:
        if "poly" not in p:
            continue
        cx, cy = (int(min(w - 1, max(0, p["x"] / SCALE))), int(min(h - 1, max(0, p["y"] / SCALE))))
        col = FILLS[wl[cy, cx] if wl[cy, cx] >= 2 else 3][2]
        rgb = [int(col[k:k + 2], 16) for k in (1, 3, 5)]
        dark = "#" + "".join(f"{int(c * 0.9):02x}" for c in rgb)
        pts = " ".join(f"{v:.1f}" for v in p["poly"])
        out.append(f'<polygon points="{pts}" fill="{dark}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>')
    # 4) corredores a partir do grafo
    segs = []
    for e in data["edges"]:
        na, nb = nodes[e["a"]], nodes[e["b"]]
        if na["t"] == "c" and nb["t"] == "c":
            segs.append(f'M{na["x"]} {na["y"]}L{nb["x"]} {nb["y"]}')
    d = "".join(segs)
    out.append(f'<path d="{d}" fill="none" stroke="#d9cba0" stroke-width="27" stroke-linecap="round" stroke-linejoin="round"/>')
    out.append(f'<path d="{d}" fill="none" stroke="#f6f0dc" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>')
    # textos
    out.append('<g font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#2b2118" text-anchor="middle">')
    for t, x, y, fs, rot in LABELS:
        X, Y, F = x * SCALE, y * SCALE, fs * SCALE
        tr = f' transform="rotate({rot} {X:.1f} {Y:.1f})"' if rot else ""
        out.append(f'<text x="{X:.1f}" y="{Y:.1f}" font-size="{F:.1f}"{tr}>{t.replace("&", "&amp;")}</text>')
    out.append("</g>")
    for n, x, y in ENTRIES:
        X, Y = x * SCALE, y * SCALE
        if n:
            out.append(f'<g font-family="Arial, Helvetica, sans-serif" font-weight="800" text-anchor="middle">'
                       f'<text x="{X:.1f}" y="{Y + 4:.1f}" font-size="54" fill="#2b2118">{n}</text>'
                       f'<text x="{X:.1f}" y="{Y + 26:.1f}" font-size="15" fill="#2b2118">ENTRADA</text></g>')
        else:
            out.append(f'<g font-family="Arial, Helvetica, sans-serif" font-weight="800" text-anchor="middle">'
                       f'<text x="{X:.1f}" y="{Y + 5:.1f}" font-size="13" fill="#2b2118">ENTRADA</text></g>')
    # banheiros, a partir do mall.json
    for p in data["pois"]:
        if p.get("cat") == "Banheiro":
            n = nodes[p["node"]]
            out.append(f'<g><rect x="{n["x"] - 13:.1f}" y="{n["y"] - 9:.1f}" width="26" height="18" rx="4" fill="#c8102e"/>'
                       f'<text x="{n["x"]:.1f}" y="{n["y"] + 4.5:.1f}" font-family="Arial, Helvetica, sans-serif" '
                       f'font-size="12" font-weight="800" fill="#fff" text-anchor="middle">WC</text></g>')
    out.append("</svg>")
    (OUT / "maps" / "l1.svg").write_text("\n".join(out))
    print(f"maps/l1.svg {W}x{H}, {sum(len(s) for s in out) // 1024} KB")


main()
