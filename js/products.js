// "O que você quer comprar?" -> lojas que vendem isso.
// O mall.json só tem categorias largas (quase tudo é "Vestuário"), então aqui cada assunto lista
// palavras de busca (pt, en, es) e as marcas/lojas do Sawgrass que vendem aquilo.
// k: palavras (sem acento, minúsculas)   n: trechos do nome da loja   c: trechos da categoria
import { norm } from './graph.js';
import { t as tx } from './i18n.js';

export const TOPICS = [
  { id: 'malas', label: 'Malas', ico: '🧳', k: ['mala', 'malas', 'bagagem', 'mochila', 'luggage', 'suitcase', 'backpack', 'maleta', 'valija', 'equipaje'],
    n: ['Samsonite', 'Tumi', 'Kipling', 'Traveltino', 'Burlington', 'Marshalls', 'TJ Maxx', 'Nordstrom Rack', 'HomeSense', 'Target'], c: ['Bolsas e malas'] },
  { id: 'perfume', label: 'Perfume', ico: '🌸', k: ['perfume', 'perfumes', 'fragrancia', 'fragrance', 'colonia', 'cologne', 'perfumaria'],
    n: ['Perfumania', 'Fragrance Outlet', 'Perfumes 4U', 'Elegance Perfumes', 'Sephora', 'Carolina Herrera', 'Saks Off 5th', "Bloomingdale's", 'Marshalls', 'TJ Maxx', 'Burlington', 'Victoria', 'Bath & Body'], c: [] },
  { id: 'make', label: 'Maquiagem', ico: '💄', k: ['maquiagem', 'makeup', 'maquillaje', 'cosmetico', 'cosmeticos', 'cosmetics', 'batom', 'skincare', 'creme', 'hidratante'],
    n: ['Sephora', 'KIKO', 'Cosmetics Company', 'Clarins', "L'Occitane", 'Bath & Body', 'Elegance Perfumes', 'Perfumania'], c: ['Beleza'] },
  { id: 'tenis', label: 'Tênis', ico: '👟', k: ['tenis', 'sneaker', 'sneakers', 'zapatillas', 'corrida', 'running', 'basquete'],
    n: ['Nike', 'Adidas', 'ASICS', 'Puma', 'Reebok', 'New Balance', 'Skechers', 'Converse', 'Vans', 'Foot Locker', 'JD Sports', 'Champs', 'Shoe Palace', 'Sneaker Lovers', "Runner's Depot", 'Famous Footwear', 'Rack Room', 'Off Broadway', 'Under Armour', 'Journeys', "Dick's"], c: [] },
  { id: 'sapatos', label: 'Sapatos', ico: '👞', k: ['sapato', 'sapatos', 'sandalia', 'sandalias', 'bota', 'botas', 'chinelo', 'salto', 'shoes', 'boots', 'sandals', 'zapatos', 'heels'],
    n: ['Clarks', 'Cole Haan', 'Ecco', 'Florsheim', 'Steve Madden', 'Aldo', 'Birkenstock', 'Crocs', 'Timberland', 'Stuart Weitzman', 'Jimmy Choo', 'Louboutin', 'Ferragamo', "Tod's", 'Famous Footwear', 'Rack Room', 'Off Broadway', 'Skechers'], c: ['Calçados'] },
  { id: 'oculos', label: 'Óculos', ico: '🕶️', k: ['oculos', 'sunglasses', 'gafas', 'lentes', 'oculos de sol'],
    n: ['Sunglass Hut', 'Oakley', 'Solaris'], c: [] },
  { id: 'relogio', label: 'Relógio', ico: '⌚', k: ['relogio', 'relogios', 'watch', 'watches', 'reloj', 'smartwatch'],
    n: ['Fossil', 'Swatch', 'Citizen', 'Invicta', 'Movado', 'TAG Heuer', 'Tissot', 'Breitling', 'Watch Station', 'Michael Kors', 'Garmin', 'Samsung'], c: [] },
  { id: 'joias', label: 'Joias', ico: '💍', k: ['joia', 'joias', 'jewelry', 'joyas', 'anel', 'colar', 'pulseira', 'brinco', 'brincos'],
    n: ['Pandora', 'Kay Jewelers', 'Zales', 'David Yurman', 'Swarovski', 'Diamonds International', 'Designers Jewelry', 'UNOde50', 'Banter', 'claire'], c: ['Joias'] },
  { id: 'eletronicos', label: 'Eletrônicos', ico: '📱', k: ['eletronico', 'eletronicos', 'celular', 'iphone', 'fone', 'headphone', 'electronics', 'notebook', 'videogame', 'tablet', 'phone', 'capinha', 'carregador'],
    n: ['BrandsMart', 'Samsung', 'T-Mobile', 'VX Technologies', 'Cellaxs', 'Target', 'Garmin', 'Five Below', 'Tns-Usa'], c: ['Eletrônicos'] },
  { id: 'brinquedos', label: 'Brinquedos', ico: '🧸', k: ['brinquedo', 'brinquedos', 'toys', 'toy', 'juguetes', 'boneca', 'pelucia'],
    n: ['Lego', 'Toys R Us', 'Target', 'Five Below', 'BoxLunch', "Spencer's", 'Matchbox', 'Hot Topic'], c: ['Brinquedos'] },
  { id: 'infantil', label: 'Roupa infantil', ico: '👶', k: ['infantil', 'crianca', 'criancas', 'bebe', 'kids', 'baby', 'ninos', 'enxoval'],
    n: ["Carter's", 'OshKosh', "Children's Place", 'Janie & Jack', 'Abercrombie Kids', 'Tommy Hilfiger Kids', 'Babycottons', 'Nini and Loli', 'Monnalisa', 'Polo Ralph Lauren Children', 'Gap', 'Old Navy', 'H&M', 'Primark'], c: ['infantis'] },
  { id: 'intima', label: 'Lingerie e praia', ico: '👙', k: ['lingerie', 'calcinha', 'sutia', 'pijama', 'biquini', 'maio', 'moda praia', 'swimwear', 'bikini', 'underwear', 'cueca'],
    n: ['Victoria', 'Aerie', 'Calzedonia', 'Intimissimi', 'SKIMS', 'Agua Bendita', 'Luli Fama', 'Vilebrequin', 'Wolford', 'Hurley', 'Calvin Klein'], c: [] },
  { id: 'jeans', label: 'Jeans', ico: '👖', k: ['jeans', 'calca jeans', 'denim', 'vaqueros'],
    n: ["Levi's", 'Diesel', '7 For All Mankind', 'G-Star', 'Guess', 'Lucky Brand', 'Mania Jeans', 'American Eagle', 'Hollister', 'Gap', 'Old Navy', 'Calvin Klein', 'Tommy Hilfiger', 'rag & bone'], c: [] },
  { id: 'fitness', label: 'Roupa de academia', ico: '🏋️', k: ['academia', 'fitness', 'legging', 'roupa esportiva', 'gym', 'activewear', 'yoga'],
    n: ['Lululemon', 'Fabletics', 'Nike', 'Adidas', 'Under Armour', 'Puma', 'Reebok', 'Columbia', 'The North Face', "Dick's", 'Champs', 'JD Sports'], c: ['Artigos esportivos'] },
  { id: 'casacos', label: 'Casacos', ico: '🧥', k: ['casaco', 'casacos', 'jaqueta', 'frio', 'inverno', 'jacket', 'coat', 'abrigo', 'chamarra'],
    n: ['The North Face', 'Columbia', 'Moncler', 'Burlington', 'Marshalls', 'TJ Maxx', 'Nordstrom Rack', 'Timberland', 'Tommy Hilfiger', 'Calvin Klein', 'Guess'], c: [] },
  { id: 'bolsas', label: 'Bolsas', ico: '👜', k: ['bolsa', 'bolsas', 'carteira', 'handbag', 'purse', 'bag', 'wallet', 'cartera'],
    n: ['Coach', 'Michael Kors', 'Kate Spade', 'Tory Burch', 'Kipling', 'Guess', 'Rebag', 'Marc Jacobs', 'Steve Madden', 'Aldo', 'Fossil', 'Calvin Klein', 'Tommy Hilfiger'], c: ['Bolsas'] },
  { id: 'grifes', label: 'Grifes', ico: '💎', k: ['grife', 'grifes', 'luxo', 'luxury', 'lujo', 'designer'],
    n: ['Gucci', 'Prada', 'Fendi', 'Balenciaga', 'Saint Laurent', 'Valentino', 'Versace', 'Dolce', 'Burberry', 'Moncler', 'Loro Piana', 'Brunello', 'Zegna', "Tod's", 'Ferragamo', 'Jimmy Choo', 'Louboutin', 'Balmain', 'AMIRI', 'ETRO', 'Philipp Plein', 'Roberto Cavalli', 'Saks Off 5th', "Bloomingdale's"], c: ['Colonnade'] },
  { id: 'casa', label: 'Casa e cozinha', ico: '🍳', k: ['casa', 'cozinha', 'panela', 'panelas', 'decoracao', 'toalha', 'lencol', 'cama', 'kitchen', 'home', 'cookware', 'sabanas'],
    n: ['HomeSense', 'Le Creuset', 'Zwilling', 'FRETTE', 'Sferra', 'Marshalls', 'TJ Maxx', 'Target', 'Burlington'], c: ['Casa'] },
  { id: 'farmacia', label: 'Farmácia e vitaminas', ico: '💊', k: ['farmacia', 'remedio', 'vitamina', 'vitaminas', 'suplemento', 'whey', 'pharmacy', 'vitamins'],
    n: ['CVS', 'GNC', 'Target'], c: [] },
  { id: 'chocolate', label: 'Chocolate e doces', ico: '🍫', k: ['chocolate', 'chocolates', 'doce', 'doces', 'candy', 'dulces', 'bombom'],
    n: ['Läderach', 'Cinnabon', "Auntie Anne's", "Wetzel's", 'Baked Bear', 'Churromania', 'Crepe', 'Apropo', 'Häagen', 'Baskin'], c: ['Doces'] },
  { id: 'livros', label: 'Livros e presentes', ico: '🎁', k: ['livro', 'livros', 'presente', 'presentes', 'books', 'gift', 'gifts', 'libros', 'regalo'],
    n: ['Books-A-Million', 'BoxLunch', "Spencer's", 'Five Below', 'Hot Topic'], c: ['Livr'] },
  // comida por tipo
  { id: 'pizza', label: 'Pizza', ico: '🍕', food: true, k: ['pizza', 'pizzas'], n: ['California Pizza Kitchen', 'Sbarro'], c: [] },
  { id: 'burger', label: 'Hambúrguer', ico: '🍔', food: true, k: ['hamburguer', 'burger', 'hamburguesa', 'lanche'],
    n: ['Five Guys', 'Shake Shack', 'Burger King', 'Yard House', 'Cheesecake Factory', "Nathan's", 'Grand Lux'], c: [] },
  { id: 'asiatica', label: 'Japonês e asiático', ico: '🍣', food: true, k: ['japones', 'sushi', 'asiatico', 'asiatica', 'chines', 'asian', 'chinese', 'japanese'],
    n: ['SushiGami', 'Japan Cafe', 'Asian Chao', 'P.F. Chang'], c: [] },
  { id: 'mexicana', label: 'Mexicano', ico: '🌮', food: true, k: ['mexicano', 'mexicana', 'mexican', 'taco', 'tacos', 'burrito'], n: ['Chipotle', 'Taco Stand', 'La Doña'], c: [] },
  { id: 'cafe', label: 'Café', ico: '☕', food: true, k: ['cafe', 'coffee', 'cafeteria'],
    n: ['Starbucks', "Dunkin'", 'Juan Valdez', "Paul's Bakery", 'Komma Tea', 'Grand Lux'], c: [] },
  { id: 'sorvete', label: 'Sorvete', ico: '🍦', food: true, k: ['sorvete', 'sorvetes', 'gelato', 'ice cream', 'helado', 'acai'], n: ['Häagen', 'Baskin', 'Baked Bear', 'MiaFruta'], c: [] },
  { id: 'carne', label: 'Churrasco e carnes', ico: '🥩', food: true, k: ['churrasco', 'churrascaria', 'carne', 'steak', 'asado', 'picanha'],
    n: ['Texas de Brazil', 'Argentinian', 'Seasons 52', 'Rainforest', 'Charleys'], c: [] },
  { id: 'frango', label: 'Frango', ico: '🍗', food: true, k: ['frango', 'chicken', 'pollo'], n: ['Popeyes', "Kelly's Cajun", 'Charleys', "Baba's Halal"], c: [] },
  { id: 'saudavel', label: 'Saudável', ico: '🥗', food: true, k: ['salada', 'saudavel', 'vegano', 'vegetariano', 'salad', 'healthy', 'vegan', 'suco', 'jugo'],
    n: ["Green Leaf's", 'Pure Green', 'MiaFruta', 'Seasons 52', "Osmow's"], c: [] },
  { id: 'latina', label: 'Latino', ico: '🫓', food: true, k: ['latino', 'latina', 'colombiano', 'arepa', 'empanada', 'empanadas', 'peruano', 'ceviche'],
    n: ['Arepasmania', 'Argentinian Empanadas', 'Don Jediondo', 'CVI.CHE', 'Juan Valdez'], c: [] },
  { id: 'peixe', label: 'Frutos do mar', ico: '🦐', food: true, k: ['frutos do mar', 'peixe', 'seafood', 'camarao', 'mariscos', 'pescado'], n: ['La Doña', 'CVI.CHE', 'Seasons 52', 'Yard House'], c: [] },
];

// atalhos mostrados na busca (sem nada digitado)
export const QUICK = ['malas', 'perfume', 'tenis', 'oculos', 'relogio', 'eletronicos', 'brinquedos', 'infantil', 'pizza', 'burger', 'asiatica', 'cafe', 'sorvete'];

for (const t of TOPICS) { t.nk = t.k.map(norm); t.nn = t.n.map(norm); t.nc = t.c.map(norm); }
export const topicById = (id) => TOPICS.find((t) => t.id === id) || null;

// assunto da busca: "malas", "mala de viagem", "tenis infantil" (o primeiro que bate)
export function findTopic(q) {
  const nq = norm(q || '').trim();
  if (nq.length < 3) return null;
  for (const t of TOPICS) {
    const lab = norm(tx(t.label));   // nome do assunto no idioma do app (francês, alemão, chinês…)
    if (lab && (lab === nq || (nq.length >= 4 && lab.startsWith(nq)))) return t;
    if (t.nk.some((k) => k === nq || (nq.length >= 4 && (k.startsWith(nq) || nq.startsWith(k + ' ') || nq.startsWith(k))))) return t;
  }
  return null;
}

const NOT_STORE = new Set(['Facilidades', 'Entradas', 'Estacionamento']);   // "Banheiros · Burlington" não vende nada
export const topicHas = (t, p) => {
  if (NOT_STORE.has(p.group)) return false;
  const n = norm(p.name), c = norm(p.cat || '');
  return t.nn.some((x) => n.includes(x)) || t.nc.some((x) => c.includes(x));
};
