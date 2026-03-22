import diplomados2026 from "@/data/diplomados/2026/diplomados_2026.json";

export type DiplomadoClass = {
  title: string;
  youtube_url: string;
  pdf_url?: string;
};

export type DiplomadoModule = {
  module_id: number;
  title: string;
  image_url: string | null;
  classes: DiplomadoClass[];
};

export type DiplomadoClassEntry = DiplomadoClass & {
  moduleId: number;
  classNumber: number | null;
  label: string;
  displayTitle: string;
  youtubeId: string | null;
  embedUrl: string | null;
};

export type DiplomadoModuleEntry = {
  moduleId: number;
  slug: string;
  routeSegment: string;
  title: string;
  imageUrl: string | null;
  classes: DiplomadoClassEntry[];
};

const diplomadosByYear: Record<number, DiplomadoModule[]> = {
  2026: diplomados2026 as DiplomadoModule[],
};

const availableYears = Object.keys(diplomadosByYear)
  .map((year) => Number(year))
  .sort((a, b) => a - b);

const systemYear = new Date().getFullYear();
const activeYear = diplomadosByYear[systemYear]
  ? systemYear
  : availableYears[availableYears.length - 1];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getActiveDiplomadosYear = () => activeYear;

export const getDiplomadosYears = () => [...availableYears];

export const getDiplomadosYear = (year?: number) =>
  diplomadosByYear[year ?? activeYear] ?? diplomadosByYear[activeYear];

export const getDiplomadosYearExact = (year: number) =>
  diplomadosByYear[year] ?? null;

export const normalizeDiplomadoImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const cleaned = url.replace(/^public\//, "/");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
};

const parseTitlePrefix = (title: string) => {
  const match = title.match(/^M(\d+)C(\d+)\s+(.+)$/);
  if (!match) {
    return {
      moduleId: null,
      classNumber: null,
      displayTitle: title,
      label: "Clase",
    };
  }

  const moduleId = Number(match[1]);
  const classNumber = Number(match[2]);
  return {
    moduleId,
    classNumber,
    displayTitle: match[3],
    label: `Clase ${classNumber}`,
  };
};

const extractYoutubeId = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.replace(/^\/+/, "") || null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      return parsed.searchParams.get("v");
    }
    return null;
  } catch {
    return null;
  }
};

const buildModuleRouteSegment = (moduleId: number) => `module-${moduleId}`;

const normalizeClassEntry = (
  moduleId: number,
  classItem: DiplomadoClass
): DiplomadoClassEntry => {
  const titleMeta = parseTitlePrefix(classItem.title);
  const youtubeId = extractYoutubeId(classItem.youtube_url);

  return {
    ...classItem,
    moduleId,
    classNumber: titleMeta.classNumber,
    label: titleMeta.label,
    displayTitle: titleMeta.displayTitle,
    youtubeId,
    embedUrl: youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : null,
  };
};

const normalizeModuleEntry = (
  moduleItem: DiplomadoModule
): DiplomadoModuleEntry => {
  const classes = moduleItem.classes
    .map((item) => normalizeClassEntry(moduleItem.module_id, item))
    .sort((a, b) => {
      if (a.classNumber == null || b.classNumber == null) return 0;
      return a.classNumber - b.classNumber;
    });

  return {
    moduleId: moduleItem.module_id,
    slug: slugify(`modulo-${moduleItem.module_id}`),
    routeSegment: buildModuleRouteSegment(moduleItem.module_id),
    title: moduleItem.title,
    imageUrl: normalizeDiplomadoImageUrl(moduleItem.image_url ?? null),
    classes,
  };
};

export const getDiplomadoModules = (year?: number) =>
  getDiplomadosYear(year)
    .map((item) => normalizeModuleEntry(item))
    .sort((a, b) => a.moduleId - b.moduleId);

export const getDiplomadoModulesExact = (year: number) => {
  const raw = getDiplomadosYearExact(year);
  if (!raw) return null;

  return raw
    .map((item) => normalizeModuleEntry(item))
    .sort((a, b) => a.moduleId - b.moduleId);
};

export const findDiplomadoModule = (year: number, routeSegment: string) => {
  const modules = getDiplomadoModulesExact(year);
  if (!modules) return null;

  return modules.find((module) => module.routeSegment === routeSegment) ?? null;
};
