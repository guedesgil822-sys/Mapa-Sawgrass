#!/usr/bin/env python3
"""Acrescenta ruas e estacionamentos do OpenStreetMap ao mapa.

Uso (depois de build_from_pdf.py):
  python3 tools/add_osm.py <pasta_raw> .

<pasta_raw>/osm.json vem de fetch_sources.sh (API do OpenStreetMap).
Dados © colaboradores do OpenStreetMap, licença ODbL.

Etapas:
  1. Alinha o contorno do prédio do Sawgrass Mills no OSM com a planta oficial
     (escala, rotação e posição que mais sobrepõem os dois).
  2. Amplia a área do mapa até a avenida que contorna o shopping.
  3. Desenha gramados, estacionamentos, ruas e outros prédios por baixo da planta.
  4. Move cada ponto "Estacionamento · ..." para o estacionamento real mais perto
     da sua entrada, e usa a escala do alinhamento (pt por metro).
"""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize

RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
PDF = RAW / "sawgrassmills.pdf"
X0, Y0 = 80, 2380                  # origem do recorte da planta (pt), como em build_from_pdf.py
ML, MT, NW, NH = 380, 270, 4020, 2820   # nova área: margem esquerda/topo, largura, altura
MALL_WAY = 43330658                # prédio "Sawgrass Mills" no OSM
LAT0, LON0 = 26.151, -80.322
ERASE = [(160, 3600, 690, 4400), (690, 4150, 1330, 4400), (1330, 4180, 2050, 4400)]


def align(osm, nodes):
    """Escala, rotação e deslocamento que levam metros (OSM) a pt da planta."""
    K = 0.25
    tmp = Path(tempfile.mkdtemp())
    subprocess.run(["pdftoppm", "-r", "18", "-png", "-singlefile", "-x", str(int(X0 * K)), "-y", str(int(Y0 * K)),
                    "-W", "815", "-H", "468", str(PDF), str(tmp / "fp")], check=True)
    a = np.array(Image.open(tmp / "fp.png").convert("RGB")).astype(int)
    m = ~((a.min(2) > 235) | (np.abs(a - [237, 234, 227]).sum(2) < 20))
    for x0, y0, x1, y1 in ERASE:
        m[int((y0 - Y0) * K):int((y1 - Y0) * K), int((x0 - X0) * K):int((x1 - X0) * K)] = False
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=3))
    lab, n = ndimage.label(m)
    sz = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, 1 + np.where(sz > 200)[0])
    mall = next(e for e in osm if e["type"] == "way" and e["id"] == MALL_WAY)
    P = np.array([meters(*nodes[i]) for i in mall["nodes"]])
    H, W = m.shape

    def iou(p):
        s, th, tx, ty = p
        Q = P @ rot(th) * s * K + [tx, ty]
        im = Image.new("L", (W, H), 0)
        ImageDraw.Draw(im).polygon([tuple(q) for q in Q], fill=1)
        r = np.array(im, bool)
        return (r & m).sum() / max(1, (r | m).sum())

    cy, cx = [v.mean() for v in np.nonzero(m)]
    best = (0, None)
    for deg in range(0, 360, 5):
        th = math.radians(deg)
        for s in np.arange(1.6, 4.01, 0.2):
            Q = P @ rot(th) * s * K
            p = (s, th, cx - Q[:, 0].mean(), cy - Q[:, 1].mean())
            v = iou(p)
            if v > best[0]:
                best = (v, p)
    res = optimize.minimize(lambda p: -iou(p), best[1], method="Nelder-Mead",
                            options={"xatol": 1e-3, "fatol": 1e-4, "maxiter": 600})
    s, th, tx, ty = res.x
    print(f"alinhamento: sobreposição {-res.fun:.2f}, {s:.3f} pt/m, rotação {math.degrees(th):.1f}°")
    return s, th, tx / K, ty / K


def meters(lat, lon):
    return ((lon - LON0) * 111320 * math.cos(math.radians(LAT0)), -(lat - LAT0) * 110574)


def rot(th):
    c, s = math.cos(th), math.sin(th)
    return np.array([[c, s], [-s, c]])


def main():
    osm = json.loads((RAW / "osm.json").read_text())["elements"]
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm if e["type"] == "node"}
    s, th, tx, ty = align(osm, nodes)
    R = rot(th)

    def to_xy(lat, lon):
        x, y = np.array(meters(lat, lon)) @ R * s + [tx, ty]
        return float(x + ML), float(y + MT)

    def to_map(nid):
        """Nó OSM -> coordenadas da nova imagem."""
        x, y = np.array(meters(*nodes[nid])) @ R * s + [tx, ty]
        return x + ML, y + MT

    ways = [e for e in osm if e["type"] == "way" and len(e.get("nodes", [])) > 1]

    def pts(w):
        return [to_map(i) for i in w["nodes"] if i in nodes]

    def d_attr(w, close):
        p = pts(w)
        return "M" + "L".join(f"{x + X0 - ML:.1f} {y + Y0 - MT:.1f}" for x, y in p) + ("Z" if close else "")

    # ---------- dados do app
    data = json.loads((OUT / "data" / "mall.json").read_text())
    for n in data["nodes"]:
        n["x"], n["y"] = round(n["x"] + ML, 1), round(n["y"] + MT, 1)
    for p in data["pois"]:
        p["x"], p["y"] = round(p["x"] + ML, 1), round(p["y"] + MT, 1)
        if "poly" in p:
            p["poly"] = [round(v + (ML if k % 2 == 0 else MT), 1) for k, v in enumerate(p["poly"])]
    f = data["floors"][0]
    f["width"], f["height"] = NW, NH
    data["meta"]["pxPerMeter"] = round(s, 3)
    o, ex, ey = (to_xy(LAT0, LON0), to_xy(LAT0, LON0 + 1e-3), to_xy(LAT0 + 1e-3, LON0))
    data["meta"]["geo"] = {   # x = x0 + xLon*(lon-lon0) + xLat*(lat-lat0); idem y — usado pelo GPS do app
        "lat0": LAT0, "lon0": LON0, "x0": round(o[0], 2), "y0": round(o[1], 2),
        "xLon": round((ex[0] - o[0]) / 1e-3, 2), "xLat": round((ey[0] - o[0]) / 1e-3, 2),
        "yLon": round((ex[1] - o[1]) / 1e-3, 2), "yLat": round((ey[1] - o[1]) / 1e-3, 2)}
    data["meta"]["source"] += "; ruas e estacionamentos © colaboradores do OpenStreetMap (ODbL)"

    # estacionamento real mais perto de cada entrada
    lots = [pts(w) for w in ways if w.get("tags", {}).get("amenity") == "parking" and w["nodes"][0] == w["nodes"][-1]]
    lots = [l for l in lots if all(0 <= x <= NW and 0 <= y <= NH for x, y in l)]
    byid = {n["id"]: n for n in data["nodes"]}
    adj = {}
    for e in data["edges"]:
        adj.setdefault(e["a"], []).append(e["b"])
        adj.setdefault(e["b"], []).append(e["a"])
    for p in data["pois"]:
        if p["group"] != "Estacionamento":
            continue
        door = byid[p["node"]]
        gate = byid[adj[door["id"]][0]]
        best = None
        for l in lots:
            cx, cy = sum(x for x, _ in l) / len(l), sum(y for _, y in l) / len(l)
            for k in range(len(l)):
                (ax, ay), (bx, by) = l[k], l[(k + 1) % len(l)]
                dx, dy = bx - ax, by - ay
                L2 = dx * dx + dy * dy or 1
                t = max(0, min(1, ((gate["x"] - ax) * dx + (gate["y"] - ay) * dy) / L2))
                q = (ax + t * dx, ay + t * dy)
                dd = math.hypot(q[0] - gate["x"], q[1] - gate["y"])
                if best is None or dd < best[0]:
                    best = (dd, q, (cx, cy))
        if best and best[0] < 120 * s:   # até ~120 m da entrada
            q, c = best[1], best[2]
            # um pouco para dentro do estacionamento, para o ponto não ficar na borda
            door["x"], door["y"] = round(q[0] + (c[0] - q[0]) * 0.15, 1), round(q[1] + (c[1] - q[1]) * 0.15, 1)
            p["x"], p["y"] = door["x"], door["y"]
    (OUT / "data" / "mall.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

    # ---------- planta
    layers = {"grass": [], "parking": [], "garage": [], "building": [], "service": [], "minor": [],
              "major": [], "highway": []}
    names = {}
    for w in ways:
        t = w.get("tags", {})
        closed = w["nodes"][0] == w["nodes"][-1]
        if w["id"] == MALL_WAY:
            continue
        hw = t.get("highway")
        if t.get("amenity") == "parking" and closed:
            layers["garage" if t.get("parking") == "multi-storey" else "parking"].append(d_attr(w, True))
        elif t.get("landuse") in ("grass", "forest") or t.get("leisure") == "park":
            if closed:
                layers["grass"].append(d_attr(w, True))
        elif t.get("building") and closed:
            layers["building"].append(d_attr(w, True))
        elif hw == "service":
            layers["service"].append(d_attr(w, False))
        elif hw in ("unclassified", "residential", "tertiary", "secondary", "primary"):
            layers["minor" if hw in ("unclassified", "residential") else "major"].append(d_attr(w, False))
            if t.get("name"):
                names.setdefault(t["name"], []).append(pts(w))
        elif hw in ("trunk", "motorway", "motorway_link", "trunk_link"):
            layers["highway"].append(d_attr(w, False))
            if t.get("name"):
                names.setdefault(t["name"], []).append(pts(w))
    style = {
        "grass": 'fill="#e3efd9"',
        "parking": 'fill="#e4e6ea" stroke="#cdd1d8" stroke-width="2"',
        "garage": 'fill="#d3d6dd" stroke="#b9bec7" stroke-width="2"',
        "building": 'fill="#ddd9d2" stroke="#c9c4bb" stroke-width="1.5"',
    }
    g = ['<g id="osm">']
    for k in ("grass", "parking", "garage", "building"):
        if layers[k]:
            g.append(f'<path {style[k]} d="{"".join(layers[k])}"/>')
    for k, (w_case, w_fill, fill) in {"service": (9, 6, "#ffffff"), "minor": (20, 15, "#ffffff"),
                                      "major": (26, 20, "#fde7a6"), "highway": (32, 26, "#f6c08a")}.items():
        if layers[k]:
            d = "".join(layers[k])
            g.append(f'<path fill="none" stroke="#c4c8cf" stroke-width="{w_case}" stroke-linecap="round" stroke-linejoin="round" d="{d}"/>')
            g.append(f'<path fill="none" stroke="{fill}" stroke-width="{w_fill}" stroke-linecap="round" stroke-linejoin="round" d="{d}"/>')
    # nomes das ruas: um por nome, no maior trecho dentro da área
    for name, segs in names.items():
        segs = [sg for sg in segs if len(sg) > 1]
        inside = [[(x, y) for x, y in sg if 60 < x < NW - 60 and 40 < y < NH - 40] for sg in segs]
        sg = max(inside, key=len, default=[])
        if len(sg) < 2:
            continue
        k = len(sg) // 2
        (ax, ay), (bx, by) = sg[max(0, k - 1)], sg[min(len(sg) - 1, k + 1)]
        ang = math.degrees(math.atan2(by - ay, bx - ax))
        if ang > 90:
            ang -= 180
        if ang < -90:
            ang += 180
        x, y = sg[k][0] + X0 - ML, sg[k][1] + Y0 - MT
        g.append(f'<text x="{x:.1f}" y="{y:.1f}" transform="rotate({ang:.1f} {x:.1f} {y:.1f})" '
                 f'font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#5b6270" '
                 f'text-anchor="middle" dominant-baseline="middle" stroke="#fff" stroke-width="3" '
                 f'paint-order="stroke">{name.replace("&", "&amp;")}</text>')
    # "P" em cada estacionamento grande
    for l in lots:
        xs, ys = [x for x, _ in l], [y for _, y in l]
        area = 0.5 * abs(sum(xs[i] * ys[i - 1] - xs[i - 1] * ys[i] for i in range(len(l))))
        if area > (35 * s) ** 2:
            cx, cy = sum(xs) / len(xs) + X0 - ML, sum(ys) / len(ys) + Y0 - MT
            g.append(f'<g><rect x="{cx - 13:.1f}" y="{cy - 13:.1f}" width="26" height="26" rx="5" fill="#2f6fd1"/>'
                     f'<text x="{cx:.1f}" y="{cy + 7:.1f}" font-family="Arial, Helvetica, sans-serif" font-size="20" '
                     f'font-weight="800" fill="#fff" text-anchor="middle">P</text></g>')
    g.append("</g>")
    g.append(f'<text x="{X0 - ML + NW - 12}" y="{Y0 - MT + NH - 12}" font-family="Arial, Helvetica, sans-serif" '
             f'font-size="14" fill="#7a808c" text-anchor="end">Ruas e estacionamentos © OpenStreetMap</text>')

    svg = (OUT / "maps" / "l1.svg").read_text()
    head_end = svg.index(">", svg.index("<svg")) + 1
    head = svg[:head_end]
    import re
    head = re.sub(r'width="[^"]*"', f'width="{NW}"', head, count=1)
    head = re.sub(r'height="[^"]*"', f'height="{NH}"', head, count=1)
    head = re.sub(r'viewBox="[^"]*"', f'viewBox="{X0 - ML} {Y0 - MT} {NW} {NH}"', head, count=1)
    body = svg[head_end:]
    # fundo branco do recorte antigo vira fundo da área nova, e o OSM entra logo depois dele
    i = body.index(f'<rect x="{X0}" y="{Y0}"')
    j = body.index(">", i) + 1
    bg = f'<rect x="{X0 - ML}" y="{Y0 - MT}" width="{NW}" height="{NH}" fill="#f4f3ef" />'
    body = body[:i] + bg + "\n" + "\n".join(g) + body[j:]
    (OUT / "maps" / "l1.svg").write_text(head + body)
    print(f"planta {NW}x{NH}, {sum(len(v) for v in layers.values())} formas do OSM, {len(lots)} estacionamentos")


main()
