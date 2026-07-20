import { addDays, isSameLocalDay } from "@/shared/lib/date";
import type { Publication, PublicationFilter } from "@/entities/publication/model/types";

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

export function filterPublications(
  publications: Publication[],
  filter: PublicationFilter,
  today = new Date()
) {
  const visible = publications.filter((publication) => !publication.isPinned);

  if (filter === "all") {
    return visible;
  }

  if (filter === "today") {
    return visible.filter((publication) =>
      publication.startsAt ? isSameLocalDay(publication.startsAt, today) : false
    );
  }

  if (filter === "tomorrow") {
    const tomorrow = addDays(today, 1);
    return visible.filter((publication) =>
      publication.startsAt ? isSameLocalDay(publication.startsAt, tomorrow) : false
    );
  }

  if (filter === "kids") {
    return visible.filter((publication) => publication.category === "kids" || publication.ageLimit);
  }

  if (filter === "sport") {
    return visible.filter((publication) => publication.category === "sport");
  }

  if (filter === "free") {
    return visible.filter((publication) => publication.isFree);
  }

  return visible.filter((publication) => publication.category === filter);
}
