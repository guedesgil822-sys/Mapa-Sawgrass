#!/usr/bin/env python3
"""Gera a versão escura da planta (maps/l1.svg -> maps/l1-dark.svg).

Inverter a imagem inteira (filtro CSS) deixa fracas as linhas que já eram claras sobre claro
(vagas do estacionamento, ruas, divisões entre lojas). Aqui cada cor é trocada uma a uma:
- tons neutros (branco, cinza, preto): a claridade é invertida e o contraste entre cinzas
  claros parecidos é ampliado, para as linhas aparecerem sobre o fundo escuro;
- cores (lojas, corredores, ícones): mantêm o tom e ficam um pouco mais escuras.

Uso: python3 tools/make_dark.py   (rodar de novo sempre que l1.svg mudar)
"""
import colorsys
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC, DST = REPO / "maps" / "l1.svg", REPO / "maps" / "l1-dark.svg"

# cores do OpenStreetMap com destino escolhido à mão
FIXED = {
    "#f4f3ef": "#14171c",   # fundo
    "#e4e6ea": "#252a32",   # estacionamento
    "#cdd1d8": "#8a93a1",   # contorno do estacionamento (bem visível)
    "#d3d6dd": "#2f353e",   # prédios vizinhos
    "#b9bec7": "#7d8695",   # contorno dos prédios
    "#c4c8cf": "#6b7482",   # borda das ruas
    "#e3efd9": "#1c2a20",   # áreas verdes
    "#5b6270": "#c3cad5",   # nome das ruas
}


def neutral(l):
    """Claridade de um tom neutro no modo escuro.
    - claros (fundos, linhas): invertidos, com o contraste entre cinzas claros parecidos ampliado;
    - cinzas médios (garagens, calçadas): cinza escuro, um pouco acima do fundo;
    - escuros (contornos e letras pretas): claros, para continuarem visíveis."""
    if l >= 0.75:
        return 0.14 + (1.0 - l) * 2.0
    if l >= 0.3:
        return 0.30 + (0.75 - l) * 0.15
    return 0.9


def dark(r, g, b):
    if min(r, g, b) > 0.98:                         # branco puro: símbolos dos ícones (banheiro, caixa…)
        return 0.96, 0.96, 0.96
    if max(r, g, b) - min(r, g, b) < 0.12:          # neutro
        v = neutral((r + g + b) / 3)
        return v, v, v
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s > 0.75 and l < 0.5:                        # vermelho forte dos ícones: fica como está
        return r, g, b
    return colorsys.hls_to_rgb(h, l * 0.74, min(1.0, s * 0.92))


def hexc(r, g, b):
    return "#%02x%02x%02x" % tuple(round(max(0, min(1, c)) * 255) for c in (r, g, b))


def main():
    s = SRC.read_text()

    # uma passada só: trocar duas vezes inverteria a troca
    def hexcol(m):
        attr, c = m.group(1), m.group(2).lower()
        if c.startswith("rgb"):
            r, g, b = (float(x) / 100 for x in re.findall(r"[\d.]+", c))
            return f'{attr}="{hexc(*dark(r, g, b))}"'
        c = c.rstrip('"')
        if len(c) == 4:
            c = "#" + "".join(ch * 2 for ch in c[1:])
        if c in FIXED:
            return f'{attr}="{FIXED[c]}'
        if c == "#ffffff":   # contorno branco = miolo das ruas e borda do nome delas; branco de ícone fica
            return f'{attr}="' + ("#3b424d" if attr == "stroke" else "#ffffff")
        r, g, b = (int(c[i:i + 2], 16) / 255 for i in (1, 3, 5))
        return f'{attr}="{hexc(*dark(r, g, b))}'

    # só cores em atributos de pintura (não mexe em ids nem no texto)
    s = re.sub(r'\b(fill|stroke)="(rgb\([^)]*\)"|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b)', hexcol, s)
    # texto da rua: o contorno branco vira o fundo da rua
    s = s.replace('stroke="#3b424d" stroke-width="3" paint-order="stroke"', 'stroke="#14171c" stroke-width="3" paint-order="stroke"')
    DST.write_text(s)
    print(f"{DST.relative_to(REPO)}: {len(s) // 1024} KB")


if __name__ == "__main__":
    main()
