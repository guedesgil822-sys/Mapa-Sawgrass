# Rota no Shopping · Sawgrass Mills

PWA mobile tipo "Waze de shopping" para o **Sawgrass Mills** (Sunrise, Flórida,
perto de Miami). Você informa onde está (loja ou entrada) e para onde quer ir, e
o app desenha a rota a pé sobre a planta, com passo a passo em texto. A origem
pode ser escolhida na lista ou pelo botão ◎ (GPS do celular), que mostra um
ponto azul com o raio de precisão e sugere a loja mais próxima como origem.
Dentro do prédio o GPS costuma errar 10–50 m; perto das entradas e no
estacionamento ele é mais confiável. Com o GPS ligado, ao escolher um destino a
origem vira **📍 Minha posição**: a rota sai de onde você está e é refeita
conforme você anda; a faixa do GPS mostra a seta de direção, o nome do destino
e os metros que faltam. No celular, a bússola gira o cone azul do ponto e a
seta passa a ser relativa para onde você está virado. A conversão lat/lon → mapa fica em
`meta.geo` do `mall.json` (gerada por `tools/add_osm.py`).

Mesmo código do app feito para o Salvador Norte Shopping, adaptado para um
shopping de **piso único** (o seletor de piso e a opção "Sem escada rolante"
somem quando só existe um piso).

- `index.html`, `css/app.css`, `js/app.js` – app de navegação (busca, toque no mapa, passo a passo, funciona offline).
- `editor.html`, `js/editor.js` – editor do grafo (nós, arestas, lojas) com exportação em JSON.
- `js/graph.js` – dados, busca, rota por A* e instruções. `js/mapview.js` – mapa com arrastar e zoom.
- `data/mall.json` – piso, nós, arestas e lojas.
- `maps/l1.svg` – planta oficial em vetor (nítida em qualquer zoom) com ruas e estacionamentos em volta, 4020×2820.
- `sw.js`, `manifest.webmanifest`, `icons/` – PWA e cache offline.
- `tools/fetch_sources.sh`, `tools/build_from_pdf.py`, `tools/add_osm.py` – baixam a planta oficial em PDF e o OpenStreetMap e geram `mall.json` e `maps/l1.svg` (nessa ordem).

## Buscar loja

O botão **🔎 Buscar loja** abre a lista de todos os lugares em ordem alfabética,
com uma divisória por letra ("The" no início do nome não conta) e filtros por
categoria. Digitando, a lista filtra por nome ou categoria. Tocar numa loja
marca ou desmarca (✓); as marcadas ficam em amarelo com ★ no mapa e continuam
salvas no aparelho. **Ver no mapa** enquadra todas; **Limpar** (na busca ou no
botão "✕ Limpar" da tela principal) apaga a seleção. Tocando numa loja no mapa,
o painel mostra "Estou aqui", "Ir para cá" e "Marcar/Desmarcar".

## Ferramentas

Layout "barra inferior" (padrão Google Maps/Waze): no topo, a busca
**"Para onde você vai?"** (vira o cartão De → Para quando há rota, com ✕ para
limpar) e chips de status; à direita, GPS e zoom; embaixo, a barra fixa
**Mapa · Buscar · Encontro · Carro · Grupo** (a aba mostra o horário do
encontro, o número de lojas marcadas e um ponto quando o carro está salvo):

- **🤝 Ponto de encontro**: local + horário (atalhos +15 min, +30 min, +1 h,
  +2 h). Fica um chip no topo com a contagem ("em 25 min"), que fica roxo
  quando faltam 5 min. Vai junto no compartilhamento.
- **🚗 Meu carro**: marca onde estacionou, pelo GPS (escolhe sozinho o
  estacionamento mais próximo) ou escolhendo da lista, com anotação ("fileira
  B, vaga 23"). "Levar até o carro" traça a rota até a saída daquele
  estacionamento e uma linha até o carro.
- **📤 Grupo** (compartilhar) e **🔎 Buscar** (marcar lojas).

Encontro e carro ficam salvos no aparelho.

## Lojas atualizadas (2026)

A planta oficial é de 2007. `tools/update_stores.py` cruza cada loja da planta
com o OpenStreetMap (lojas com posição) e com o diretório atual do malls.com
(só nomes): loja que continua ganha o nome atual; espaço ocupado por outra marca
recebe a marca nova (o nome antigo é apagado do desenho e o app escreve o novo);
loja que fechou sai do mapa; lojas novas viram pontos ligados ao corredor mais
próximo (as grifes da parte nova do Colonnade ganham um caminho a pé até ele).
O resumo da última atualização fica em `tools/update_stores_report.json`.

Lojas do diretório atual que não estão no OpenStreetMap entram por
`tools/add_missing.py`, a partir das pistas do diretório ("entre a Gap e a
Solaris", "em frente à Nike", "perto da Burlington"): ficam perto das lojas
citadas, ligadas ao corredor, com `"approx": true` (o app mostra "📍 local
aproximado"; uma correção pelo app tira essa marca). Sem pista, ficam de fora.
Limites: a posição vem do OpenStreetMap, que pode errar alguns metros, e lojas
que não estão no OpenStreetMap ficam fora do mapa.

## Idiomas

Português, English, Español, Français, Deutsch, 中文 (simplificado) e 日本語
(os idiomas dos maiores grupos de turistas da Flórida, mais China e Japão). O app abre no idioma do celular; a bandeira na busca
do topo troca o idioma (fica salvo). Traduções em `js/i18n.js`, com o texto em
português como chave: textos da tela, passo a passo da rota, segmentos,
categorias e lugares como entradas, banheiros e estacionamentos. Nomes das
lojas (marcas) e mensagens do grupo não mudam.

## Logos das marcas

Cada loja com site conhecido tem o campo `web` no `mall.json` (lista em
`tools/brands.json`). A busca e o painel da loja mostram o ícone oficial desse
site (serviço de favicons do Google); sem site, sem internet ou dentro do
visualizador do Claude, aparece um selo com as iniciais na cor do segmento.

## Grupo com conversa

A aba **Grupo** cria um grupo (código tipo `SAW-K7Q2-M9XD` e link de convite
`#g=…`) ou entra num existente, só com o nome. Dentro: conversa ao vivo, a
última mensagem aparece numa faixa no topo do mapa (com contador de não
lidas), o ponto de encontro fica igual para todos e, opcionalmente, cada um
mostra a própria posição no mapa do grupo. Quem criou pode **Excluir grupo**,
que apaga mensagens e posições de todos; o grupo também deixa de existir
depois de 24 h.

Banco: Firebase Realtime Database (`DB_URL` em `js/app.js`), usado por REST e
Server-Sent Events, sem biblioteca. Regras do banco: só lê/escreve quem tem o
código, ninguém lista os grupos, validade máxima de 24 h, mensagens de até 300
letras. Não funciona dentro do visualizador do Claude (só no site).

## Perto de mim

O chip **📍 Perto de mim** mostra os 5 lugares mais próximos (distância real a
pé) de: banheiro, caixa eletrônico, comida, café e doces, saída, estacionamento, atendimento e
farmácia, a partir do GPS, da origem escolhida ou da loja aberta no painel.
"Ir ➜" traça a rota. Os 7 caixas eletrônicos vêm dos ícones "$" da planta
(`tools/add_atms.py`). Fraldário não aparece na planta.

## Compras (preço, tamanhos e lista)

O chip **🛍️ Compras** abre quatro abas (`js/shop.js`):

- **Preço**: preço da etiqueta em US$ → moeda escolhida (real, euro, libra,
  dólar canadense, peso mexicano/colombiano/argentino/chileno, yuan, iene), com
  o imposto de 7% de Sunrise (6% da Flórida + 1% do condado de Broward) e, para
  real, o IOF de 3,5% do cartão brasileiro. A cotação do dia vem de
  open.er-api.com e fica guardada para usar sem internet (antes da primeira
  cotação usa um valor aproximado e avisa).
- **Tamanhos**: calçado feminino e masculino (EUA, Brasil, Europa, cm do pé),
  roupa feminina, camisa e calça masculina. Referência comum; varia por marca.
- **Lista**: o que comprar, preço e loja (entre as marcadas), agrupado por loja
  com "Ir ➜", marcar como comprado, e totais planejado/comprado na moeda
  escolhida. Fica salva no aparelho.
- **Ofertas**: livreto de cupons grátis para turistas no Atendimento (Simon
  Guest Services, em frente à Burlington; ponto aproximado no mapa, com rota),
  link para as promoções oficiais (simon.com) e dicas para economizar.

## Rota em voz alta

No painel da rota, o botão 🔇/🔊 liga a leitura em voz alta (voz do próprio
celular, no idioma do app): cada passo é falado ao começar a rota e ao tocar
em "Próximo", e com o GPS o app fala "Você chegou". A escolha fica salva.

## Tutorial

Na primeira abertura aparecem 3 telas rápidas de "como usar" (busca e rota,
lojas marcadas/roteiro/perto de mim, grupo e compras), no idioma do app. Dá
para rever pela bandeira do idioma › "👋 Como usar o app".

## Corrigir loja no lugar errado

No painel da loja, **📍 Loja no lugar errado?** e depois um toque no mapa no
lugar certo: a loja passa a ficar ali (ponto ligado ao corredor mais próximo).
As correções ficam no aparelho (`sawgrass.correcoes`), aparecem no chip
"✏️ N correções" e podem ser enviadas (📤) como texto para serem aplicadas no
`mall.json` de todos.

## Horário, aviso do encontro e Uber/táxi

- **Horário**: o chip mostra "Aberto até 21h", "Fecha em 40 min" (laranja na
  última hora) ou "Fechado · abre às 10h", sempre no horário de Sunrise
  (seg–sáb 10h–21h, dom 11h–20h, conforme as lojas do shopping em 2026;
  feriados mudam). Tocando, abre a tabela da semana.
- **Aviso do encontro**: com o app aberto, aparece um aviso (e o celular vibra
  onde houver suporte) 10 minutos antes e na hora do encontro. A notificação do
  sistema só funciona se for permitida; no iPhone, só com o app adicionado à
  tela de início.
- **Uber / táxi**: em "Perto de mim", as entradas mais próximas com "Ir ➜" e
  botões Uber e Lyft que já abrem o app com o embarque naquela entrada. O
  shopping não tem um ponto oficial de embarque.

## Roteiro pelas lojas marcadas

Com 2 ou mais lojas marcadas aparece o chip **🧭 Roteiro**. O app calcula a
ordem que faz andar menos (vizinho mais próximo + melhorias 2-opt, com as
distâncias reais dos corredores), saindo da sua posição (GPS) ou da loja que
você escolher. No mapa as paradas ficam numeradas e os próximos trechos
tracejados; o painel mostra "1/5", o total em metros e os botões ‹ e
"Próxima loja ›" (tocar numa parada da lista também leva até ela).

## Compartilhar com o grupo

**📤 Compartilhar** monta uma mensagem com link (WhatsApp ou qualquer app; sem
suporte, copia o texto). Pode levar as lojas marcadas, o ponto de encontro
(toque numa loja no mapa › "🤝 Encontro aqui") e onde você está (GPS, uma foto
do momento com seu nome e a hora). Tudo vai no próprio link
(`#enc=…&m=…&px=x,y&h=…&quem=…`), sem servidor. Quem abre vê o encontro como
destino, as lojas em amarelo e a sua posição em roxo, e pode "Guardar" as lojas
ou ver a rota até o encontro pelo GPS.

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

Resultado: 267 pontos (âncoras, ~220 lojas com contorno, entradas, banheiros,
praças de alimentação e 10 estacionamentos), 913 nós, 917 arestas. Há rota entre
todos os pares.

Ruas e estacionamentos vêm do OpenStreetMap (© colaboradores do OpenStreetMap,
licença ODbL). `tools/add_osm.py` alinha o contorno do prédio no OSM com a planta
(escala, rotação e posição que mais sobrepõem os dois; ~74% de sobreposição), amplia
a área até a avenida Sawgrass Mills Circle e desenha estacionamentos, vias e prédios
vizinhos por baixo da planta. O alinhamento também dá a escala: ~2,98 pt por metro.

Cada ponto "Estacionamento · Entrada N" fica no estacionamento real mais perto da
entrada, ligado a ela por um caminho a pé. A rota vai da borda do estacionamento
até a loja; não há caminhos mapeados entre as vagas.

O material pertence à Simon: para uso além do pessoal é preciso autorização.

- **Planta de 2007.** É a única planta oficial pública em PDF. Muitas lojas mudaram
  desde então (Wannado City, Sports Authority, Bed Bath & Beyond fecharam). Corrija pelo editor.
- **48 lojas da lista ficaram sem posição**: o OCR não leu o número delas na planta
  (números muito pequenos ou encostados nas linhas). Dá para incluí-las pelo editor.
- **Portas estimadas.** Em lojas grandes a porta pode estar no lado errado.
- **Escala pelo alinhamento com o OpenStreetMap** (~2,98 pt por metro): distâncias e tempos são aproximados.
- Não foi testado andando dentro do shopping.

## Regras para quem for mexer

- Manter sem build e sem dependências.
- Interface em português do Brasil.
- Não quebrar o formato do `mall.json`.
- Ao mudar arquivos do app, aumentar `VERSION` em `sw.js`.
