import type { Tables } from "@/shared/api/supabase/database.types";

export type BusinessActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialBusinessActionState: BusinessActionState = {
  status: "idle",
  message: ""
};

export const businessPublicationStatusLabels = {
  draft: "Черновик",
  scheduled: "Запланировано",
  moderation: "На модерации",
  published: "Опубликовано",
  cancelled: "Отменено",
  completed: "Завершено",
  hidden: "Скрыто",
  blocked: "Заблокировано"
} satisfies Record<Tables<"publications">["status"], string>;

export const businessPublicationTypeLabels = {
  event: "Мероприятие",
  announcement: "Объявление",
  promo: "Акция",
  regular: "Регулярное занятие",
  news: "Новость"
} satisfies Record<Tables<"publications">["type"], string>;

export type BusinessOrganization = Tables<"organizations"> & {
  organization_types: Pick<Tables<"organization_types">, "id" | "name" | "slug"> | null;
};

export type BusinessMembership = Tables<"organization_members"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
};

export type BusinessPublication = Tables<"publications"> & {
  publication_categories: Pick<Tables<"publication_categories">, "id" | "name" | "slug"> | null;
  publication_schedules: Array<Pick<Tables<"publication_schedules">, "id" | "schedule_text" | "sort_order">>;
};

export type BusinessMenuCategory = Tables<"menu_categories"> & {
  menu_items: Tables<"menu_items">[];
};
