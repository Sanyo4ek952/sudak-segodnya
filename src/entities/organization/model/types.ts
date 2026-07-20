export type OrganizationCategory =
  | "food"
  | "delivery"
  | "kids"
  | "culture"
  | "excursions"
  | "rental"
  | "shops"
  | "services";

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
  category: OrganizationCategory;
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

export const organizationCategoryLabels: Record<OrganizationCategory, string> = {
  food: "Еда",
  delivery: "Доставка",
  kids: "Детям",
  culture: "Культура",
  excursions: "Экскурсии",
  rental: "Прокат",
  shops: "Магазины",
  services: "Услуги"
};
