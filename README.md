# Rota no Shopping · Sawgrass Mills

PWA mobile tipo "Waze de shopping" para o **Sawgrass Mills** (Sunrise, Flórida,
perto de Miami). Você informa onde está (loja ou entrada) e para onde quer ir, e
o app desenha a rota a pé sobre a planta, com passo a passo em texto. Não usa
GPS: a origem é informada manualmente, porque GPS não funciona bem em ambiente
fechado.

Mesmo código do app feito para o Salvador Norte Shopping, adaptado para um
shopping de **piso único** (o seletor de piso e a opção "Sem escada rolante"
somem quando só existe um piso).

- `index.html`, `css/app.css`, `js/app.js` – app de navegação (busca, toque no mapa, passo a passo, funciona offline).
- `editor.html`, `js/editor.js` – editor do grafo (nós, arestas, lojas) com exportação em JSON.
- `js/graph.js` – dados, busca, rota por A* e instruções. `js/mapview.js` – mapa com arrastar e zoom.
- `data/mall.json` – piso, nós, arestas e lojas.
- `maps/l1.svg` – planta oficial em vetor (nítida em qualquer zoom), 3260×1870.
- `sw.js`, `manifest.webmanifest`, `icons/` – PWA e cache offline.
- `tools/fetch_sources.sh`, `tools/build_from_pdf.py` – baixam a planta oficial em PDF e geram `mall.json` e `maps/l1.svg`.

## Rodar

Site estático, sem build e sem dependências:

```sh
python3 -m http.server 8000
# app:    http://localhost:8000/
# editor: http://localhost:8000/editor.html
```

Para instalar no celular como app, publique em HTTPS (GitHub Pages serve:
Settings → Pages → branch `main`, pasta `/`).

## Corrigir ou completar o mapa

1. Abra `editor.html` (melhor no computador).
2. Ferramentas: **Nó** (N), **Aresta** (E), **Loja** (L), **Selecionar** (V). Delete apaga, Ctrl+Z desfaz.
3. **Loja**: clique na porta, informe o nome; o editor liga ao corredor mais próximo.
4. **Verificar grafo** lista lojas sem caminho e nós soltos. **Testar no app** abre o app com o rascunho.
5. **Exportar JSON**, substitua `data/mall.json` e aumente `VERSION` em `sw.js`.

## Formato do `mall.json`

O mesmo do projeto original (o editor e o app dependem dele):

```jsonc
{
  "meta":   { "name": "Sawgrass Mills", "schema": 1, "pxPerMeter": 2.0 },
  "floors": [{ "id": "L1", "name": "Piso único", "level": 1, "image": "maps/l1.svg", "width": 2880, "height": 1725 }],
  "nodes":  [{ "id": 0, "f": "L1", "x": 270, "y": 495, "t": "c" }],   // t: c, door, escalator, elevator, stairs, ramp
  "edges":  [{ "a": 0, "b": 1, "t": "walk" }],
  "pois":   [{ "id": "p0", "name": "Marshalls", "f": "L1", "x": 0, "y": 0, "node": 12,
               "group": "Moda", "cat": "...", "poly": [x0, y0, x1, y1], "label": false }]
}
```

Única adição: `pois[].label: false` (opcional) não desenha o nome no mapa,
porque a planta já traz o nome impresso. Lojas criadas no editor não têm esse
campo e aparecem com nome.

## Origem dos dados e limites

Fonte: a planta oficial em PDF publicada pela Simon
([sawgrassmills.pdf](https://www.simon.com/assets/mall/1262/mall_floorplan_doc/sawgrassmills.pdf)),
que é vetorial. `tools/build_from_pdf.py`:

1. lê a lista de lojas do PDF (número, nome e categoria);
2. acha o número de cada loja na planta por OCR (tesseract), loja por loja;
3. recorta o contorno exato de cada loja;
4. monta os corredores pela cor (bege nos internos, cinza nos passeios externos da Oasis e do Colonnade);
5. liga a porta de cada loja (ponto do contorno mais perto do corredor) ao corredor;
6. publica o próprio vetor do PDF como planta, sem a lista de lojas e sem os números das lojas que ganharam nome.

Resultado: 257 pontos (âncoras, ~220 lojas com contorno, entradas, banheiros e
praças de alimentação), 893 nós, 897 arestas. Há rota entre todos os pares.

O material pertence à Simon: para uso além do pessoal é preciso autorização.

- **Planta de 2007.** É a única planta oficial pública em PDF. Muitas lojas mudaram
  desde então (Wannado City, Sports Authority, Bed Bath & Beyond fecharam). Corrija pelo editor.
- **48 lojas da lista ficaram sem posição**: o OCR não leu o número delas na planta
  (números muito pequenos ou encostados nas linhas). Dá para incluí-las pelo editor.
- **Portas estimadas.** Em lojas grandes a porta pode estar no lado errado.
- **Escala estimada** (~2,4 pt por metro): distâncias e tempos são aproximados.
- Não foi testado andando dentro do shopping.

## Regras para quem for mexer

- Manter sem build e sem dependências.
- Interface em português do Brasil.
- Não quebrar o formato do `mall.json`.
- Ao mudar arquivos do app, aumentar `VERSION` em `sw.js`.
