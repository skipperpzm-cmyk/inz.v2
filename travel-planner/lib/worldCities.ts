import worldCitiesData from './worldCities.data.json';

type RawWorldCity = {
  name: string;
  countryCode: string;
};

export type WorldCitySuggestion = {
  name: string;
  countryCode: string;
  countryName: string;
};

type IndexedWorldCity = WorldCitySuggestion & {
  normalizedName: string;
};

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const rawWorldCities = worldCitiesData as RawWorldCity[];
const countryDisplayNames = new Intl.DisplayNames(['pl'], { type: 'region' });
const countryNameByCode = new Map<string, string>();
const countryCodeByNormalizedName = new Map<string, string>();

const uniqueWorldCitiesMap = new Map<string, IndexedWorldCity>();

for (const city of rawWorldCities) {
  const cityName = (city.name ?? '').trim();
  const countryCode = (city.countryCode ?? '').toUpperCase();
  if (!cityName || !/^[A-Z]{2}$/.test(countryCode)) continue;

  const countryName = countryNameByCode.get(countryCode) ?? countryDisplayNames.of(countryCode) ?? countryCode;
  countryNameByCode.set(countryCode, countryName);
  countryCodeByNormalizedName.set(normalizeSearchText(countryName), countryCode);

  const key = `${cityName}|${countryCode}`;
  if (uniqueWorldCitiesMap.has(key)) continue;

  uniqueWorldCitiesMap.set(key, {
    name: cityName,
    countryCode,
    countryName,
    normalizedName: normalizeSearchText(cityName),
  });
}

const collator = new Intl.Collator('pl', { sensitivity: 'base' });
const allIndexedCities = Array.from(uniqueWorldCitiesMap.values()).sort((a, b) => {
  const byName = collator.compare(a.name, b.name);
  if (byName !== 0) return byName;
  return collator.compare(a.countryName, b.countryName);
});

const citiesByCountryCode = new Map<string, IndexedWorldCity[]>();
for (const city of allIndexedCities) {
  const current = citiesByCountryCode.get(city.countryCode) ?? [];
  current.push(city);
  citiesByCountryCode.set(city.countryCode, current);
}

function resolveCountryCode(country?: string) {
  const trimmed = (country ?? '').trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return countryCodeByNormalizedName.get(normalizeSearchText(trimmed)) ?? null;
}

export function searchWorldCities(params: {
  query: string;
  country?: string;
  limit?: number;
}): WorldCitySuggestion[] {
  const normalizedQuery = normalizeSearchText(params.query);
  if (!normalizedQuery) return [];

  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);
  const countryCode = resolveCountryCode(params.country);
  const source = countryCode ? (citiesByCountryCode.get(countryCode) ?? []) : allIndexedCities;

  const result: WorldCitySuggestion[] = [];
  for (const city of source) {
    if (!city.normalizedName.startsWith(normalizedQuery)) continue;
    result.push({
      name: city.name,
      countryCode: city.countryCode,
      countryName: city.countryName,
    });
    if (result.length >= limit) break;
  }

  return result;
}
