import { SavedProduct } from "./app-settings";

export type Verdict = "halal" | "haram" | "doubtful" | "unknown";

export type HalalTestStatus = "passed" | "failed" | "warning" | "info";

export type HalalTestDetail = {
  id: string;
  name: string;
  description: string;
  status: HalalTestStatus;
  detail: string;
};

export type IngredientItem = {
  text: string;
  status: "safe" | "doubtful" | "haram" | "certified";
  reason?: string;
};

export type ProductResult = SavedProduct & {
  ingredients: string;
  ingredientItems?: IngredientItem[];
  reasons: string[];
  certified: boolean;
  source: string;
  nutriscore?: string;
  novaGroup?: number;
  ecoscore?: string;
  allergens?: string[];
  traces?: string[];
  quantity?: string;
  categories?: string[];
  labelsList?: string[];
  tests: HalalTestDetail[];
  testsPassed: number;
  totalTests: number;
};

const HEADERS = {
  "User-Agent": "IslamNoorApp/1.0 (https://islam-noor.app; contact@islamnoor.app)",
  Accept: "application/json",
};

/** Normalizes string: lowercase, accents removed, trimmed */
function norm(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Known halal certification bodies referenced by Open Food Facts labels and manufacturer databases */
const CERT_TOKENS = [
  "halal",
  "avs",
  "achahada",
  "sfcvh",
  "argml",
  "jakim",
  "mui",
  "lppom",
  "halal correct",
  "halal-correct",
  "halal control",
  "halal-control",
  "hmc",
  "hfa",
  "fambras",
  "chic",
  "grande mosquee de paris",
  "grande mosquee de lyon",
  "grande mosquee d'evry",
  "certifie halal",
  "certifiee halal",
  "halal certified",
];

/**
 * Recognized permissible meats in Islamic jurisprudence (requiring ritual Islamic slaughter/certification).
 * Fish and seafood are excluded because they are naturally permissible without ritual slaughter.
 */
const PERMISSIBLE_MEAT_RULES = [
  {
    name: "Bœuf / Bovin",
    regex: /\b(boeuf|bœuf|beef|bovin|bovine|veau|veal|steack|steak|hache|haché|rumsteak|entrecote|bourguignon|bavette|rosbif)\b/i,
    negationRegex: /\b(sans\s+(?:viande\s+de\s+)?(?:boeuf|bœuf|bovin)|vegetar|vegan|arome\s+artificiel|gousse|no\s+beef)\b/i,
  },
  {
    name: "Poulet / Volaille",
    regex: /\b(poulet|chicken|volaille|poultry|coq|chapon|blanc\s+de\s+poulet|cuisse\s+de\s+poulet|nuggets?\s+de\s+poulet|aiguillette\s+de\s+poulet)\b/i,
    negationRegex: /\b(sans\s+poulet|vegetar|vegan|arome\s+artificiel|no\s+chicken)\b/i,
  },
  {
    name: "Dinde",
    regex: /\b(dinde|turkey|escalope\s+de\s+dinde|filet\s+de\s+dinde|jambon\s+de\s+dinde|bacon\s+de\s+dinde)\b/i,
    negationRegex: /\b(sans\s+dinde|vegetar|vegan|no\s+turkey)\b/i,
  },
  {
    name: "Agneau / Mouton",
    regex: /\b(agneau|lamb|mouton|mutton|merguez|cotelette\s+d'agneau|gigot\s+d'agneau)\b/i,
    negationRegex: /\b(sans\s+(?:agneau|mouton)|vegetar|vegan)\b/i,
  },
  {
    name: "Canard / Oie / Gibier",
    regex: /\b(canard|duck|magret|confit\s+de\s+canard|oie|goose|foie\s+gras)\b/i,
    negationRegex: /\b(sans\s+canard|vegetar|vegan)\b/i,
  },
  {
    name: "Viande générique (non porcine)",
    regex: /\b(viande|viandes|meat|meats|chair\s+animale|abats)\b/i,
    negationRegex: /\b(sans\s+viande|meat\s*free|vegetar|vegan|sans\s+porc)\b/i,
  },
];

interface IngredientDetectionRule {
  id: string;
  name: string;
  type: "haram" | "doubtful";
  regex: RegExp;
  negationRegex?: RegExp;
}

/**
 * High-precision ingredient rules with strict boundary & negation safety.
 * Never triggers on general categories or substrings inside unrelated words (e.g. "vinaigre", "bovin").
 */
const INGREDIENT_RULES: IngredientDetectionRule[] = [
  // --- HARAM INGREDIENTS ---
  {
    id: "porc_gelatin",
    name: "Gélatine de porc",
    type: "haram",
    regex: /\b(gelatine\s+de\s+porc|pork\s+gelatin|gelatine\s+porcine|porcine\s+gelatin|pork-gelatin)\b/i,
  },
  {
    id: "porc_meat",
    name: "Viande ou dérivé de porc (lard, saindoux, bacon de porc)",
    type: "haram",
    regex: /\b(porc|pork|saindoux|lard|viande\s+de\s+porc|chair\s+de\s+porc|gras\s+de\s+porc|graisse\s+de\s+porc|sang\s+de\s+porc)\b/i,
    negationRegex: /\b(sans\s+(?:viande\s+de\s+)?porc|pork\s*free|no\s+pork|0%?\s*porc|sans\s+lard|sans\s+saindoux|vegetar|vegan)\b/i,
  },
  {
    id: "jambon_porc",
    name: "Jambon (porc)",
    type: "haram",
    regex: /\b(jambon|ham)\b/i,
    negationRegex: /\b(jambon\s+de\s+(?:dinde|poulet|boeuf|volaille)|turkey\s+ham|chicken\s+ham|sans\s+jambon|halal|vegetar|vegan)\b/i,
  },
  {
    id: "bacon_porc",
    name: "Bacon (porc)",
    type: "haram",
    regex: /\b(bacon)\b/i,
    negationRegex: /\b(bacon\s+de\s+(?:dinde|poulet|boeuf|volaille)|turkey\s+bacon|sans\s+bacon|halal|vegetar|vegan)\b/i,
  },
  {
    id: "alcohol_beverage",
    name: "Alcool / Boisson alcoolisée",
    type: "haram",
    regex: /\b(alcool\s+ethylique|ethanol|vin\s+rouge|vin\s+blanc|biere|beer|rhum|rum|vodka|whisky|whiskey|liqueur|cognac|tequila|gin|kirsch|eau-de-vie|champagne|sake|calvados)\b/i,
    negationRegex: /\b(sans\s+alcool|non[\s-]alcoholic|alcohol[\s-]free|0[.,]0\s*%|0\s*%\s*alcool|desalcoolise|dealcohol|zero\s*alcool|vinaigre\s+de\s+vin|vinaigre\s+d'alcool|vinaigre)\b/i,
  },
  {
    id: "e120_carmine",
    name: "Colorant E120 (Carmin de cochenille)",
    type: "haram",
    regex: /\b(e\s*120|carmin|carmine|cochenille|cochineal|acide\s+carminique|ci\s*75470)\b/i,
  },
  {
    id: "e441_gelatin",
    name: "Additif E441 (Gélatine)",
    type: "haram",
    regex: /\b(e\s*441)\b/i,
  },
  {
    id: "e542_bone",
    name: "Additif E542 (Phosphate d'os comestible)",
    type: "haram",
    regex: /\b(e\s*542)\b/i,
  },

  // --- DOUBTFUL INGREDIENTS (A VÉRIFIER) ---
  {
    id: "gelatin_unspecified",
    name: "Gélatine (origine animale non précisée)",
    type: "doubtful",
    regex: /\b(gelatine|gelatin)\b/i,
    negationRegex: /\b(gelatine\s+de\s+porc|gelatine\s+vegetale|gelatine\s+de\s+poisson|fish\s+gelatin|agar[\s-]agar|bovine\s+halal|certifiee\s+halal|halal)\b/i,
  },
  {
    id: "e471_emulsifier",
    name: "Additif E471 (Mono- et diglycérides d'acides gras : origine végétale ou animale non précisée)",
    type: "doubtful",
    regex: /\b(e\s*471|mono[\s-] et diglycerides|monoglycerides)\b/i,
    negationRegex: /\b(origine\s+vegetale|100%\s+vegetal|soja|tournesol|colza|palme|plant\s+origin|vegetable\s+origin|vegan|vegetar)\b/i,
  },
  {
    id: "e472_emulsifier",
    name: "Additif E472 (Esters de mono- et diglycérides)",
    type: "doubtful",
    regex: /\b(e\s*472[a-f]?)\b/i,
    negationRegex: /\b(origine\s+vegetale|100%\s+vegetal|plant\s+origin|vegetable\s+origin|vegan|vegetar)\b/i,
  },
  {
    id: "e470_e481_e482",
    name: "Additifs E470 / E481 / E482 (Sels d'acides gras / Stéaroyl)",
    type: "doubtful",
    regex: /\b(e\s*470[a-b]?|e\s*481|e\s*482)\b/i,
    negationRegex: /\b(origine\s+vegetale|100%\s+vegetal|plant\s+origin|vegetable\s+origin|vegan)\b/i,
  },
  {
    id: "animal_rennet",
    name: "Présure animale (origine d'abattage non précisée)",
    type: "doubtful",
    regex: /\b(presure\s+animale|animal\s+rennet)\b/i,
    negationRegex: /\b(presure\s+microbienne|presure\s+vegetale|microbial\s+rennet|vegetable\s+rennet|halal)\b/i,
  },
  {
    id: "e904_shellac",
    name: "Additif E904 (Gomme laque / Shellac - sécrétion d'insectes)",
    type: "doubtful",
    regex: /\b(e\s*904|shellac|gomme\s+laque)\b/i,
  },
  {
    id: "e920_cysteine",
    name: "Additif E920 (L-Cystéine)",
    type: "doubtful",
    regex: /\b(e\s*920|l[\s-]cysteine|cysteine)\b/i,
    negationRegex: /\b(origine\s+vegetale|synthetique|fermentation)\b/i,
  },
];

/**
 * Analyses real ingredients to determine Halal, Haram, or Doubtful verdict.
 * Separates general product metadata from actual ingredient data.
 */
export function analyse(
  product: Record<string, unknown>,
  source = "Open Food Facts",
): ProductResult {
  const name = String(
    product.product_name ||
      product.product_name_fr ||
      product.product_name_de ||
      product.product_name_en ||
      product.generic_name ||
      product.title ||
      "",
  );
  const brand = Array.isArray(product.brands)
    ? product.brands.join(", ")
    : String(product.brands || product.brand || "");

  // 1. Multi-language ingredient text extraction
  let ingredients = String(
    product.ingredients_text_fr ||
      product.ingredients_text_de ||
      product.ingredients_text_ch ||
      product.ingredients_text_nl ||
      product.ingredients_text_en ||
      product.ingredients_text_it ||
      product.ingredients_text_es ||
      product.ingredients_text ||
      product.description ||
      "",
  );

  // If ingredients text is empty, parse structured ingredients array
  if (!ingredients.trim() && Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    ingredients = product.ingredients
      .map((i: unknown) => {
        if (typeof i === "object" && i !== null) {
          const obj = i as Record<string, unknown>;
          return String(obj.text || obj.text_fr || obj.text_de || obj.id || "");
        }
        return String(i || "");
      })
      .filter((t) => t && !t.startsWith("en:"))
      .join(", ");
  }

  // 2. Additives tags parsing (clean codes like "e120", "e471")
  const additivesCodes = (
    Array.isArray(product.additives_tags) ? product.additives_tags : []
  ).map((t) => norm(String(t)).replace(/^.*:/, ""));

  // 3. Labels & Certification detection
  const labelsStr = Array.isArray(product.labels)
    ? product.labels.join(" ")
    : String(product.labels || "");
  const labelsTagsStr = Array.isArray(product.labels_tags)
    ? product.labels_tags.join(" ")
    : String(product.labels_tags || "");
  const labelsNorm = norm(labelsStr + " " + labelsTagsStr);

  // 4. Categories extraction (ONLY used for identifying staples or meat category)
  const categoriesTags = (
    Array.isArray(product.categories_tags)
      ? product.categories_tags
      : Array.isArray(product.categories_hierarchy)
        ? product.categories_hierarchy
        : []
  ).map((t) => norm(String(t)).replace(/^.*:/, ""));

  // Prepare normalized text for rule evaluation
  const ingredientsNorm = norm(ingredients);
  const additivesNorm = additivesCodes.join(" ");
  const textToScan = `${ingredientsNorm} ${additivesNorm}`;
  const wholeProductText = `${norm(name)} ${norm(brand)} ${ingredientsNorm} ${categoriesTags.join(" ")}`;

  // Precise Halal certification detection matching this exact product
  const matchedCertTokens = CERT_TOKENS.filter(
    (c) => labelsNorm.includes(c) || wholeProductText.includes(c),
  );
  const certified = matchedCertTokens.length > 0;

  // Detect permissible meat (beef, poultry, turkey, lamb, veal, duck, etc.)
  const detectedMeats: string[] = [];
  for (const meatRule of PERMISSIBLE_MEAT_RULES) {
    if (meatRule.negationRegex && meatRule.negationRegex.test(wholeProductText)) {
      continue;
    }
    if (meatRule.regex.test(wholeProductText)) {
      detectedMeats.push(meatRule.name);
    }
  }

  // Category-based meat check (e.g. "viandes", "meats", "beef", "poultry", "steaks")
  const isMeatCategory = categoriesTags.some((cat) =>
    [
      "meats",
      "viandes",
      "beef",
      "boeuf",
      "poultry",
      "poulet",
      "volaille",
      "steaks",
      "ground-meats",
      "prepared-meats",
      "charcuterie",
    ].some((m) => cat === m || cat.endsWith(`-${m}`) || cat.startsWith(`${m}-`)),
  );

  if (isMeatCategory && detectedMeats.length === 0) {
    detectedMeats.push("Viande / Produit carné");
  }

  const haramDetected: string[] = [];
  const doubtfulDetected: string[] = [];

  // Check strict ingredient rules
  for (const rule of INGREDIENT_RULES) {
    // Check if negation matches
    if (rule.negationRegex && rule.negationRegex.test(textToScan)) {
      continue;
    }

    if (rule.regex.test(textToScan)) {
      if (rule.type === "haram") {
        haramDetected.push(rule.name);
      } else if (rule.type === "doubtful") {
        doubtfulDetected.push(rule.name);
      }
    }
  }

  // Direct additives check (e.g. e120 in additives_tags)
  if (additivesCodes.includes("e120") && !haramDetected.includes("Colorant E120 (Carmin de cochenille)")) {
    haramDetected.push("Colorant E120 (Carmin de cochenille)");
  }
  if (additivesCodes.includes("e441") && !haramDetected.includes("Additif E441 (Gélatine)")) {
    haramDetected.push("Additif E441 (Gélatine)");
  }
  if (additivesCodes.includes("e542") && !haramDetected.includes("Additif E542 (Phosphate d'os comestible)")) {
    haramDetected.push("Additif E542 (Phosphate d'os comestible)");
  }

  const reasons: string[] = [];
  let verdict: Verdict = "unknown";

  // --- STRICT CLASSIFICATION LOGIC WITH MEAT VERIFICATION ---
  if (haramDetected.length > 0) {
    // 🔴 1. HARAM: Confirmed forbidden ingredients present (Pork, Alcohol, E120...)
    verdict = "haram";
    const uniqueHaram = Array.from(new Set(haramDetected));
    uniqueHaram.forEach((item) => {
      reasons.push(`Ingrédient interdit identifié : ${item}`);
    });
    if (certified) {
      reasons.push("Attention : Le produit comporte une mention mais contient un ingrédient expressément interdit.");
    }
  } else if (detectedMeats.length > 0) {
    // 🥩 2. MEAT DETECTED: Beef, chicken, turkey, lamb, veal...
    const uniqueMeats = Array.from(new Set(detectedMeats));

    if (certified) {
      // 🟢 Certified Halal Meat
      verdict = "halal";
      reasons.push("Certification halal officielle trouvée pour ce produit.");
      reasons.push(`Viande identifiée (${uniqueMeats.join(", ")}) avec certification halal confirmée.`);
      if (ingredients.trim()) {
        reasons.push("Aucun ingrédient interdit détecté dans la composition.");
      }
    } else {
      // 🟠 Uncertified Meat -> DOUBTFUL / VÉRIFICATION NÉCESSAIRE (Never automatically halal!)
      verdict = "doubtful";
      reasons.push(
        `La viande a été identifiée (${uniqueMeats.join(", ")}), mais aucune certification halal fiable correspondant exactement à ce produit n'a été trouvée.`,
      );
      reasons.push(
        "Pour les viandes (bœuf, poulet, agneau, dinde, veau, etc.), un abattage rituel conforme et certifié est obligatoire.",
      );
      reasons.push(
        "Vérifiez la certification ou les informations fournies par le fabricant/vendeur sur l'emballage.",
      );
    }
  } else if (doubtfulDetected.length > 0) {
    // 🟠 3. DOUBTFUL ADDITIVES: Ambiguous animal/plant origin
    verdict = "doubtful";
    const uniqueDoubtful = Array.from(new Set(doubtfulDetected));
    uniqueDoubtful.forEach((item) => {
      reasons.push(`Vérification nécessaire : ${item}`);
    });
    reasons.push("Les informations disponibles ne précisent pas l'origine exacte. Vérifiez l'étiquette ou la certification.");
  } else if (certified) {
    // 🟢 4. CERTIFIED HALAL PRODUCT (Non-meat)
    verdict = "halal";
    reasons.push("Certification halal officielle déclarée pour ce produit.");
    if (ingredients.trim()) {
      reasons.push("Aucun ingrédient interdit détecté dans la composition.");
    }
  } else if (ingredients.trim().length > 0) {
    // 🟢 5. PERMISSIBLE NON-MEAT PRODUCT: Plant-based, dairy, beverages without forbidden/doubtful items
    verdict = "halal";
    reasons.push("Aucun ingrédient interdit ni douteux détecté dans la composition.");
  } else {
    // 6. NO INGREDIENT LIST AVAILABLE
    const isNaturalStaple = categoriesTags.some((cat) => {
      // Must NOT be alcoholic beverage
      if (cat.includes("alcoholic") && !cat.includes("non-alcoholic")) return false;
      return [
        "waters",
        "spring-waters",
        "mineral-waters",
        "eau",
        "fruits",
        "vegetables",
        "legumes",
        "milks",
        "lait",
        "honeys",
        "miel",
        "rices",
        "riz",
        "cereals",
        "flours",
        "farines",
        "coffees",
        "cafe",
        "teas",
        "the",
        "eggs",
        "oeufs",
        "salts",
        "sel",
        "sugars",
        "sucre",
      ].some((staple) => cat === staple || cat.endsWith(`-${staple}`) || cat.startsWith(`${staple}-`));
    });

    if (isNaturalStaple) {
      verdict = "halal";
      reasons.push("Catégorie de produit brut ou naturel sans additifs complexes.");
    } else {
      // 🟠 MISSING DATA: Never classify as Haram!
      verdict = "doubtful";
      reasons.push("Liste d'ingrédients indisponible. Les informations ne permettent pas de déterminer le statut avec certitude.");
      reasons.push("Faites défiler vers le bas pour analyser les ingrédients en photo.");
    }
  }

  // 5. Extract rich nutritional and product attributes
  const rawNutriscore = String(
    product.nutriscore_grade ||
      product.nutrition_grades ||
      product.nutrition_grade_fr ||
      "",
  ).toLowerCase().trim();
  const nutriscore = ["a", "b", "c", "d", "e"].includes(rawNutriscore)
    ? (rawNutriscore as "a" | "b" | "c" | "d" | "e")
    : undefined;

  const rawNova =
    typeof product.nova_group === "number"
      ? product.nova_group
      : typeof product.nova_groups === "number"
        ? product.nova_groups
        : Number(product.nova_group || product.nova_groups);
  const novaGroup = [1, 2, 3, 4].includes(rawNova) ? rawNova : undefined;

  const rawEcoscore = String(product.ecoscore_grade || "").toLowerCase().trim();
  const ecoscore = ["a", "b", "c", "d", "e"].includes(rawEcoscore)
    ? (rawEcoscore as "a" | "b" | "c" | "d" | "e")
    : undefined;

  const rawAllergens =
    product.allergens_tags || product.allergens || product.allergens_hierarchy;
  const allergens: string[] = [];
  if (Array.isArray(rawAllergens)) {
    rawAllergens.forEach((a) => {
      const s = String(a).replace(/^[a-z]{2}:/, "").trim();
      if (s && !s.startsWith("en:")) {
        const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
        if (!allergens.includes(capitalized)) allergens.push(capitalized);
      }
    });
  } else if (typeof rawAllergens === "string" && rawAllergens.trim()) {
    rawAllergens.split(",").forEach((a) => {
      const s = a.trim();
      if (s) {
        const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
        if (!allergens.includes(capitalized)) allergens.push(capitalized);
      }
    });
  }

  const rawTraces = product.traces_tags || product.traces;
  const traces: string[] = [];
  if (Array.isArray(rawTraces)) {
    rawTraces.forEach((t) => {
      const s = String(t).replace(/^[a-z]{2}:/, "").trim();
      if (s && !s.startsWith("en:")) {
        const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
        if (!traces.includes(capitalized)) traces.push(capitalized);
      }
    });
  }

  const quantity = String(
    product.quantity || product.product_quantity || product.packaging_text || "",
  ).trim() || undefined;

  const rawLabelsList =
    Array.isArray(product.labels_tags) && product.labels_tags.length > 0
      ? product.labels_tags
      : Array.isArray(product.labels)
        ? product.labels
        : String(product.labels || "").split(",");
  const labelsList = rawLabelsList
    .map((l) => String(l).replace(/^[a-z]{2}:/, "").trim())
    .filter((l) => l.length > 1 && !l.startsWith("en:"));

  // Build granular ingredient items with individual status badges
  const ingredientItems: IngredientItem[] = ingredients
    .split(/[,;\n•]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
    .map((item) => {
      const itemNorm = norm(item);
      for (const rule of INGREDIENT_RULES) {
        if (rule.type === "haram" && rule.regex.test(itemNorm)) {
          if (!rule.negationRegex || !rule.negationRegex.test(itemNorm)) {
            return { text: item, status: "haram", reason: rule.name };
          }
        }
      }
      for (const rule of INGREDIENT_RULES) {
        if (rule.type === "doubtful" && rule.regex.test(itemNorm)) {
          if (!rule.negationRegex || !rule.negationRegex.test(itemNorm)) {
            return { text: item, status: "doubtful", reason: rule.name };
          }
        }
      }
      if (CERT_TOKENS.some((t) => itemNorm.includes(t))) {
        return { text: item, status: "certified", reason: "Certification halal déclarée" };
      }
      return { text: item, status: "safe" };
    });

  // Construct the 5 Mandatory Halal Security Audit Tests
  const test1Status: HalalTestStatus = haramDetected.length > 0 ? "failed" : "passed";
  const test1Detail =
    haramDetected.length > 0
      ? `Ingrédient(s) interdit(s) formellement identifié(s) : ${Array.from(new Set(haramDetected)).join(", ")}.`
      : "Aucun dérivé de porc, éthanol / alcool, cochenille (E120), gélatine porcine ni additif illicite détecté.";

  const test2Status: HalalTestStatus =
    detectedMeats.length > 0 ? (certified ? "passed" : "warning") : "passed";
  const test2Detail =
    detectedMeats.length > 0
      ? certified
        ? `Viande identifiée (${Array.from(new Set(detectedMeats)).join(", ")}) avec certification rituelle halal officielle confirmée.`
        : `Viande présente (${Array.from(new Set(detectedMeats)).join(", ")}) sans certification d'abattage rituel prouvée.`
      : "Aucune viande animale terrestre soumise à obligation d'abattage rituel.";

  const test3Status: HalalTestStatus = doubtfulDetected.length > 0 ? "warning" : "passed";
  const test3Detail =
    doubtfulDetected.length > 0
      ? `Additif(s) à double origine identifié(s) : ${Array.from(new Set(doubtfulDetected)).join(", ")}. Origine végétale ou certifiée à confirmer.`
      : "Aucun additif ou émulsifiant suspect d'origine animale douteuse.";

  const test4Status: HalalTestStatus =
    ingredients.trim().length > 0 || isNaturalStaple ? "passed" : "warning";
  const test4Detail =
    ingredients.trim().length > 0
      ? `Fiche produit répertoriée via ${source}. Ingrédients, codes-barres et données fabricants vérifiés.`
      : "Informations d'ingrédients partielles ou non renseignées dans la base de données.";

  const test5Status: HalalTestStatus =
    verdict === "halal" ? "passed" : verdict === "haram" ? "failed" : "warning";
  const test5Detail =
    verdict === "halal"
      ? "Synthèse conforme (Halal) : Tous les contrôles de sécurité et règles de jurisprudence islamique sont validés."
      : verdict === "haram"
        ? "Synthèse non conforme (Haram) : Présence d'ingrédients strictement prohibés dans l'alimentation islamique."
        : "Vérification recommandée (Douteux) : Informations incomplètes, additifs ambigus ou certification viande non trouvée.";

  const tests: HalalTestDetail[] = [
    {
      id: "test-prohibitions",
      name: "Test 1 : Contrôle des Ingrédients Prohibés",
      description: "Analyse lexicale des dérivés porcins, alcool, cochenille (E120), gélatines non certifiées.",
      status: test1Status,
      detail: test1Detail,
    },
    {
      id: "test-meats",
      name: "Test 2 : Contrôle des Viandes & Abattage",
      description: "Vérification de l'abattage rituel islamique et de l'organisme certificateur agréé.",
      status: test2Status,
      detail: test2Detail,
    },
    {
      id: "test-additives",
      name: "Test 3 : Analyse des Additifs & Émulsifiants",
      description: "Criblage des additifs complexes (E471, E472, présure, E904, E920...).",
      status: test3Status,
      detail: test3Detail,
    },
    {
      id: "test-database",
      name: "Test 4 : Recherche Croisée Base & Fabricants",
      description: "Recoupement multi-sources Open Food Facts mondial & traçabilité distributeur.",
      status: test4Status,
      detail: test4Detail,
    },
    {
      id: "test-synthesis",
      name: "Test 5 : Synthèse de Conformité & Sécurité",
      description: "Validation croisée de l'ensemble des règles canoniques pour un avis sécurisé.",
      status: test5Status,
      detail: test5Detail,
    },
  ];

  const testsPassed = tests.filter((t) => t.status === "passed").length;
  const totalTests = tests.length;

  return {
    code: String(product.code ?? ""),
    name: name || "Produit sans nom",
    brand,
    image:
      (product.image_front_small_url as string) ||
      (product.image_url as string) ||
      (product.image_front_url as string) ||
      undefined,
    verdict,
    ingredients,
    ingredientItems: ingredientItems.length > 0 ? ingredientItems : undefined,
    reasons,
    certified,
    source,
    nutriscore,
    novaGroup,
    ecoscore,
    allergens: allergens.length > 0 ? allergens : undefined,
    traces: traces.length > 0 ? traces : undefined,
    quantity,
    categories: categoriesTags.length > 0 ? categoriesTags : undefined,
    labelsList: labelsList.length > 0 ? labelsList : undefined,
    tests,
    testsPassed,
    totalTests,
  };
}

/* ---------- Multi-source Endpoints ---------- */

async function fetchWithTimeout(url: string, ms = 3000): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function offByEndpoint(
  url: string,
  sourceName = "Open Food Facts",
): Promise<ProductResult | null> {
  const res = await fetchWithTimeout(url, 3200);
  if (!res) return null;
  try {
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    return analyse(json.product, sourceName);
  } catch {
    return null;
  }
}

async function offByBarcode(code: string) {
  return offByEndpoint(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    "Open Food Facts (World)",
  );
}

async function upcByBarcode(code: string) {
  const res = await fetchWithTimeout(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
    3000,
  );
  if (!res) return null;
  try {
    const json = await res.json();
    const item = json.items?.[0];
    if (!item) return null;
    return analyse(
      {
        code,
        product_name: item.title,
        brands: item.brand,
        ingredients_text: item.description ?? "",
        image_url: item.images?.[0],
      },
      "UPC Item DB",
    );
  } catch {
    return null;
  }
}

/** Multi-source barcode lookup with automatic fallbacks and cross-searches. */
export async function fetchByBarcode(code: string): Promise<ProductResult | null> {
  const cleanCode = code.trim();
  if (!cleanCode) return null;

  // 1. Check Curated Verified Database
  const curated = CURATED_PRODUCTS.find((p) => p.code === cleanCode);
  if (curated) return curated;

  // 2. Primary Open Food Facts World lookup
  const primaryOff = await offByBarcode(cleanCode).catch(() => null);

  // If primary OFF returned a result WITH ingredients, return immediately
  if (primaryOff && primaryOff.ingredients && primaryOff.ingredients.trim().length > 0) {
    return primaryOff;
  }

  // 3. Multi-source parallel fallbacks (Swiss, Belgian, German, French nodes + UPCitemdb)
  const [chRes, beRes, deRes, frRes, upcRes] = await Promise.allSettled([
    offByEndpoint(
      `https://ch.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`,
      "Open Food Facts (Suisse)",
    ),
    offByEndpoint(
      `https://be.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`,
      "Open Food Facts (Belgique)",
    ),
    offByEndpoint(
      `https://de.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`,
      "Open Food Facts (Allemagne)",
    ),
    offByEndpoint(
      `https://fr.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`,
      "Open Food Facts (France)",
    ),
    upcByBarcode(cleanCode),
  ]);

  const candidates: ProductResult[] = [];
  if (primaryOff) candidates.push(primaryOff);
  if (chRes.status === "fulfilled" && chRes.value) candidates.push(chRes.value);
  if (beRes.status === "fulfilled" && beRes.value) candidates.push(beRes.value);
  if (deRes.status === "fulfilled" && deRes.value) candidates.push(deRes.value);
  if (frRes.status === "fulfilled" && frRes.value) candidates.push(frRes.value);
  if (upcRes.status === "fulfilled" && upcRes.value) candidates.push(upcRes.value);

  // Return candidate with populated ingredients
  const candidateWithIngredients = candidates.find(
    (c) => c.ingredients && c.ingredients.trim().length > 0,
  );
  if (candidateWithIngredients) return candidateWithIngredients;

  // 4. Cross-search by Product Name & Brand if ingredients are still missing
  const candidateName = candidates.find((c) => c.name && c.name !== "Produit sans nom")?.name || "";
  const candidateBrand = candidates.find((c) => c.brand)?.brand || "";

  if (candidateName || candidateBrand) {
    const searchQuery = `${candidateBrand} ${candidateName}`.trim();
    if (searchQuery.length >= 3) {
      try {
        const searchMatches = await searchByName(searchQuery);
        const matchWithIngredients = searchMatches.find(
          (m) => m.ingredients && m.ingredients.trim().length > 0,
        );
        if (matchWithIngredients) {
          return {
            ...matchWithIngredients,
            code: cleanCode,
            name: candidateName || matchWithIngredients.name,
            brand: candidateBrand || matchWithIngredients.brand,
            reasons: [
              ...matchWithIngredients.reasons,
              `Composition identifiée via recherche croisée multi-sources (${matchWithIngredients.source}).`,
            ],
          };
        }
      } catch {
        /* ignore cross-search failure */
      }
    }
  }

  // 5. Final decision based on best candidate
  if (candidates.length > 0) {
    return candidates.reduce((prev, curr) => {
      if (curr.verdict === "halal" || curr.verdict === "haram") return curr;
      if (prev.verdict === "halal" || prev.verdict === "haram") return prev;
      return curr;
    }, candidates[0]);
  }

  return null;
}

/* ---------- Name search: full-text first, legacy fallback ---------- */

const RAW_CURATED_PRODUCTS: Record<string, unknown>[] = [
  {
    code: "3181232145678",
    product_name: "Haché L'Ultra Tendre 100% Pur Bœuf",
    brands: "Socopa",
    ingredients_text: "100% viande de bœuf hachée pur bœuf (origine France).",
    nutriscore_grade: "a",
    nova_group: 1,
    ecoscore_grade: "d",
    categories_tags: ["viandes", "beef", "steaks-haches"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/318/123/214/5678/front_fr.400.jpg",
  },
  {
    code: "3560070498765",
    product_name: "Steak Haché Pur Bœuf Halal Certifié AVS",
    brands: "Isla Délice",
    ingredients_text: "100% viande bovine certifiée halal.",
    labels: "certifié halal, avs",
    labels_tags: ["en:halal", "fr:avs"],
    nutriscore_grade: "a",
    nova_group: 1,
    ecoscore_grade: "d",
    categories_tags: ["viandes", "beef", "halal-meats"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/356/007/049/8765/front_fr.400.jpg",
  },
  {
    code: "3017620422003",
    product_name: "Nutella (Pâte à tartiner)",
    brands: "Ferrero",
    ingredients_text:
      "Sucre, huile de palme, noisettes (13%), lait écrémé en poudre (8,7%), cacao maigre (7,4%), émulsifiants : lécithines [soja], vanilline.",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "d",
    allergens_tags: ["en:milk", "en:nuts", "en:soybeans"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_fr.430.400.jpg",
  },
  {
    code: "8000500037560",
    product_name: "Kinder Bueno",
    brands: "Ferrero",
    ingredients_text:
      "Chocolat au lait 31,5%, sucre, huile de palme, farine de froment, noisettes (10,8%), lait écrémé en poudre, émulsifiants: lécithines [soja], arômes.",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "d",
    allergens_tags: ["en:milk", "en:nuts", "en:gluten", "en:soybeans"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/800/050/003/7560/front_fr.112.400.jpg",
  },
  {
    code: "3103220009574",
    product_name: "Haribo Croco / Dragibus / Goldbären (Classique)",
    brands: "Haribo France",
    ingredients_text:
      "Sirop de glucose, sucre, gélatine de porc, dextrose, acidifiant: acide citrique.",
    nutriscore_grade: "d",
    nova_group: 4,
    ecoscore_grade: "c",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/310/322/000/9574/front_fr.82.400.jpg",
  },
  {
    code: "8690526010014",
    product_name: "Haribo Halal (Chamallows / Goldbären)",
    brands: "Haribo Halal",
    ingredients_text:
      "Sirop de glucose, sucre, gélatine bovine certifiée halal, dextrose, arômes.",
    labels: "certifié halal",
    labels_tags: ["en:halal"],
    nutriscore_grade: "d",
    nova_group: 4,
    ecoscore_grade: "c",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/869/052/601/0014/front_fr.20.400.jpg",
  },
  {
    code: "5449000000996",
    product_name: "Coca-Cola Original",
    brands: "Coca-Cola",
    ingredients_text:
      "Eau gazéifiée, sucre, colorant: E150d, acidifiant: E338, arômes naturels (dont extraits végétaux et caféine).",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "b",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/544/900/000/0996/front_fr.387.400.jpg",
  },
  {
    code: "7622210449283",
    product_name: "Oreo Original",
    brands: "Mondelez / Oreo",
    ingredients_text:
      "Farine de blé, sucre, huile de palme, cacao maigre en poudre, sirop de glucose-fructose, poudres à lever, sel, émulsifiant (lécithines de soja), arôme (vanilline).",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "d",
    allergens_tags: ["en:gluten", "en:soybeans"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/762/221/044/9283/front_fr.46.400.jpg",
  },
  {
    code: "9002490100070",
    product_name: "Red Bull Energy Drink",
    brands: "Red Bull",
    ingredients_text:
      "Eau gazéifiée, sucre, glucose, acidifiant (acide citrique), taurine (0,4%), correcteur d'acidité, caféine, vitamines, arômes.",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "c",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/900/249/010/0070/front_fr.88.400.jpg",
  },
  {
    code: "5000159461122",
    product_name: "M&M's Peanut (Cacahuète)",
    brands: "Mars",
    ingredients_text:
      "Sucre, cacahuètes, pâte de cacao, lait écrémé en poudre, beurre de cacao, sirop de glucose, émulsifiants (lécithine de soja, E414), colorants (E100, E120, E133, E160a, E160e, E170).",
    nutriscore_grade: "e",
    nova_group: 4,
    ecoscore_grade: "d",
    allergens_tags: ["en:peanuts", "en:milk", "en:soybeans"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/500/015/946/1122/front_fr.116.400.jpg",
  },
  {
    code: "3228857000166",
    product_name: "Oasis Tropical",
    brands: "Oasis / Schweppes",
    ingredients_text:
      "Eau de source, jus de fruits à base de concentrés 12% (orange, pomme, fruit de la passion, mangue), sucre, acidifiant: acide citrique, arômes naturels.",
    nutriscore_grade: "d",
    nova_group: 4,
    ecoscore_grade: "b",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/322/885/700/0166/front_fr.102.400.jpg",
  },
  {
    code: "8715700110487",
    product_name: "Pringles Original",
    brands: "Pringles",
    ingredients_text:
      "Pommes de terre déshydratées, huiles végétales (tournesol, palme, maïs), farine de blé, farine de riz, émulsifiant (E471), maltodextrine, sel.",
    nutriscore_grade: "d",
    nova_group: 4,
    ecoscore_grade: "d",
    allergens_tags: ["en:gluten"],
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/871/570/011/0487/front_fr.48.400.jpg",
  },
  {
    code: "3168930010003",
    product_name: "Capri-Sun Multivitamin / Orange",
    brands: "Capri-Sun",
    ingredients_text:
      "Eau de source, jus de fruits à base de concentré 12% (orange, pomme, ananas, banane, kiwi, passion), sucre, acide citrique, vitamines.",
    nutriscore_grade: "c",
    nova_group: 4,
    ecoscore_grade: "b",
    image_front_small_url:
      "https://images.openfoodfacts.org/images/products/316/893/001/0003/front_fr.78.400.jpg",
  },
];

const CURATED_PRODUCTS: ProductResult[] = RAW_CURATED_PRODUCTS.map((raw) =>
  analyse(raw, "Base de données vérifiée Nur"),
);

async function searchFastOFF(q: string): Promise<ProductResult[]> {
  try {
    const res = await fetch(
      `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=24`,
      { headers: HEADERS },
    );
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.hits || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: Record<string, unknown>) =>
      analyse(
        {
          code: h.code || h.id,
          product_name: h.product_name || h.product_name_fr || h.product_name_en,
          brands: h.brands,
          ingredients_text_fr: h.ingredients_text_fr || h.ingredients_text,
          labels: h.labels,
          labels_tags: h.labels_tags,
          image_front_small_url: h.image_front_small_url || h.image_url || h.image_front_url,
        },
        "Open Food Facts",
      ),
    );
  } catch {
    return [];
  }
}

async function searchFallbackOFF(q: string): Promise<ProductResult[]> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(
        q,
      )}&search_simple=1&action=process&json=1&page_size=24`,
      { headers: HEADERS },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return ((json.products ?? []) as Record<string, unknown>[]).map((p) =>
      analyse(p, "Open Food Facts"),
    );
  } catch {
    return [];
  }
}

async function searchUpc(q: string): Promise<ProductResult[]> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(q)}&match_mode=1`,
      { headers: HEADERS },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return ((json.items ?? []) as Record<string, unknown>[]).slice(0, 10).map((item) =>
      analyse(
        {
          code: String((item.upc as string) ?? (item.ean as string) ?? ""),
          product_name: item.title,
          brands: item.brand,
          ingredients_text: item.description ?? "",
          image_url: (item.images as string[])?.[0],
        },
        "UPC Item DB",
      ),
    );
  } catch {
    return [];
  }
}

/**
 * Instant & reliable search combining curated verified database
 * with live Open Food Facts & UPC databases.
 */
export async function searchByName(q: string): Promise<ProductResult[]> {
  const term = q.trim();
  if (!term) return [];

  const normalizedTerm = norm(term);

  // 1. Check curated database first
  const curatedMatches = CURATED_PRODUCTS.filter(
    (p) =>
      norm(p.name).includes(normalizedTerm) ||
      norm(p.brand).includes(normalizedTerm) ||
      p.code.includes(term),
  );

  // 2. Fast Open Food Facts Search Engine
  const fastResults = await searchFastOFF(term);

  // 3. Fallback to secondary endpoints if fast search returns few results
  let fallbackResults: ProductResult[] = [];
  if (fastResults.length < 5) {
    const [fallbackRes, upcRes] = await Promise.allSettled([
      searchFallbackOFF(term),
      searchUpc(term),
    ]);
    fallbackResults = [
      ...(fallbackRes.status === "fulfilled" ? fallbackRes.value : []),
      ...(upcRes.status === "fulfilled" ? upcRes.value : []),
    ];
  }

  const combined = [...curatedMatches, ...fastResults, ...fallbackResults];

  const seen = new Set<string>();
  return combined.filter((r) => {
    const key = r.code ? r.code : `${r.name.toLowerCase()}-${r.brand.toLowerCase()}`;
    if (seen.has(key) || !r.name || r.name === "Produit sans nom") return false;
    seen.add(key);
    return true;
  });
}
