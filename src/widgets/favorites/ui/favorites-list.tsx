"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";
import type { Publication } from "@/entities/publication/model/types";
import type { Organization } from "@/entities/organization/model/types";
import {
  favoriteKey,
  readFavorites,
  writeFavorites,
  type FavoriteItem
} from "@/features/save-favorite/model/favorites";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

const serverFavorites: FavoriteItem[] = [];

type FavoritesResponse = {
  publications: Publication[];
  organizations: Organization[];
  error: string | null;
};

function subscribeFavorites(callback: () => void) {
  window.addEventListener("favorites-updated", callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("favorites-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

export function FavoritesList() {
  const items = useSyncExternalStore(subscribeFavorites, readFavorites, () => serverFavorites);
  const requestKey = useMemo(
    () => items.map((item) => favoriteKey(item.type, item.id)).sort().join("|"),
    [items]
  );
  const [result, setResult] = useState<FavoritesResponse & { key: string }>({
    publications: [],
    organizations: [],
    error: null,
    key: ""
  });

  useEffect(() => {
    const controller = new AbortController();
    const publicationIds = items.filter((item) => item.type === "publication").map((item) => item.id);
    const organizationIds = items.filter((item) => item.type === "organization").map((item) => item.id);

    void (async () => {
      if (!items.length) {
        setResult({ publications: [], organizations: [], error: null, key: requestKey });
        return;
      }

      try {
        const response = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicationIds, organizationIds }),
          signal: controller.signal
        });
        const payload = await response.json() as FavoritesResponse;

        if (!controller.signal.aborted) {
          setResult({
            publications: payload.publications ?? [],
            organizations: payload.organizations ?? [],
            error: response.ok ? payload.error : payload.error ?? "Не удалось загрузить избранное.",
            key: requestKey
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({
            publications: [],
            organizations: [],
            error: "Не удалось загрузить избранное.",
            key: requestKey
          });
        }
      }
    })();

    return () => controller.abort();
  }, [items, requestKey]);

  const isLoading = result.key !== requestKey;
  const loadedKeys = new Set([
    ...result.publications.map((publication) => favoriteKey("publication", publication.id)),
    ...result.organizations.map((organization) => favoriteKey("organization", organization.id))
  ]);
  const unavailableItems = isLoading
    ? []
    : items.filter((item) => !loadedKeys.has(favoriteKey(item.type, item.id)));

  if (!items.length) {
    return (
      <EmptyState
        title="В избранном пока пусто"
        description="Сохраняйте публикации и организации на этом устройстве. Регистрация для этого не нужна."
        actionLabel="Открыть ленту"
        actionHref="/"
      />
    );
  }

  return (
    <div className="space-y-8">
      {isLoading ? (
        <Card>
          <CardContent>
            <p className="text-sm text-foreground-muted" role="status">
              Загружаем сохранённые материалы…
            </p>
          </CardContent>
        </Card>
      ) : null}

      {result.error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-error" role="alert">{result.error}</p>
          </CardContent>
        </Card>
      ) : null}

      {result.publications.length ? (
        <section className="space-y-4">
          <SectionHeader title="Публикации" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.publications.map((publication) => (
              <PublicationCard key={publication.id} publication={publication} />
            ))}
          </div>
        </section>
      ) : null}

      {result.organizations.length ? (
        <section className="space-y-4">
          <SectionHeader title="Организации" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.organizations.map((organization) => (
              <OrganizationCard key={organization.id} organization={organization} />
            ))}
          </div>
        </section>
      ) : null}

      {unavailableItems.length ? (
        <section className="space-y-4">
          <SectionHeader
            title="Больше не актуально"
            description="Материал завершён, истёк, скрыт или удалён из публичного доступа."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {unavailableItems.map((item) => (
              <Card key={favoriteKey(item.type, item.id)}>
                <CardContent className="space-y-3">
                  <p className="font-medium">{item.label ?? "Сохранённый материал"}</p>
                  <p className="text-sm leading-6 text-foreground-muted">
                    {item.type === "publication" ? "Публикация" : "Организация"} больше не доступна публично.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => writeFavorites(
                      items.filter((candidate) =>
                        favoriteKey(candidate.type, candidate.id) !== favoriteKey(item.type, item.id)
                      )
                    )}
                  >
                    Удалить из избранного
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
