"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  favoriteKey,
  readFavorites,
  writeFavorites,
  type FavoriteType
} from "@/features/save-favorite/model/favorites";
import { trackAnalyticsEvent, type AnalyticsEventInput } from "@/features/analytics/model/events";

type FavoriteToggleProps = {
  id: string;
  type: FavoriteType;
  label: string;
  analytics?: Omit<AnalyticsEventInput, "eventName">;
};

export function FavoriteToggle({ id, type, label, analytics }: FavoriteToggleProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const key = useMemo(() => favoriteKey(type, id), [id, type]);

  useEffect(() => {
    const sync = () => {
      setIsFavorite(readFavorites().some((item) => favoriteKey(item.type, item.id) === key));
    };

    sync();
    window.addEventListener("favorites-updated", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("favorites-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  return (
    <Button
      type="button"
      variant={isFavorite ? "secondary" : "ghost"}
      size="icon"
      aria-label={isFavorite ? `Убрать из избранного: ${label}` : `Добавить в избранное: ${label}`}
      onClick={() => {
        const items = readFavorites();
        const exists = items.some((item) => favoriteKey(item.type, item.id) === key);
        writeFavorites(exists ? items.filter((item) => favoriteKey(item.type, item.id) !== key) : [...items, { id, type }]);

        if (!exists && analytics) {
          trackAnalyticsEvent({ eventName: "favorite_add", ...analytics });
        }
      }}
    >
      {isFavorite ? "★" : "☆"}
    </Button>
  );
}
