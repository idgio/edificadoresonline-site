import predicas2026 from "@/data/predicas/2026/predicas_2026.json";

export type Predica = {
  title: string;
  preacher: string;
  date: string;
  pdf_url: string | null;
  image_url: string | null;
  youtube_url: string | null;
  content: string;
};

export type PredicaMonth = {
  month: string;
  featured_image_url?: string | null;
  featured_description?: string | null;
  data: Predica[];
};

export type PredicaEntry = Predica & {
  slug: string;
  imageUrl: string | null;
};

export type PredicaMonthNormalized = {
  month: string;
  slug: string;
  entries: PredicaEntry[];
  coverImage: string | null;
  featuredDescription: string | null;
};

const predicasByYear: Record<number, PredicaMonth[]> = {
  2026: predicas2026 as PredicaMonth[],
};

export const DEFAULT_IMAGE = "/images/edificadoresonline_logo.webp";

const availableYears = Object.keys(predicasByYear)
  .map((year) => Number(year))
  .sort((a, b) => a - b);

const systemYear = new Date().getFullYear();
const activeYear = predicasByYear[systemYear]
  ? systemYear
  : availableYears[availableYears.length - 1];

export const getPredicasYear = (year?: number) =>
  predicasByYear[year ?? activeYear] ?? predicasByYear[activeYear];

export const getActiveYear = () => activeYear;

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const cleaned = url.replace(/^public\//, "/");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
};

export const withDefaultImage = (url?: string | null) =>
  normalizeImageUrl(url) ?? DEFAULT_IMAGE;

export const isDefaultImage = (url?: string | null) =>
  (url ?? null) === DEFAULT_IMAGE;

const buildPredicaSlug = (predica: Predica) =>
  slugify(`${predica.title}-${predica.date}`);

const normalizePredicaEntry = (predica: Predica): PredicaEntry => ({
  ...predica,
  slug: buildPredicaSlug(predica),
  imageUrl: withDefaultImage(predica.image_url),
});

export const normalizeMonth = (month: PredicaMonth): PredicaMonthNormalized => {
  const entries = month.data.map(normalizePredicaEntry);
  const featuredImage = normalizeImageUrl(month.featured_image_url ?? null);
  const coverImage =
    featuredImage ?? entries[0]?.imageUrl ?? DEFAULT_IMAGE;

  return {
    month: month.month,
    slug: slugify(month.month),
    entries,
    coverImage,
    featuredDescription: month.featured_description ?? null,
  };
};

export const getPredicaMonths = (year?: number) =>
  getPredicasYear(year).map(normalizeMonth);

export const findPredicaMonth = (year: number, monthSlug: string) =>
  getPredicaMonths(year).find((month) => month.slug === monthSlug) ?? null;

export const findPredicaEntry = (
  year: number,
  monthSlug: string,
  predicaSlug: string
) => {
  const month = findPredicaMonth(year, monthSlug);
  if (!month) return null;

  const entry = month.entries.find((item) => item.slug === predicaSlug) ?? null;
  return entry ? { month, entry } : null;
};
