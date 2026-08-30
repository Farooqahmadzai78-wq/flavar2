import { searchMawaqitMosquesServer, type MawaqitMosqueSearchItem } from "./mawaqit.functions";

export type Mosque = {
  id: string;
  slug?: string;
  name: string;
  label?: string;
  lat: number;
  lon: number;
  distance: number;
  address?: string;
  city?: string;
  country?: string;
  source: "mawaqit" | "osm" | "custom";
  isOfficial?: boolean;
  jumua?: string;
  jumua2?: string;
  shuruq?: string;
  times?: string[];
  iqama?: string[];
  timezone?: string;
};

const R = 6371;
const rad = (v: number) => (v * Math.PI) / 180;

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** In-memory cache for ultra-fast UI rendering */
const memoryCache = new Map<string, { timestamp: number; data: Mosque[] }>();

/**
 * Universal & Strict Mosque Verifier.
 * Guarantees that churches, synagogues, hindu/buddhist temples, cathedrals, chapels,
 * transit stops, streets, and non-Islamic venues are NEVER categorized as mosques.
 */
export function isConfirmedMosque(place: {
  name: string;
  displayName?: string;
  address?: string;
  tags?: Record<string, string>;
  class?: string;
  type?: string;
  source?: string;
}): boolean {
  const { name, displayName = "", address = "", tags, class: osmClass, type: osmType, source } = place;

  // 1. Strict OSM tag checks if tags are present
  if (tags) {
    // Non-Muslim religion tag -> STRICT REJECT
    if (tags.religion) {
      const rel = tags.religion.toLowerCase().trim();
      if (!["muslim", "islam", "islamic"].includes(rel)) {
        return false;
      }
    }

    // Explicit non-Muslim building tag -> STRICT REJECT
    const b = (tags.building || "").toLowerCase().trim();
    const forbiddenBuildings = [
      "church",
      "cathedral",
      "chapel",
      "synagogue",
      "temple",
      "shrine",
      "basilica",
      "monastery",
      "abbey",
      "convent",
      "kingdom_hall",
      "train_station",
      "commercial",
      "retail",
      "apartments",
      "residential",
      "hotel",
      "industrial",
      "school",
      "university",
    ];
    if (forbiddenBuildings.includes(b)) {
      return false;
    }

    // Explicit non-Muslim amenity tag -> STRICT REJECT
    const a = (tags.amenity || "").toLowerCase().trim();
    const forbiddenAmenities = [
      "church",
      "cathedral",
      "chapel",
      "synagogue",
      "temple",
      "monastery",
      "shrine",
      "restaurant",
      "fast_food",
      "cafe",
      "pub",
      "bar",
      "bus_station",
      "train_station",
      "school",
      "university",
      "shop",
      "supermarket",
      "bank",
      "pharmacy",
      "hospital",
      "parking",
      "police",
      "post_office",
      "townhall",
    ];
    if (forbiddenAmenities.includes(a)) {
      return false;
    }

    // Denominations of non-Islamic religions -> STRICT REJECT
    const d = (tags.denomination || "").toLowerCase().trim();
    const nonMuslimDenominations = [
      "catholic",
      "roman_catholic",
      "protestant",
      "orthodox",
      "greek_orthodox",
      "russian_orthodox",
      "evangelical",
      "baptist",
      "methodist",
      "lutheran",
      "anglican",
      "episcopal",
      "presbyterian",
      "mormon",
      "jehovahs_witnesses",
      "seventh_day_adventist",
      "adventist",
      "pentecostal",
      "jewish",
      "hindu",
      "buddhist",
      "sikh",
      "jain",
      "shinto",
      "taoist",
    ];
    if (nonMuslimDenominations.includes(d)) {
      return false;
    }
  }

  // 2. Reject OSM classes that are streets, transit lines, or shops (unless confirmed mosque)
  if (osmClass) {
    const c = osmClass.toLowerCase().trim();
    if (["highway", "railway", "public_transport", "shop", "tourism", "leisure", "boundary", "landuse"].includes(c)) {
      if (osmType !== "mosque") {
        return false;
      }
    }
  }

  // 3. Combined text for word filtering
  const text = `${name} ${displayName} ${address}`.toLowerCase();

  // 4. Strict rejection of Christian, Jewish, Eastern religions, secular organisations, and generic worship words
  const rejectWords = [
    // Churches & Christian places
    "compagnon",
    "compagnons",
    "compagnon du devoir",
    "compagnons du devoir",
    "maison des compagnons",
    "foyer des compagnons",
    "église",
    "eglise",
    "églises",
    "eglises",
    "church",
    "churches",
    "kirche",
    "chiesa",
    "iglesia",
    "cathedral",
    "cathédrale",
    "cathedrale",
    "chapel",
    "chapelle",
    "kapelle",
    "basilica",
    "basilique",
    "paroisse",
    "parish",
    "pfarrei",
    "presbytère",
    "presbytere",
    "aumônerie",
    "aumonerie",
    "monastery",
    "monastère",
    "monastere",
    "abbey",
    "abbaye",
    "couvent",
    "convent",
    "prieuré",
    "prieure",
    "priory",
    "diocèse",
    "diocese",
    "archidiocèse",
    "archidiocese",
    "évêché",
    "eveche",
    "temple",
    "temples",
    "temple protestant",
    "temple réformé",
    "temple reforme",
    "temple évangélique",
    "temple evangelique",
    "temple adventiste",
    "temple mormon",
    "salle du royaume",
    "témoins de jéhovah",
    "temoins de jehovah",
    "jehovah",
    "mormon",
    "scientology",
    "scientologie",
    "mission chrétienne",
    "mission catholique",
    "mission évangélique",
    "mission evangelique",
    "mission protestante",
    "assemblée de dieu",
    "assemblee de dieu",
    "clocher",
    "vicaire",
    "curé",
    "cure ",
    "pasteur",

    // Saints & Catholic identifiers
    "saint-",
    "sainte-",
    "st-",
    "st. ",
    "saint ",
    "sainte ",
    "san ",
    "santa ",
    "santo ",
    "notre-dame",
    "notre dame",
    "sacré-cœur",
    "sacre-coeur",
    "sacre coeur",
    "saint michel",
    "saint etienne",
    "saint-étienne",
    "saint jean",
    "saint pierre",
    "saint paul",
    "saint aurelien",
    "saint-aurélien",
    "croix",
    "calvaire",
    "oratoire",
    "christ",
    "chrétien",
    "chretien",
    "chrétienne",
    "chretienne",

    // Synagogues & Jewish places
    "synagogue",
    "synagogues",
    "synagog",
    "sinagoga",
    "beit knesset",
    "beth habad",
    "beth chabad",
    "consistoire israélite",
    "consistoire israelite",
    "centre communautaire juif",

    // Hindu, Buddhist, Sikh & Eastern places
    "hindu temple",
    "buddhist temple",
    "temple bouddhiste",
    "temple hindou",
    "pagoda",
    "pagode",
    "gurdwara",
    "ashram",
    "mandir",
    "shinto",
    "shrine",
    "sanctuaire",

    // Denominations
    "catholique",
    "catholic",
    "protestant",
    "protestante",
    "orthodoxe",
    "orthodox",
    "évangélique",
    "evangélique",
    "evangelique",
    "évangélist",
    "evangelist",
    "baptist",
    "baptiste",
    "luthérien",
    "lutheran",
    "presbytérien",
    "presbyterian",
    "anglican",
    "pentecôtiste",
    "pentecotiste",
    "adventiste",
    "salutiste",

    // Transport / Stations
    "gare de",
    "gare d'",
    "gare ",
    "train station",
    "bus station",
    "bus stop",
    "arrêt ",
    "arret ",
    "station de",
    "station de métro",
    "station de metro",
    "station de tram",
    "station rer",
    "aéroport",
    "airport",

    // Commercial / Food / Services / Secular associations
    "restaurant",
    "boulangerie",
    "boucherie",
    "épicerie",
    "epicerie",
    "supermarché",
    "supermarket",
    "boutique",
    "coiffeur",
    "coiffure",
    "pharmacie",
    "banque",
    "hôtel",
    "hotel",
    "station-service",
    "station service",
    "magasin",
    "centre commercial",
    "maison de quartier",
    "centre social",
    "salle municipale",
    "salle des fêtes",
    "salle des fetes",
  ];

  for (const word of rejectWords) {
    if (text.includes(word)) {
      return false;
    }
  }

  // 5. Address-only or street-only rejects (e.g. "Rue de la Mosquée" without an actual mosque name)
  const streetNameOnlyRegex = /^(rue|avenue|bd|boulevard|impasse|chemin|route|place|allée|allee|square|quai|cours)\s+(de\s+la|du|des|de)\s+(mosquée|mosquee|masjid)/i;
  if (streetNameOnlyRegex.test(name.trim())) {
    return false;
  }

  // 6. Positive verification: Must have explicit Islamic OSM tags OR authentic Islamic keywords
  const hasIslamicTag =
    tags?.religion?.toLowerCase() === "muslim" ||
    tags?.religion?.toLowerCase() === "islam" ||
    tags?.building?.toLowerCase() === "mosque" ||
    tags?.amenity?.toLowerCase() === "mosque" ||
    osmType === "mosque";

  const islamicKeywords = [
    "mosquée",
    "mosquee",
    "mosquées",
    "mosquees",
    "mosque",
    "mosques",
    "masjid",
    "masjed",
    "masajid",
    "musalla",
    "mousalla",
    "musala",
    "mousala",
    "mosq",
    "jamia",
    "jamaa",
    "djamaa",
    "djamâa",
    "jami'",
    "camii",
    "cami",
    "mescit",
    "mescidi",
    "centre islamique",
    "center islamique",
    "centre culturel islamique",
    "centre cultuel islamique",
    "espace islamique",
    "association islamique",
    "centre musulman",
    "center musulman",
    "association musulmane",
    "culte musulman",
    "foyer musulman",
    "espace cultuel musulman",
    "union musulmane",
    "communauté musulmane",
    "communaute musulmane",
    "islamic center",
    "islamic centre",
    "islamic society",
    "islamic association",
    "muslim association",
    "muslim community",
    "mezquita",
    "moschee",
    "milli gorus",
    "ditib",
    "cimg",
    "fazilat",
    "al-",
    "el-",
    "an-",
    "ar-",
    "as-",
    "at-",
    "az-",
    "tawhid",
    "salam",
    "nour",
    "rahma",
    "badr",
    "fath",
    "quba",
    "sunnah",
    "sunna",
    "iman",
    "ihsan",
    "taqwa",
    "al-houda",
    "al-huda",
    "al-firdaws",
    "al-firdous",
    "al-ihsan",
    "al-iman",
    "an-nour",
    "an-noor",
    "ar-rahma",
    "al-madina",
    "al-medina",
    "al-quds",
    "al-aqsa",
    "tariq ibn ziyad",
    "khalid ibn al-walid",
    "khalid ibn al walid",
    "omar ibn al-khattab",
    "abu bakr",
    "abou bakr",
    "othman",
    "uthman",
    "bilal",
    "yunus emre",
    "mimar sinan",
    "mevlana",
    "fatih",
    "sultan ahmet",
    "eyup sultan",
    "selimiye",
    "haci bayram",
    "مسجد",
    "جامع",
    "مصلى",
    "مساجد",
    "الجامع",
    "المسجد",
    "مركز إسلامي",
    "مركز اسلامي",
    "جمعية إسلامية",
    "جمعية اسلامية",
  ];

  const hasIslamicKeyword = islamicKeywords.some((kw) => text.includes(kw));

  // If source is Mawaqit, it MUST still pass the rejectWords check AND must contain an Islamic identifier (or be verified)
  // If it is a generic word like "Les Compagnons" without any mosque indicator -> REJECT!
  if (source === "mawaqit") {
    if (hasIslamicKeyword) return true;
    // If it's a mawaqit official entry, check if the name is an authentic Islamic name or contains mosque keywords
    return false;
  }

  // For all other sources, require explicit Islamic tags OR Islamic keywords
  if (!hasIslamicTag && !hasIslamicKeyword) {
    return false;
  }

  return true;
}

/**
 * Robust, fast, and multi-sourced nearby mosque search.
 * Combines Nominatim API and Overpass API with strict verification.
 */
type NominatimItem = {
  place_id?: number;
  osm_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  class?: string;
  type?: string;
};

export async function nearbyMosques(
  lat: number,
  lon: number,
  radius = 12000,
  forceRefresh = false,
  cityName?: string,
): Promise<Mosque[]> {
  const cityKey = cityName ? cityName.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const cacheKey = `v6_${lat.toFixed(2)}_${lon.toFixed(2)}_${cityKey}`;

  // 1. Return cached results if available and fresh (< 30 minutes)
  if (!forceRefresh) {
    const mem = memoryCache.get(cacheKey);
    if (mem && Date.now() - mem.timestamp < 30 * 60 * 1000) {
      return mem.data;
    }
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(`nur_mosques_${cacheKey}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { timestamp: number; data: Mosque[] };
          if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
            memoryCache.set(cacheKey, parsed);
            return parsed.data;
          }
        }
      } catch {
        /* ignore storage errors */
      }
    }
  }

  // 2. Query Mawaqit official API (Server function with client fallback)
  const fetchMawaqit = async (): Promise<Mosque[]> => {
    const searchTerms = new Set<string>();
    if (cityName && cityName.trim().length >= 2) {
      searchTerms.add(cityName.trim());
    }

    const results: Mosque[] = [];

    for (const term of searchTerms) {
      try {
        // Try server function first
        let list: MawaqitMosqueSearchItem[] = [];
        try {
          list = await searchMawaqitMosquesServer({ data: { query: term } });
        } catch {
          // Direct fallback if in browser
          const url = `https://mawaqit.net/api/2.0/mosque/search?word=${encodeURIComponent(term)}`;
          const res = await fetch(url, { headers: { "User-Agent": "IslamNoorApp/1.0" } });
          if (res.ok) {
            list = await res.json();
          }
        }

        if (Array.isArray(list)) {
          for (const item of list) {
            const itemLat = Number(item.latitude);
            const itemLon = Number(item.longitude);
            if (isNaN(itemLat) || isNaN(itemLon)) continue;

            // Strict verification
            if (!isConfirmedMosque({ name: item.name, address: item.address, source: "mawaqit" })) {
              continue;
            }

            const dist = distanceKm(lat, lon, itemLat, itemLon);
            // Allow mosques in the same city / metro area (up to 40km or within radius)
            if (dist > 45) continue;

            results.push({
              id: item.slug ? `mawaqit-${item.slug}` : `mawaqit-${item.uuid || item.name}`,
              slug: item.slug,
              name: item.name,
              address: item.address,
              city: item.city || cityName,
              lat: itemLat,
              lon: itemLon,
              distance: dist,
              source: "mawaqit",
              isOfficial: true,
            });
          }
        }
      } catch (e) {
        console.warn("Mawaqit search error:", e);
      }
    }
    return results;
  };

  // 3. Query Nominatim (Fast & worldwide)
  const fetchNominatim = async (): Promise<Mosque[]> => {
    const delta = 0.18;
    const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;
    const terms = ["mosque", "masjid", "مسجد", "mosquee", "centre islamique"];

    const promises = terms.map(async (term) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          term,
        )}&bounded=1&viewbox=${viewbox}&limit=15&addressdetails=1`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "IslamNoorApp/1.0" },
        });
        clearTimeout(timeoutId);
        if (!res.ok) return [];
        const data = (await res.json()) as (NominatimItem & { address?: Record<string, string> })[];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    });

    const rawLists = await Promise.all(promises);
    const results: Mosque[] = [];
    for (const list of rawLists) {
      for (const item of list) {
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);
        if (isNaN(itemLat) || isNaN(itemLon)) continue;
        let rawName = item.name || item.display_name?.split(",")[0] || "Mosquée";

        // Build address string if available
        let addrStr = "";
        if (item.address) {
          const parts = [
            item.address.road || item.address.pedestrian || item.address.street,
            item.address.postcode,
            item.address.city || item.address.town || item.address.village,
          ].filter(Boolean);
          if (parts.length > 0) {
            addrStr = parts.join(", ");
          }
        }
        if (!addrStr && item.display_name) {
          const parts = item.display_name.split(",").slice(1, 4).map((s) => s.trim());
          addrStr = parts.join(", ");
        }

        if (
          !isConfirmedMosque({
            name: rawName,
            displayName: item.display_name,
            address: addrStr,
            class: item.class,
            type: item.type,
            source: "osm",
          })
        ) {
          continue;
        }

        const dist = distanceKm(lat, lon, itemLat, itemLon);
        const trimmed = rawName.trim().toLowerCase();
        if (
          trimmed === "mosque" ||
          trimmed === "masjid" ||
          trimmed === "مسجد" ||
          trimmed === "mosquee"
        ) {
          const sub = item.display_name?.split(",")[1]?.trim();
          rawName = sub ? `Mosquée (${sub})` : "Mosquée";
        }

        results.push({
          id: `nom-${item.place_id || item.osm_id}`,
          name: rawName,
          address: addrStr,
          lat: itemLat,
          lon: itemLon,
          distance: dist,
          source: "osm",
          isOfficial: false,
        });
      }
    }
    return results;
  };

  // 4. Query Overpass API (Strictly religion=muslim OR building=mosque OR amenity=mosque)
  const fetchOverpass = async (): Promise<Mosque[]> => {
    const query = `[out:json][timeout:4];(node(around:${radius},${lat},${lon})["amenity"="place_of_worship"]["religion"="muslim"];way(around:${radius},${lat},${lon})["amenity"="place_of_worship"]["religion"="muslim"];node(around:${radius},${lat},${lon})["building"="mosque"];way(around:${radius},${lat},${lon})["building"="mosque"];node(around:${radius},${lat},${lon})["amenity"="mosque"];way(around:${radius},${lat},${lon})["amenity"="mosque"];);out center 25;`;
    const servers = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    for (const server of servers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(server, {
          method: "POST",
          body: `data=${encodeURIComponent(query)}`,
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "User-Agent": "IslamNoorApp/1.0",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) continue;
        const json = (await res.json()) as {
          elements?: {
            id: number;
            type: string;
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: Record<string, string>;
          }[];
        };
        if (!json?.elements) continue;
        return json.elements
          .map((e) => {
            const la = e.lat ?? e.center?.lat;
            const lo = e.lon ?? e.center?.lon;
            if (la === undefined || lo === undefined) return null;
            const name = e.tags?.name || e.tags?.["name:fr"] || e.tags?.["name:ar"] || "Mosquée";

            // Format address from OSM tags
            const addrParts = [
              e.tags?.["addr:housenumber"],
              e.tags?.["addr:street"],
              e.tags?.["addr:postcode"],
              e.tags?.["addr:city"],
            ].filter(Boolean);
            const address = addrParts.length > 0 ? addrParts.join(" ") : undefined;

            if (!isConfirmedMosque({ name, address, tags: e.tags, source: "osm" })) {
              return null;
            }
            return {
              id: `${e.type}-${e.id}`,
              name,
              address,
              lat: la,
              lon: lo,
              distance: distanceKm(lat, lon, la, lo),
              source: "osm" as const,
              isOfficial: false,
            };
          })
          .filter((m): m is Mosque => m !== null);
      } catch {
        /* try next mirror */
      }
    }
    return [];
  };

  // Run searches concurrently
  const [mawaqitResults, nomResults, overResults] = await Promise.all([
    fetchMawaqit(),
    fetchNominatim(),
    fetchOverpass(),
  ]);

  // Combine results with Mawaqit official mosques having top priority
  const combined: Mosque[] = [...mawaqitResults];

  for (const osmItem of [...nomResults, ...overResults]) {
    // Check if an existing Mawaqit mosque matches this OSM mosque (< 350m or very similar name)
    const existing = combined.find(
      (m) =>
        distanceKm(m.lat, m.lon, osmItem.lat, osmItem.lon) < 0.35 ||
        (m.name.toLowerCase().includes(osmItem.name.toLowerCase().slice(0, 8)) &&
          distanceKm(m.lat, m.lon, osmItem.lat, osmItem.lon) < 2),
    );

    if (!existing) {
      combined.push(osmItem);
    }
  }

  // Deduplicate items within 80 meters
  const unique: Mosque[] = [];
  for (const item of combined) {
    const exists = unique.some((u) => distanceKm(u.lat, u.lon, item.lat, item.lon) < 0.08);
    if (!exists) {
      unique.push(item);
    }
  }

  // Sort: Official Mawaqit verified mosques first (by distance), then other mosques by distance
  unique.sort((a, b) => {
    if (a.isOfficial && !b.isOfficial) return -1;
    if (!a.isOfficial && b.isOfficial) return 1;
    return a.distance - b.distance;
  });

  const finalResult = unique.slice(0, 20);

  // Save in cache
  memoryCache.set(cacheKey, { timestamp: Date.now(), data: finalResult });
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        `nur_mosques_${cacheKey}`,
        JSON.stringify({ timestamp: Date.now(), data: finalResult }),
      );
    } catch {
      /* ignore storage write errors */
    }
  }

  return finalResult;
}

/* ---------- Slippy-map projection helpers (no map library needed) ---------- */
export function lonToX(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}
export function latToY(lat: number, z: number) {
  const s = Math.sin(rad(lat));
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z;
}
