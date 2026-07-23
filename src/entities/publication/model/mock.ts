import { addDays, isSameLocalDay } from "@/shared/lib/date";
import type { Publication, PublicationFilter } from "@/entities/publication/model/types";

const today = new Date("2026-07-20T10:00:00+03:00");

export const publications: Publication[] = [
  {
    id: "pub-city-water",
    slug: "vazhnoe-ob-yavlenie-voda",
    type: "announcement",
    status: "published",
    title: "Плановые работы на водопроводе в центре",
    description:
      "Сегодня до вечера возможны краткие перебои с водой на нескольких центральных улицах. Коммунальная служба просит заранее сделать небольшой запас.",
    organization: {
      id: "org-museum",
      slug: "sudak-museum",
      name: "Городская служба"
    },
    validUntil: "2026-07-20T22:00:00+03:00",
    scheduleEntries: [],
    place: "Центр Судака",
    priceText: "Важно",
    isFree: true,
    category: "services",
    isPinned: true,
    updatedAt: "2026-07-20T08:00:00+03:00"
  },
  {
    id: "pub-jazz-evening",
    slug: "dzhazovyj-vecher-v-muzee",
    type: "event",
    status: "published",
    title: "Джазовый вечер во дворе музея",
    description:
      "Камерный концерт под открытым небом: местный квартет, легкая программа и спокойный вечерний формат.",
    organization: {
      id: "org-museum",
      slug: "sudak-museum",
      name: "Судакский музей"
    },
    startsAt: "2026-07-20T19:30:00+03:00",
    endsAt: "2026-07-20T21:00:00+03:00",
    scheduleEntries: [],
    place: "ул. Ленина, 23",
    priceText: "400 ₽",
    isFree: false,
    category: "culture",
    image:
      "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80",
    ageLimit: "12+",
    updatedAt: "2026-07-18T13:00:00+03:00"
  },
  {
    id: "pub-cafe-menu",
    slug: "sezonnoe-menyu-s-ryboj",
    type: "promo",
    status: "published",
    title: "Сезонное меню с черноморской рыбой",
    description:
      "В меню появились блюда с барабулей и ставридой. Акция действует до конца недели или пока есть свежая поставка.",
    organization: {
      id: "org-cafe",
      slug: "cafe-priboy",
      name: "Кафе Прибой"
    },
    validUntil: "2026-07-26T23:00:00+03:00",
    scheduleEntries: [],
    place: "Набережная, 8",
    priceText: "от 520 ₽",
    isFree: false,
    category: "food",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    updatedAt: "2026-07-19T12:30:00+03:00"
  },
  {
    id: "pub-kids-training",
    slug: "nabor-v-detskuyu-gruppu-plavaniya",
    type: "regular",
    status: "published",
    title: "Набор в детскую группу плавания",
    description:
      "Группа для детей 7-10 лет. Первое занятие можно посетить как пробное, запись по телефону клуба.",
    organization: {
      id: "org-sport",
      slug: "sport-volna",
      name: "Спорт-клуб Волна"
    },
    schedule: "Пн, ср, пт в 17:00",
    scheduleEntries: [
      { text: "Понедельник в 17:00", weekday: 1, startsAt: "17:00", timezone: "Europe/Moscow" },
      { text: "Среда в 17:00", weekday: 3, startsAt: "17:00", timezone: "Europe/Moscow" },
      { text: "Пятница в 17:00", weekday: 5, startsAt: "17:00", timezone: "Europe/Moscow" }
    ],
    validUntil: "2026-08-31T21:00:00+03:00",
    place: "ул. Морская, 14",
    priceText: "Пробное бесплатно",
    isFree: true,
    category: "sport",
    image:
      "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80",
    ageLimit: "7-10",
    updatedAt: "2026-07-17T09:00:00+03:00"
  },
  {
    id: "pub-morning-walk",
    slug: "utrennyaya-progulka-k-kreposti",
    type: "event",
    status: "published",
    title: "Утренняя прогулка к крепости",
    description:
      "Маршрут для небольшой группы с остановками у видовых точек. Подходит для спокойного темпа.",
    organization: {
      id: "org-tour",
      slug: "tropa-sokola",
      name: "Тропа Сокола"
    },
    startsAt: "2026-07-21T08:30:00+03:00",
    endsAt: "2026-07-21T11:00:00+03:00",
    scheduleEntries: [],
    place: "старт от автостанции",
    priceText: "900 ₽",
    isFree: false,
    category: "excursions",
    image:
      "https://images.unsplash.com/photo-1473773508845-188df298d2d1?auto=format&fit=crop&w=1200&q=80",
    updatedAt: "2026-07-16T15:00:00+03:00"
  },
  {
    id: "pub-free-delivery",
    slug: "besplatnaya-dostavka-obedov",
    type: "promo",
    status: "published",
    title: "Бесплатная доставка обедов по центру",
    description: "Кафе доставляет обеды без платы за доставку при заказе от двух порций.",
    organization: {
      id: "org-cafe",
      slug: "cafe-priboy",
      name: "Кафе Прибой"
    },
    validUntil: "2026-07-24T18:00:00+03:00",
    scheduleEntries: [],
    place: "центр и набережная",
    priceText: "доставка бесплатно",
    isFree: true,
    category: "food",
    updatedAt: "2026-07-18T11:20:00+03:00"
  },
  {
    id: "pub-cancelled-market",
    slug: "vechernij-market-otmenen",
    type: "event",
    status: "cancelled",
    title: "Вечерний маркет у набережной отменен",
    description: "Организаторы сообщили об отмене сегодняшнего маркета. Новая дата появится отдельно.",
    organization: {
      id: "org-cafe",
      slug: "cafe-priboy",
      name: "Кафе Прибой"
    },
    startsAt: "2026-07-20T18:00:00+03:00",
    endsAt: "2026-07-20T21:00:00+03:00",
    scheduleEntries: [],
    place: "Набережная",
    priceText: "Бесплатно",
    isFree: true,
    category: "culture",
    updatedAt: "2026-07-20T09:10:00+03:00"
  },
  {
    id: "pub-old",
    slug: "vcherashnij-koncert",
    type: "event",
    status: "completed",
    title: "Вчерашний концерт",
    description: "Эта публикация нужна в mock-данных, чтобы проверить скрытие завершенных событий.",
    organization: {
      id: "org-museum",
      slug: "sudak-museum",
      name: "Судакский музей"
    },
    startsAt: "2026-07-19T18:00:00+03:00",
    endsAt: "2026-07-19T19:30:00+03:00",
    scheduleEntries: [],
    place: "ул. Ленина, 23",
    priceText: "300 ₽",
    isFree: false,
    category: "culture",
    updatedAt: "2026-07-19T20:00:00+03:00"
  }
];

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

export function getPublicationBySlug(slug: string) {
  return publications.find((publication) => publication.slug === slug);
}

export function getPublicationById(id: string) {
  return publications.find((publication) => publication.id === id);
}

export function getVisiblePublications() {
  return publications.filter((publication) => publication.status !== "completed");
}

export function getPinnedPublication() {
  return getVisiblePublications().find((publication) => publication.isPinned);
}

export function getPublicationsByOrganization(organizationId: string) {
  return getVisiblePublications().filter((publication) => publication.organization.id === organizationId);
}

export function filterPublications(filter: PublicationFilter) {
  const visible = getVisiblePublications().filter((publication) => !publication.isPinned);

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
