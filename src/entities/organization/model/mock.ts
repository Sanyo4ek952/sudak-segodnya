import type { Organization } from "@/entities/organization/model/types";

export const organizations: Organization[] = [
  {
    id: "org-museum",
    slug: "sudak-museum",
    name: "Судакский музей",
    category: "culture",
    description: "Небольшой городской музей с выставками о Судаке, крепости и местных традициях.",
    address: "ул. Ленина, 23",
    phone: "+7 978 000-21-23",
    workingHours: "Вт-вс, 10:00-18:00",
    cover:
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80",
    services: [
      {
        id: "museum-ticket",
        title: "Входной билет",
        description: "Постоянная экспозиция и временная выставка.",
        priceText: "250 ₽",
        isAvailable: true
      }
    ],
    activePublicationIds: ["pub-jazz-evening", "pub-museum-hours"],
    updatedAt: "2026-07-18T10:00:00+03:00"
  },
  {
    id: "org-cafe",
    slug: "cafe-priboy",
    name: "Кафе Прибой",
    category: "food",
    description: "Семейное кафе рядом с набережной: завтраки, рыба, детское меню и сезонные предложения.",
    address: "Набережная, 8",
    phone: "+7 978 000-45-45",
    workingHours: "Ежедневно, 09:00-23:00",
    logo:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80",
    cover:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
    services: [
      {
        id: "fish-lunch",
        title: "Рыбный обед",
        description: "Суп, горячее и напиток.",
        priceText: "690 ₽",
        isAvailable: true
      },
      {
        id: "kids-breakfast",
        title: "Детский завтрак",
        description: "Каша, сырники или омлет на выбор.",
        priceText: "320 ₽",
        isAvailable: true
      }
    ],
    activePublicationIds: ["pub-cafe-menu", "pub-free-delivery"],
    updatedAt: "2026-07-19T12:30:00+03:00"
  },
  {
    id: "org-sport",
    slug: "sport-volna",
    name: "Спорт-клуб Волна",
    category: "kids",
    description: "Тренировки для детей и взрослых: плавание, ОФП и летние группы на открытом воздухе.",
    address: "ул. Морская, 14",
    phone: "+7 978 000-67-67",
    workingHours: "Пн-сб, 08:00-21:00",
    cover:
      "https://images.unsplash.com/photo-1519311965067-36d3e5f33d39?auto=format&fit=crop&w=1200&q=80",
    services: [
      {
        id: "kids-training",
        title: "Детская группа",
        description: "Занятия 3 раза в неделю.",
        priceText: "от 3 500 ₽/мес",
        isAvailable: true
      }
    ],
    activePublicationIds: ["pub-kids-training"],
    updatedAt: "2026-07-17T09:00:00+03:00"
  },
  {
    id: "org-tour",
    slug: "tropa-sokola",
    name: "Тропа Сокола",
    category: "excursions",
    description: "Пешеходные экскурсии по окрестностям Судака с понятным темпом и небольшими группами.",
    address: "старт от автостанции Судак",
    phone: "+7 978 000-88-11",
    workingHours: "По расписанию экскурсий",
    cover:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    services: [
      {
        id: "morning-route",
        title: "Утренняя прогулка",
        description: "Маршрут на 2,5 часа с остановками для фото.",
        priceText: "900 ₽",
        isAvailable: true
      }
    ],
    activePublicationIds: ["pub-morning-walk"],
    updatedAt: "2026-07-16T15:00:00+03:00"
  }
];

export function getOrganizationBySlug(slug: string) {
  return organizations.find((organization) => organization.slug === slug);
}

export function getOrganizationById(id: string) {
  return organizations.find((organization) => organization.id === id);
}
