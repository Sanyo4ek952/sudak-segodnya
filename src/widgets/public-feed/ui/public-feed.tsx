"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicationCard } from "@/entities/publication/ui/publication-card";
import type { ImportantAnnouncement } from "@/entities/publication/api/publications";
import type { Publication, PublicationFilter } from "@/entities/publication/model/types";
import { FeedFilters } from "@/widgets/public-feed/ui/feed-filters";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/error-state";
import { Card, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { formatDate } from "@/shared/lib/date";

type PublicFeedProps = {
  publications: Publication[];
  importantAnnouncement: ImportantAnnouncement | null;
  filter: PublicationFilter;
  nextCursor: string | null;
  error?: string | null;
};

type FeedResponse = {
  publications: Publication[];
  nextCursor: string | null;
  error: string | null;
};

export function PublicFeed({
  publications: initialPublications,
  importantAnnouncement,
  filter,
  nextCursor: initialNextCursor,
  error = null
}: PublicFeedProps) {
  const [publications, setPublications] = useState(initialPublications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const importantAnnouncementCard = importantAnnouncement ? (
    <Card className="border-info bg-surface">
      <CardContent className="space-y-2 py-3 sm:space-y-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Важно</Badge>
          {importantAnnouncement.activeUntil ? (
            <span className="text-sm text-foreground-muted">
              до {formatDate(importantAnnouncement.activeUntil)}
            </span>
          ) : null}
          {importantAnnouncement.publicationSlug ? (
            <span className="ml-auto text-sm font-medium text-info group-hover:underline">
              Открыть
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-base font-semibold leading-6 sm:text-lg">
            {importantAnnouncement.title}
          </h2>
          <p className="hidden text-sm leading-6 text-foreground-muted sm:line-clamp-2 sm:block">
            {importantAnnouncement.description}
          </p>
        </div>
      </CardContent>
    </Card>
  ) : null;

  async function loadMore() {
    if (!nextCursor || loadState === "loading") {
      return;
    }

    setLoadState("loading");

    try {
      const search = new URLSearchParams({ filter, cursor: nextCursor });
      const response = await fetch(`/api/publications?${search.toString()}`, {
        cache: "no-store"
      });
      const result = await response.json() as FeedResponse;

      if (!response.ok || result.error) {
        setLoadState("error");
        return;
      }

      setPublications((current) => {
        const existingIds = new Set(current.map((publication) => publication.id));
        return [
          ...current,
          ...result.publications.filter((publication) => !existingIds.has(publication.id))
        ];
      });
      setNextCursor(result.nextCursor);
      setLoadState("idle");
    } catch {
      setLoadState("error");
    }
  }

  return (
    <section className="space-y-4 sm:space-y-5">
      {importantAnnouncementCard ? (
        importantAnnouncement?.publicationSlug ? (
          <Link
            href={`/publications/${importantAnnouncement.publicationSlug}`}
            aria-label={`Открыть важное объявление: ${importantAnnouncement.title}`}
            className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
          >
            {importantAnnouncementCard}
          </Link>
        ) : (
          importantAnnouncementCard
        )
      ) : null}

      <div className="space-y-2">
        <div>
          <h2 className="text-xl font-semibold">Городская лента</h2>
          <p className="hidden text-sm leading-6 text-foreground-muted sm:block">
            Сначала — происходящее сейчас и ближайшее по времени.
          </p>
        </div>
        <FeedFilters value={filter} />
      </div>

      {error ? (
        <ErrorState title="Лента временно недоступна" description={error} />
      ) : publications.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publications.map((publication) => (
            <PublicationCard key={publication.id} publication={publication} />
          ))}
        </div>
      ) : filter !== "all" ? (
        <EmptyState
          title="По этому фильтру пока ничего нет"
          description="Попробуйте выбрать другой фильтр или вернуться ко всем публикациям."
          actionLabel="Сбросить фильтр"
          actionHref="/"
        />
      ) : (
        <EmptyState
          title="Публикаций пока нет"
          description="Попробуйте открыть каталог организаций."
          actionLabel="Перейти в каталог"
          actionHref="/organizations"
        />
      )}

      {!error && publications.length ? (
        <div className="flex flex-col items-center gap-3">
          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              onClick={loadMore}
              disabled={loadState === "loading"}
            >
              {loadState === "loading" ? "Загружаем..." : "Показать ещё"}
            </Button>
          ) : (
            <p className="text-center text-sm text-foreground-muted">Актуальные публикации закончились.</p>
          )}
          {loadState === "error" ? (
            <p role="alert" className="text-center text-sm text-error">
              Не удалось загрузить следующую часть. Попробуйте ещё раз.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
