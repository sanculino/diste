import type { Locale } from "./config";

type ItDictionary = typeof import("./dictionaries/it").dictionary;
type EnDictionary = typeof import("./dictionaries/en").dictionary;

export type Dictionary = ItDictionary | EnDictionary;

/** PM Web Agent copy — EN adds optional international marketing block */
export type PmwaDictionary = ItDictionary["pmwa"] | EnDictionary["pmwa"];

const dictionaries: Record<
  Locale,
  () => Promise<{ dictionary: ItDictionary | EnDictionary }>
> = {
  it: () => import("./dictionaries/it"),
  en: () => import("./dictionaries/en"),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const mod = await dictionaries[locale]();
  return mod.dictionary;
}
