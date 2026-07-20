"use client";

import { useMemo, useState } from "react";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { filterPublications, getPinnedPublication } from "@/entities/publication/model/mock";
import type { PublicationFilter } from "@/entities/publication/model/types";
import { FeedFilters } from "@/widgets/public-feed/ui/feed-filters";
import { EmptyState } from "@/shared/ui/empty-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { formatDate } from "@/shared/lib/date";

export function PublicFeed() {
  const [filter, setFilter] = useState<PublicationFilter>("all");
  const publications = useMemo(() => filterPublications(filter), [filter]);
  const pinned = getPinnedPublication();

  return (
    <section className="space-y-5">
      {pinned ? (
        <Card className="border-info bg-surface">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Важно</Badge>
              {pinned.validUntil ? <span className="text-sm text-foreground-muted">до {formatDate(pinned.validUntil)}</span> : null}
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{pinned.title}</h2>
              <p className="text-sm leading-6 text-foreground-muted">{pinned.description}</p>
            </div>
            <LinkButton href={`/publications/${pinned.slug}`} variant="outline" size="sm">
              Открыть
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <SectionHeader title="Городская лента" description="Актуальное на сегодня и ближайшие дни." />
        <FeedFilters value={filter} onChange={setFilter} />
      </div>

      {publications.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Публикаций пока нет"
          description="Попробуйте выбрать другой фильтр или открыть каталог организаций."
          actionLabel="Перейти в каталог"
          actionHref="/organizations"
        />
      )}

      {publications.length ? (
        <p className="text-center text-sm text-foreground-muted">Актуальные публикации закончились.</p>
      ) : null}
    </section>
  );
}
