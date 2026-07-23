export type FavoriteType = "publication" | "organization";

export type FavoriteItem = {
  id: string;
  type: FavoriteType;
  label?: string;
  savedAt?: string;
};

export const favoritesStorageKey = "sudak-today:favorites";
let cachedRaw: string | null | undefined;
let cachedFavorites: FavoriteItem[] = [];

export function favoriteKey(type: FavoriteType, id: string) {
  return `${type}:${id}`;
}

export function readFavorites() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(favoritesStorageKey);

    if (raw === cachedRaw) {
      return cachedFavorites;
    }

    cachedRaw = raw;
    cachedFavorites = raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
    return cachedFavorites;
  } catch {
    return cachedFavorites;
  }
}

export function writeFavorites(items: FavoriteItem[]) {
  const raw = JSON.stringify(items);
  cachedRaw = raw;
  cachedFavorites = items;
  window.localStorage.setItem(favoritesStorageKey, raw);
  window.dispatchEvent(new Event("favorites-updated"));
}
