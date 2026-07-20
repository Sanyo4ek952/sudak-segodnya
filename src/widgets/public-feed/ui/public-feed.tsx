"use client";

import { useMemo, useState } from "react";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import { filterPublications } from "@/entities/publication/model/filters";
import type { ImportantAnnouncement } from "@/entities/publication/api/publications";
import type { Publication } from "@/entities/publication/model/types";
import type { PublicationFilter } from "@/entities/publication/model/types";
import { FeedFilters } from "@/widgets/public-feed/ui/feed-filters";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { SectionHeader } from "@/shared/ui/section-header";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { LinkButton } from "@/shared/ui/button";
import { formatDate } from "@/shared/lib/date";

type PublicFeedProps = {
  publications: Publication[];
  importantAnnouncement: ImportantAnnouncement | null;
  error?: string | null;
};

export function PublicFeed({ publications, importantAnnouncement, error = null }: PublicFeedProps) {
  const [filter, setFilter] = useState<PublicationFilter>("all");
  const filteredPublications = useMemo(
    () => filterPublications(publications, filter),
    [filter, publications]
  );

  return (
    <section className="space-y-5">
      {importantAnnouncement ? (
        <Card className="border-info bg-surface">
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">Важно</Badge>
              {importantAnnouncement.activeUntil ? (
                <span className="text-sm text-foreground-muted">
                  до {formatDate(importantAnnouncement.activeUntil)}
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{importantAnnouncement.title}</h2>
              <p className="text-sm leading-6 text-foreground-muted">{importantAnnouncement.description}</p>
            </div>
            {importantAnnouncement.publicationSlug ? (
              <LinkButton href={`/publications/${importantAnnouncement.publicationSlug}`} variant="outline" size="sm">
                Открыть
              </LinkButton>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <SectionHeader title="Городская лента" description="Актуальное на сегодня и ближайшие дни." />
        <FeedFilters value={filter} onChange={setFilter} />
      </div>

      {error ? (
        <ErrorState title="Лента временно недоступна" description={error} />
      ) : filteredPublications.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPublications.map((publication) => (
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

      {!error && filteredPublications.length ? (
        <p className="text-center text-sm text-foreground-muted">Актуальные публикации закончились.</p>
      ) : null}
    </section>
  );
}
