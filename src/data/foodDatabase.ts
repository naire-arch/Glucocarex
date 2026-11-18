import type { FoodItem, GlycemicIndexBand } from '../types/diabetes';

/**
 * Approximate carbohydrate and glycemic index values for common foods and
 * East African / Kenyan staples. Portions are typical household servings.
 *
 * IMPORTANT: composition varies with recipe, ripeness and cooking method.
 * These figures are estimates for education; always confirm with a dietitian
 * or the product label.
 */

export function giBandFor(gi: number): GlycemicIndexBand {
  if (gi <= 55) return 'low';
  if (gi <= 69) return 'medium';
  return 'high';
}

type FoodSeed = Omit<FoodItem, 'giBand'>;

const seeds: FoodSeed[] = [
  // ---- East African staples & dishes --------------------------------------
  { id: 'ugali', name: 'Ugali (maize meal)', aliases: ['sima', 'nsima', 'posho', 'maize porridge stiff'], category: 'staple', region: 'east-african', servingLabel: '1 medium serving (250 g)', servingGrams: 250, carbsPerServingG: 50, gi: 70 },
  { id: 'chapati', name: 'Chapati', aliases: ['chapo', 'flatbread'], category: 'staple', region: 'east-african', servingLabel: '1 medium chapati (80 g)', servingGrams: 80, carbsPerServingG: 31, gi: 62 },
  { id: 'mandazi', name: 'Mandazi', aliases: ['mandaazi', 'maandazi', 'swahili doughnut', 'fried dough'], category: 'snack', region: 'east-african', servingLabel: '1 piece (60 g)', servingGrams: 60, carbsPerServingG: 26, gi: 68 },
  { id: 'mahamri', name: 'Mahamri', aliases: ['mamri', 'coconut bread', 'mahamri coconut'], category: 'snack', region: 'east-african', servingLabel: '1 piece (70 g)', servingGrams: 70, carbsPerServingG: 30, gi: 70 },
  { id: 'githeri', name: 'Githeri (maize and beans)', aliases: ['muthokoi', 'mixed maize beans', 'githeri'], category: 'legume', region: 'east-african', servingLabel: '1 cup (200 g)', servingGrams: 200, carbsPerServingG: 35, gi: 48 },
  { id: 'sukuma-wiki', name: 'Sukuma wiki (sauteed kale)', aliases: ['kale', 'collard greens', 'sukuma'], category: 'vegetable', region: 'east-african', servingLabel: '1 cup (100 g)', servingGrams: 100, carbsPerServingG: 5, gi: 15 },
  { id: 'mchicha', name: 'Mchicha (amaranth / spinach)', aliases: ['spinach', 'terere', 'amaranth greens'], category: 'vegetable', region: 'east-african', servingLabel: '1 cup (100 g)', servingGrams: 100, carbsPerServingG: 4, gi: 15 },
  { id: 'kabichi', name: 'Kabichi (fried cabbage)', aliases: ['cabbage', 'cabbage stir fry'], category: 'vegetable', region: 'east-african', servingLabel: '1 cup (100 g)', servingGrams: 100, carbsPerServingG: 5, gi: 15 },
  { id: 'kachumbari', name: 'Kachumbari (tomato and onion salad)', aliases: ['tomato onion salad', 'salad'], category: 'vegetable', region: 'east-african', servingLabel: '1/2 cup (100 g)', servingGrams: 100, carbsPerServingG: 5, gi: 15 },
  { id: 'pilau', name: 'Pilau (spiced rice)', aliases: ['pilao', 'spiced rice'], category: 'staple', region: 'east-african', servingLabel: '1 cup (200 g)', servingGrams: 200, carbsPerServingG: 45, gi: 65 },
  { id: 'mukimo', name: 'Mukimo (mashed potato, greens, maize)', aliases: ['irio', 'mashed greens', 'kikuyu mash'], category: 'staple', region: 'east-african', servingLabel: '1 cup (200 g)', servingGrams: 200, carbsPerServingG: 38, gi: 60 },
  { id: 'matoke', name: 'Matoke (steamed green plantain)', aliases: ['ndizi', 'cooking banana', 'plantain', 'ndizi nyama'], category: 'staple', region: 'east-african', servingLabel: '1 cup (150 g)', servingGrams: 150, carbsPerServingG: 40, gi: 55 },
  { id: 'maharagwe', name: 'Maharagwe (bean stew)', aliases: ['beans', 'kidney beans', 'njahi', 'rajma'], category: 'legume', region: 'east-african', servingLabel: '1 cup (180 g)', servingGrams: 180, carbsPerServingG: 27, gi: 30 },
  { id: 'ndengu', name: 'Ndengu (green gram stew)', aliases: ['green grams', 'mung beans', 'dengu'], category: 'legume', region: 'east-african', servingLabel: '1 cup (180 g)', servingGrams: 180, carbsPerServingG: 25, gi: 38 },
  { id: 'wali', name: 'Wali (boiled white rice)', aliases: ['rice', 'mchele', 'white rice'], category: 'staple', region: 'east-african', servingLabel: '1 cup cooked (160 g)', servingGrams: 160, carbsPerServingG: 45, gi: 73 },
  { id: 'viazi-vitamu', name: 'Viazi vitamu (boiled sweet potato)', aliases: ['sweet potato', 'orange sweet potato'], category: 'staple', region: 'east-african', servingLabel: '1 medium (130 g)', servingGrams: 130, carbsPerServingG: 26, gi: 63 },
  { id: 'viazi', name: 'Viazi (boiled Irish potato)', aliases: ['potato', 'irish potato', 'boiled potato'], category: 'staple', region: 'east-african', servingLabel: '1 medium (150 g)', servingGrams: 150, carbsPerServingG: 26, gi: 78 },
  { id: 'muhogo', name: 'Muhogo (boiled cassava)', aliases: ['cassava', 'mihogo', 'manioc'], category: 'staple', region: 'east-african', servingLabel: '1 piece (100 g)', servingGrams: 100, carbsPerServingG: 38, gi: 65 },
  { id: 'nduma', name: 'Nduma (boiled arrowroot)', aliases: ['arrowroot', 'arrow root'], category: 'staple', region: 'east-african', servingLabel: '1 piece (100 g)', servingGrams: 100, carbsPerServingG: 22, gi: 62 },
  { id: 'mahindi-choma', name: 'Mahindi choma (roasted maize)', aliases: ['corn on the cob', 'roast maize', 'boiled maize', 'sweetcorn'], category: 'staple', region: 'east-african', servingLabel: '1 cob (150 g)', servingGrams: 150, carbsPerServingG: 27, gi: 52 },
  { id: 'uji', name: 'Uji (maize or millet porridge)', aliases: ['porridge', 'wimbi', 'millet porridge', 'sorghum porridge'], category: 'drink', region: 'east-african', servingLabel: '1 cup (250 ml)', servingGrams: 250, carbsPerServingG: 24, gi: 70 },
  { id: 'chai', name: 'Chai (milk tea, 1 tsp sugar)', aliases: ['tea', 'milk tea', 'chai ya maziwa'], category: 'drink', region: 'east-african', servingLabel: '1 cup (200 ml)', servingGrams: 200, carbsPerServingG: 9, gi: 40 },
  { id: 'maziwa-lala', name: 'Maziwa lala (fermented milk)', aliases: ['mala', 'fermented milk', 'sour milk'], category: 'dairy', region: 'east-african', servingLabel: '1 cup (250 ml)', servingGrams: 250, carbsPerServingG: 12, gi: 35 },
  { id: 'samosa', name: 'Samosa (meat)', aliases: ['sambusa', 'samosas'], category: 'snack', region: 'east-african', servingLabel: '1 piece (70 g)', servingGrams: 70, carbsPerServingG: 18, gi: 60 },
  { id: 'bhajia', name: 'Bhajia (potato fritters)', aliases: ['bajia', 'kamukunji', 'potato bhajia'], category: 'snack', region: 'east-african', servingLabel: '1 serving (100 g)', servingGrams: 100, carbsPerServingG: 24, gi: 60 },
  { id: 'chips', name: 'Chips (french fries)', aliases: ['fries', 'chips mayai', 'french fries'], category: 'snack', region: 'east-african', servingLabel: '1 portion (150 g)', servingGrams: 150, carbsPerServingG: 50, gi: 75 },
  { id: 'nyama-choma', name: 'Nyama choma (grilled beef or goat)', aliases: ['grilled meat', 'roast meat', 'beef', 'goat meat', 'nyama'], category: 'protein', region: 'east-african', servingLabel: '1 portion (150 g)', servingGrams: 150, carbsPerServingG: 0, gi: 0 },
  { id: 'samaki', name: 'Samaki (fried tilapia)', aliases: ['fish', 'tilapia', 'fried fish', 'omena'], category: 'protein', region: 'east-african', servingLabel: '1 fillet (150 g)', servingGrams: 150, carbsPerServingG: 4, gi: 0 },
  { id: 'kuku', name: 'Kuku (chicken stew or grilled)', aliases: ['chicken', 'kuku choma'], category: 'protein', region: 'east-african', servingLabel: '1 portion (150 g)', servingGrams: 150, carbsPerServingG: 3, gi: 0 },
  { id: 'mayai', name: 'Mayai (boiled egg)', aliases: ['egg', 'eggs', 'boiled egg', 'omelette'], category: 'protein', region: 'east-african', servingLabel: '1 large egg', servingGrams: 50, carbsPerServingG: 1, gi: 0 },
  { id: 'avocado', name: 'Parachichi (avocado)', aliases: ['avocado', 'avo'], category: 'fruit', region: 'east-african', servingLabel: '1/2 fruit (100 g)', servingGrams: 100, carbsPerServingG: 2, gi: 15 },
  { id: 'ndizi-mbivu', name: 'Ndizi mbivu (ripe banana)', aliases: ['banana', 'ripe banana'], category: 'fruit', region: 'east-african', servingLabel: '1 medium (120 g)', servingGrams: 120, carbsPerServingG: 27, gi: 51 },
  { id: 'embe', name: 'Embe (mango)', aliases: ['mango', 'maembe'], category: 'fruit', region: 'east-african', servingLabel: '1 cup sliced (165 g)', servingGrams: 165, carbsPerServingG: 25, gi: 51 },
  { id: 'papai', name: 'Papai (pawpaw / papaya)', aliases: ['pawpaw', 'papaya'], category: 'fruit', region: 'east-african', servingLabel: '1 cup (150 g)', servingGrams: 150, carbsPerServingG: 16, gi: 60 },
  { id: 'chungwa', name: 'Chungwa (orange)', aliases: ['orange', 'machungwa'], category: 'fruit', region: 'east-african', servingLabel: '1 medium (130 g)', servingGrams: 130, carbsPerServingG: 15, gi: 43 },
  { id: 'tikiti', name: 'Tikiti maji (watermelon)', aliases: ['watermelon'], category: 'fruit', region: 'east-african', servingLabel: '1 slice (150 g)', servingGrams: 150, carbsPerServingG: 11, gi: 72 },
  { id: 'nanasi', name: 'Nanasi (pineapple)', aliases: ['pineapple'], category: 'fruit', region: 'east-african', servingLabel: '1 cup (165 g)', servingGrams: 165, carbsPerServingG: 20, gi: 59 },

  // ---- Common foods --------------------------------------------------------
  { id: 'bread-white', name: 'White bread', aliases: ['bread', 'mkate', 'sandwich bread'], category: 'staple', region: 'common', servingLabel: '1 slice (30 g)', servingGrams: 30, carbsPerServingG: 15, gi: 75 },
  { id: 'bread-brown', name: 'Brown / wholemeal bread', aliases: ['brown bread', 'whole wheat bread', 'wholemeal'], category: 'staple', region: 'common', servingLabel: '1 slice (30 g)', servingGrams: 30, carbsPerServingG: 13, gi: 58 },
  { id: 'pasta', name: 'Spaghetti / pasta (cooked)', aliases: ['spaghetti', 'macaroni', 'noodles'], category: 'staple', region: 'common', servingLabel: '1 cup cooked (140 g)', servingGrams: 140, carbsPerServingG: 40, gi: 49 },
  { id: 'oats', name: 'Oatmeal porridge', aliases: ['oats', 'oatmeal', 'rolled oats'], category: 'staple', region: 'common', servingLabel: '1 cup (240 g)', servingGrams: 240, carbsPerServingG: 27, gi: 55 },
  { id: 'milk', name: 'Milk (whole)', aliases: ['maziwa', 'fresh milk'], category: 'dairy', region: 'common', servingLabel: '1 cup (250 ml)', servingGrams: 250, carbsPerServingG: 12, gi: 30 },
  { id: 'yogurt', name: 'Plain yogurt', aliases: ['yoghurt', 'mtindi', 'natural yogurt'], category: 'dairy', region: 'common', servingLabel: '1 pot (200 g)', servingGrams: 200, carbsPerServingG: 10, gi: 35 },
  { id: 'apple', name: 'Apple', aliases: ['tufaha'], category: 'fruit', region: 'common', servingLabel: '1 medium (180 g)', servingGrams: 180, carbsPerServingG: 22, gi: 38 },
  { id: 'groundnuts', name: 'Groundnuts / peanuts', aliases: ['karanga', 'peanuts', 'nuts'], category: 'snack', region: 'common', servingLabel: '1 handful (30 g)', servingGrams: 30, carbsPerServingG: 5, gi: 14 },
  { id: 'biscuits', name: 'Digestive biscuits', aliases: ['biscuit', 'cookies', 'crackers'], category: 'snack', region: 'common', servingLabel: '2 biscuits (30 g)', servingGrams: 30, carbsPerServingG: 20, gi: 55 },
  { id: 'sugar', name: 'Sugar (added)', aliases: ['sukari', 'table sugar'], category: 'snack', region: 'common', servingLabel: '1 teaspoon (4 g)', servingGrams: 4, carbsPerServingG: 4, gi: 65 },
  { id: 'juice', name: 'Fruit juice', aliases: ['juisi', 'orange juice', 'mango juice'], category: 'drink', region: 'common', servingLabel: '1 glass (250 ml)', servingGrams: 250, carbsPerServingG: 26, gi: 50 },
  { id: 'soda', name: 'Soda (regular)', aliases: ['soda', 'cola', 'fizzy drink', 'fanta', 'sprite'], category: 'drink', region: 'common', servingLabel: '1 bottle (300 ml)', servingGrams: 300, carbsPerServingG: 32, gi: 63 },
];

export const FOODS: FoodItem[] = seeds.map((s) => ({ ...s, giBand: giBandFor(s.gi) }));

export function getFoodById(id: string): FoodItem | undefined {
  return FOODS.find((f) => f.id === id);
}

/** Case-insensitive search across names and aliases. Empty query returns the East African staples first. */
export function searchFoods(query: string, limit = 12): FoodItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return [...FOODS]
      .sort((a, b) => (a.region === b.region ? 0 : a.region === 'east-african' ? -1 : 1))
      .slice(0, limit);
  }
  const scored = FOODS.map((food) => {
    const name = food.name.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (food.aliases.some((a) => a.toLowerCase().includes(q))) score = 1;
    return { food, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.food);
}
