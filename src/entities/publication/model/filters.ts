import type { Publication, PublicationFilter } from "@/entities/publication/model/types";

type PublicationFilterSearchParam = string | string[] | undefined;

export type PublicationFilterSearchParams = {
  filter?: PublicationFilterSearchParam;
};

export const filterItems: Array<{ value: PublicationFilter; label: string }> = [
  { value: "all", label: "всё" },
  { value: "today", label: "сегодня" },
  { value: "tomorrow", label: "завтра" },
  { value: "kids", label: "детям" },
  { value: "food", label: "еда" },
  { value: "culture", label: "культура" },
  { value: "sport", label: "спорт и кружки" },
  { value: "free", label: "бесплатно" }
];

function isPublicationFilter(value: string): value is PublicationFilter {
  return filterItems.some((item) => item.value === value);
}

export function normalizePublicationFilter({ filter }: PublicationFilterSearchParams): PublicationFilter {
  if (Array.isArray(filter)) {
    return "all";
  }

  const value = filter?.trim();

  return value && isPublicationFilter(value) ? value : "all";
}

const sudakOffsetMs = 3 * 60 * 60 * 1000;

export function getSudakDayInterval(reference: Date, daysFromReference = 0) {
  const shiftedReference = new Date(reference.getTime() + sudakOffsetMs);
  const start = new Date(
    Date.UTC(
      shiftedReference.getUTCFullYear(),
      shiftedReference.getUTCMonth(),
      shiftedReference.getUTCDate() + daysFromReference
    ) - sudakOffsetMs
  );

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000)
  };
}

function getSudakIsoWeekday(date: Date) {
  const shifted = new Date(date.getTime() + sudakOffsetMs);
  const weekday = shifted.getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function isPublicationRelevantOnDay(publication: Publication, day: Date) {
  const { start, end } = getSudakDayInterval(day);

  if (publication.type === "event") {
    if (!publication.startsAt) {
      return false;
    }

    const startsAt = new Date(publication.startsAt);
    const endsAt = new Date(publication.endsAt ?? publication.startsAt);
    return startsAt < end && endsAt >= start;
  }

  if (!publication.validUntil || new Date(publication.validUntil) < start) {
    return false;
  }

  if (publication.type !== "regular") {
    return true;
  }

  const weekday = getSudakIsoWeekday(start);
  return publication.scheduleEntries.some(
    (entry) => entry.weekday === undefined || entry.weekday === weekday
  );
}

function getRelevanceRank(publication: Publication, reference: Date) {
  const now = reference.getTime();

  if (publication.isPinned) {
    return { rank: 0, time: 0 };
  }

  if (publication.type === "event" && publication.startsAt) {
    const startsAt = new Date(publication.startsAt).getTime();
    const endsAt = new Date(publication.endsAt ?? publication.startsAt).getTime();

    if (startsAt <= now && endsAt >= now) {
      return { rank: 1, time: endsAt };
    }

    if (startsAt > now) {
      return { rank: 2, time: startsAt };
    }
  }

  if (publication.validUntil) {
    const validUntil = new Date(publication.validUntil).getTime();

    if (validUntil >= now && validUntil <= now + 24 * 60 * 60 * 1000) {
      return { rank: 3, time: validUntil };
    }
  }

  if (publication.type === "regular" && isPublicationRelevantOnDay(publication, reference)) {
    const firstStart = publication.scheduleEntries
      .map((entry) => entry.startsAt)
      .filter((value): value is string => Boolean(value))
      .sort()[0];
    const time = firstStart
      ? Number(firstStart.replace(":", ""))
      : Number.MAX_SAFE_INTEGER;
    return { rank: 4, time };
  }

  const publishedTime = new Date(publication.publishedAt ?? publication.updatedAt).getTime();

  if (publication.type === "news") {
    return { rank: 5, time: -publishedTime };
  }

  return { rank: 6, time: -publishedTime };
}

export function sortPublicationsByRelevance(
  publications: Publication[],
  reference = new Date()
) {
  return publications.slice().sort((left, right) => {
    const leftRank = getRelevanceRank(left, reference);
    const rightRank = getRelevanceRank(right, reference);

    return leftRank.rank - rightRank.rank
      || leftRank.time - rightRank.time
      || left.id.localeCompare(right.id);
  });
}

export function filterPublications(
  publications: Publication[],
  filter: PublicationFilter,
  today = new Date()
) {
  const visible = publications.filter(
    (publication) => !publication.isPinned && publication.status !== "completed"
  );

  if (filter === "all") {
    return sortPublicationsByRelevance(visible, today);
  }

  if (filter === "today") {
    return sortPublicationsByRelevance(
      visible.filter((publication) => isPublicationRelevantOnDay(publication, today)),
      today
    );
  }

  if (filter === "tomorrow") {
    const tomorrow = getSudakDayInterval(today, 1).start;
    return sortPublicationsByRelevance(
      visible.filter((publication) => isPublicationRelevantOnDay(publication, tomorrow)),
      tomorrow
    );
  }

  if (filter === "kids") {
    return sortPublicationsByRelevance(
      visible.filter((publication) => publication.category === "kids" || publication.ageLimit),
      today
    );
  }

  if (filter === "sport") {
    return sortPublicationsByRelevance(
      visible.filter((publication) => publication.category === "sport"),
      today
    );
  }

  if (filter === "free") {
    return sortPublicationsByRelevance(
      visible.filter((publication) => publication.isFree),
      today
    );
  }

  return sortPublicationsByRelevance(
    visible.filter((publication) => publication.category === filter),
    today
  );
}
