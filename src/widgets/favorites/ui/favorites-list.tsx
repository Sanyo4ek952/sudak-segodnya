"use client";

import { useEffect, useState } from "react";
import { getPublicationById } from "@/entities/publication/model/mock";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { getOrganizationById } from "@/entities/organization/model/mock";
import { OrganizationCard } from "@/entities/organization/ui/organization-card";
import { readFavorites, type FavoriteItem } from "@/features/save-favorite/model/favorites";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";

export function FavoritesList() {
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readFavorites());
    sync();
    window.addEventListener("favorites-updated", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("favorites-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const favoritePublications = items
    .filter((item) => item.type === "publication")
    .map((item) => getPublicationById(item.id))
    .filter(Boolean);
  const favoriteOrganizations = items
    .filter((item) => item.type === "organization")
    .map((item) => getOrganizationById(item.id))
    .filter(Boolean);

  if (!favoritePublications.length && !favoriteOrganizations.length) {
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
      {favoritePublications.length ? (
        <section className="space-y-4">
          <SectionHeader title="Публикации" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoritePublications.map((publication) =>
              publication ? <PublicationCard key={publication.id} publication={publication} /> : null
            )}
          </div>
        </section>
      ) : null}

      {favoriteOrganizations.length ? (
        <section className="space-y-4">
          <SectionHeader title="Организации" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {favoriteOrganizations.map((organization) =>
              organization ? <OrganizationCard key={organization.id} organization={organization} /> : null
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
