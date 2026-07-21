export type OrganizationType =
  | "food"
  | "delivery"
  | "kids"
  | "culture"
  | "excursions"
  | "rental_entertainment"
  | "shops"
  | "services"
  | "administration";

export type OrganizationService = {
  id: string;
  title: string;
  description: string;
  priceText: string;
  isAvailable: boolean;
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  type: OrganizationType;
  description: string;
  address: string;
  phone: string;
  workingHours: string;
  logo?: string;
  cover?: string;
  services: OrganizationService[];
  activePublicationIds: string[];
  updatedAt: string;
};

export const organizationTypeLabels: Record<OrganizationType, string> = {
  food: "Рестораны и кафе",
  delivery: "Доставка",
  kids: "Кружки и секции",
  culture: "Культура",
  excursions: "Экскурсии",
  rental_entertainment: "Прокат и развлечения",
  shops: "Магазины",
  services: "Услуги",
  administration: "Администрация"
};
