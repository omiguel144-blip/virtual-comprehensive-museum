/**
 * Curatorial regions and period bands, modeled on how encyclopedic museums
 * divide their galleries. Pure functions; never guesses from an artist's name.
 */

export const REGIONS = [
  { key: "italy", label: "Italy", wing: "Europe" },
  { key: "france", label: "France", wing: "Europe" },
  { key: "iberia", label: "Spain and Portugal", wing: "Europe" },
  { key: "low-countries", label: "The Low Countries", wing: "Europe" },
  { key: "german", label: "German Lands and Central Europe", wing: "Europe" },
  { key: "britain", label: "Britain and Ireland", wing: "Europe" },
  { key: "nordic-east", label: "Scandinavia and Eastern Europe", wing: "Europe" },
  { key: "north-america", label: "United States and Canada", wing: "Americas" },
  { key: "latin-america", label: "Latin America", wing: "Americas" },
  { key: "china", label: "China", wing: "Asia" },
  { key: "japan", label: "Japan", wing: "Asia" },
  { key: "korea", label: "Korea", wing: "Asia" },
  { key: "south-asia", label: "South Asia", wing: "Asia" },
  { key: "himalaya-sea", label: "The Himalayas and Southeast Asia", wing: "Asia" },
  { key: "islamic", label: "The Islamic World", wing: "Asia" },
  { key: "africa", label: "Africa", wing: "Africa" },
  { key: "ancient", label: "Ancient and Byzantine", wing: "Ancient" },
  { key: "unassigned", label: "Other and Unassigned", wing: "Other" },
] as const;

export type RegionKey = (typeof REGIONS)[number]["key"];
export const regionLabel = (key: string) => REGIONS.find((r) => r.key === key)?.label ?? key;

/** Order matters: more specific places come first (e.g. "Mughal India" before "Islamic"). */
const PLACE_RULES: Array<[RegionKey, RegExp]> = [
  ["ancient", /\b(byzantine|coptic|etruscan|hellenistic|ancient egypt|pharaonic|ptolemaic|roman egypt)\b/],
  ["korea", /\b(korea|korean|joseon|goryeo|koryo)\b/],
  ["japan", /\b(japan|japanese|edo|meiji|muromachi|momoyama|kamakura|heian|nanbokucho|taisho)\b/],
  ["china", /\b(china|chinese|ming|qing|yuan dynasty|song dynasty|tang dynasty|northern song|southern song|jin dynasty)\b/],
  ["himalaya-sea", /\b(nepal|nepalese|tibet|tibetan|bhutan|thailand|thai|cambodia|khmer|burma|burmese|myanmar|java|indonesia|vietnam|laos|philippines)\b/],
  ["south-asia", /\b(india|indian|mughal|rajasthan|rajput|pahari|deccan|bengal|kangra|mewar|bikaner|kota|bundi|jaipur|punjab|pakistan|sri lanka|bihar|gujarat|kalighat|company school)\b/],
  ["islamic", /\b(iran|persia|persian|ottoman|turkey|turkish|safavid|qajar|timurid|islamic|arab|mamluk|syria|iraq|central asia|uzbek|bukhara|herat|afghan)\b/],
  ["africa", /\b(africa|african|nigeria|nigerian|ghana|ghanaian|ethiopia|ethiopian|kenya|kenyan|senegal|senegalese|congo|congolese|mali|malian|zimbabwe|cameroon|benin|ivory coast|cote d'ivoire|sudan|sudanese|uganda|tanzania)\b/],
  ["latin-america", /\b(mexico|mexican|peru|peruvian|bolivia|bolivian|ecuador|colombia|colombian|brazil|brazilian|argentin\w*|uruguay|uruguayan|paraguay|cuba|cuban|guatemala|venezuela|venezuelan|chile|chilean|haiti|haitian|dominican|new spain|latin america|viceroyalty|cuzco|puerto rico)\b/],
  ["north-america", /\b(united states|american|america|canada|canadian)\b/],
  ["iberia", /\b(spain|spanish|portugal|portuguese|seville|madrid|catalan|valencia)\b/],
  ["low-countries", /\b(netherlands|dutch|flemish|flanders|belgium|belgian|holland|antwerp|haarlem|utrecht|bruges|brussels|amsterdam)\b/],
  ["france", /\b(france|french|paris|avignon)\b/],
  ["italy", /\b(italy|italian|venice|venetian|florence|florentine|siena|sienese|rome|roman|naples|neapolitan|bologna|bolognese|milan|lombard|genoa|ferrara|umbria|tuscany)\b/],
  ["german", /\b(germany|german|austria|austrian|swiss|switzerland|bohemia|bohemian|nuremberg|cologne|bavaria|vienna|prague)\b/],
  ["britain", /\b(england|english|britain|british|scotland|scottish|ireland|irish|wales|welsh|london)\b/],
  ["nordic-east", /\b(denmark|danish|norway|norwegian|sweden|swedish|finland|finnish|russia|russian|poland|polish|czech|hungary|hungarian|ukraine|ukrainian|greece|greek|baltic|latvia|lithuania|estonia|romania|romanian|serbia|serbian|croatia|croatian|slovak|slovenia|slovenian|montenegr\w*|yugoslav\w*|bulgaria|bulgarian|armenia|armenian)\b/],
];

/** Departments that name a region outright (Met, AIC, CMA). */
const DEPARTMENT_RULES: Array<[RegionKey, RegExp]> = [
  ["north-america", /\b(american wing|american painting|arts of the americas|american art)\b/],
  ["china", /\bchinese art\b/],
  ["japan", /\bjapanese art\b/],
  ["korea", /\bkorean art\b/],
  ["south-asia", /\b(indian|south asian)\b/],
  ["islamic", /\bislamic art\b/],
  ["ancient", /\b(egyptian art|greek and roman|ancient near eastern|byzantine)\b/],
];

export type RegionHints = {
  culture?: string | null;
  place?: string | null;
  nationality?: string | null;
  department?: string | null;
  yearStart?: number | null;
};

export function fold(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function match(rules: Array<[RegionKey, RegExp]>, text: string): RegionKey | null {
  if (!text) return null;
  for (const [key, re] of rules) if (re.test(text)) return key;
  return null;
}

export function classifyRegion(h: RegionHints): RegionKey {
  // "Roman" alone is ambiguous: ancient before 600 CE, Italian afterwards.
  if (h.yearStart !== null && h.yearStart !== undefined && h.yearStart < 600) {
    const t = fold(`${h.culture ?? ""} ${h.place ?? ""} ${h.department ?? ""}`);
    if (/\b(roman|greek|egypt\w*|byzantine|coptic|etruscan|ancient)\b/.test(t)) return "ancient";
  }
  return (
    match(PLACE_RULES, fold(h.culture)) ??
    match(PLACE_RULES, fold(h.place)) ??
    match(PLACE_RULES, fold(h.nationality)) ??
    match(DEPARTMENT_RULES, fold(h.department)) ??
    "unassigned"
  );
}

type Band = { start: number; label: string };

const EUROPEAN_BANDS: Band[] = [
  { start: -Infinity, label: "Medieval (before 1300)" },
  { start: 1300, label: "1300–1450" },
  { start: 1450, label: "Renaissance, 1450–1600" },
  { start: 1600, label: "17th Century" },
  { start: 1700, label: "18th Century" },
  { start: 1800, label: "1800–1850" },
  { start: 1850, label: "1850–1900" },
  { start: 1900, label: "20th Century" },
];

const AMERICAN_BANDS: Band[] = [
  { start: -Infinity, label: "Before 1700" },
  { start: 1700, label: "Colonial Era, 1700–1800" },
  { start: 1800, label: "1800–1850" },
  { start: 1850, label: "1850–1900" },
  { start: 1900, label: "20th Century" },
];

const PERIOD_BANDS: Partial<Record<RegionKey, Band[]>> = {
  china: [
    { start: -Infinity, label: "Before the Song (to 960)" },
    { start: 960, label: "Song Dynasty (960–1279)" },
    { start: 1279, label: "Yuan Dynasty (1271–1368)" },
    { start: 1368, label: "Ming Dynasty (1368–1644)" },
    { start: 1644, label: "Qing Dynasty (1644–1911)" },
    { start: 1912, label: "Modern China (1912– )" },
  ],
  japan: [
    { start: -Infinity, label: "Heian and Earlier (to 1185)" },
    { start: 1185, label: "Kamakura Period (1185–1333)" },
    { start: 1333, label: "Muromachi Period (1333–1573)" },
    { start: 1573, label: "Momoyama Period (1573–1615)" },
    { start: 1615, label: "Edo Period (1615–1868)" },
    { start: 1868, label: "Meiji and Later (1868– )" },
  ],
  korea: [
    { start: -Infinity, label: "Goryeo and Earlier (to 1392)" },
    { start: 1392, label: "Joseon Dynasty (1392–1910)" },
    { start: 1910, label: "Modern Korea (1910– )" },
  ],
  "south-asia": [
    { start: -Infinity, label: "Early Manuscripts (before 1550)" },
    { start: 1550, label: "Mughal and Deccani Courts (1550–1700)" },
    { start: 1700, label: "Rajput and Pahari Courts (1700–1858)" },
    { start: 1858, label: "Colonial and Modern (1858– )" },
  ],
  "himalaya-sea": [
    { start: -Infinity, label: "Before 1500" },
    { start: 1500, label: "1500–1800" },
    { start: 1800, label: "1800 and Later" },
  ],
  islamic: [
    { start: -Infinity, label: "Before 1500" },
    { start: 1500, label: "Safavid, Ottoman and Contemporaries (1500–1800)" },
    { start: 1800, label: "1800 and Later" },
  ],
  "north-america": AMERICAN_BANDS,
  "latin-america": [
    { start: -Infinity, label: "Viceregal Era (before 1800)" },
    { start: 1800, label: "19th Century" },
    { start: 1900, label: "20th Century" },
  ],
  ancient: [{ start: -Infinity, label: "Antiquity and Byzantium" }],
};

export type Period = { key: string; label: string; start: number };

/** The period band a work falls in; "undated" when there is no year. */
export function periodFor(region: RegionKey, yearStart: number | null | undefined): Period {
  if (yearStart === null || yearStart === undefined) return { key: "undated", label: "Undated", start: Infinity };
  const bands = PERIOD_BANDS[region] ?? EUROPEAN_BANDS;
  let band = bands[0];
  for (const b of bands) if (yearStart >= b.start) band = b;
  const key = band.start === -Infinity ? "early" : String(band.start);
  return { key, label: band.label, start: band.start };
}

export const galleryKey = (region: string, period: string) => `${region}:${period}`;

export function parseGalleryKey(key: string): { region: string; period: string } | null {
  const m = key.match(/^([a-z-]+):([a-z0-9-]+)$/);
  return m ? { region: m[1], period: m[2] } : null;
}

/** Period label for a stored key, given the region (used for headings). */
export function periodLabel(region: string, periodKey: string): string {
  if (periodKey === "undated") return "Undated";
  const bands = PERIOD_BANDS[region as RegionKey] ?? EUROPEAN_BANDS;
  const start = periodKey === "early" ? -Infinity : Number(periodKey);
  return bands.find((b) => b.start === start)?.label ?? periodKey;
}
