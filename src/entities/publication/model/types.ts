export type PublicationType = "event" | "announcement" | "promo" | "regular" | "news";
export type PublicationStatus = "published" | "cancelled" | "completed";
export type PublicationCategory = string;
export type PublicationFilter =
  | "all"
  | "today"
  | "tomorrow"
  | "kids"
  | "food"
  | "culture"
  | "sport"
  | "free";

export type PublicationOrganization = {
  id: string;
  slug: string;
  name: string;
};

export type PublicationSchedule = {
  text: string;
  weekday?: number;
  startsAt?: string;
  endsAt?: string;
  timezone: string;
};

export type Publication = {
  id: string;
  slug: string;
  type: PublicationType;
  status: PublicationStatus;
  title: string;
  description: string;
  organization: PublicationOrganization;
  startsAt?: string;
  endsAt?: string;
  validUntil?: string;
  schedule?: string;
  scheduleEntries: PublicationSchedule[];
  place: string;
  priceText: string;
  isFree: boolean;
  category: PublicationCategory;
  image?: string;
  contactPhone?: string;
  ageLimit?: string;
  isPinned?: boolean;
  publishedAt?: string;
  updatedAt: string;
};

export const publicationTypeLabels: Record<PublicationType, string> = {
  event: "Мероприятие",
  announcement: "Объявление",
  promo: "Акция",
  regular: "Регулярно",
  news: "Новость"
};

export const publicationFilterLabels: Record<PublicationFilter, string> = {
  all: "всё",
  today: "сегодня",
  tomorrow: "завтра",
  kids: "детям",
  food: "еда",
  culture: "культура",
  sport: "спорт и кружки",
  free: "бесплатно"
};
