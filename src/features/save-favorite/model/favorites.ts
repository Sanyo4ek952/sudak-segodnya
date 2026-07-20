export type FavoriteType = "publication" | "organization";

export type FavoriteItem = {
  id: string;
  type: FavoriteType;
};

export const favoritesStorageKey = "sudak-today:favorites";

export function favoriteKey(type: FavoriteType, id: string) {
  return `${type}:${id}`;
}

export function readFavorites() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(favoritesStorageKey);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

export function writeFavorites(items: FavoriteItem[]) {
  window.localStorage.setItem(favoritesStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("favorites-updated"));
}
