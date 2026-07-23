import type { Tables } from "@/shared/api/supabase/database.types";

export type BusinessActionState = {
  status: "idle" | "success" | "error";
  message: string;
  publicationId?: string;
  publicationHref?: string;
  imageUrl?: string;
  imageRemoved?: boolean;
  invitationUrl?: string;
  logoUrl?: string;
  coverUrl?: string;
  logoRemoved?: boolean;
  coverRemoved?: boolean;
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
  media_assets: Array<
    Pick<
      Tables<"media_assets">,
      "id" | "bucket_id" | "storage_path" | "purpose" | "sort_order" | "deleted_at"
    >
  >;
  logoUrl?: string;
  coverUrl?: string;
};

export type BusinessMembership = Tables<"organization_members"> & {
  organizations: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
};

export type BusinessPublication = Tables<"publications"> & {
  publication_categories: Pick<Tables<"publication_categories">, "id" | "name" | "slug"> | null;
  publication_schedules: Array<
    Pick<
      Tables<"publication_schedules">,
      "id" | "schedule_text" | "weekday" | "starts_at" | "ends_at" | "sort_order" | "timezone"
    >
  >;
  media_assets: Array<
    Pick<
      Tables<"media_assets">,
      "id" | "bucket_id" | "storage_path" | "purpose" | "sort_order" | "deleted_at"
    >
  >;
  imageUrl?: string;
};

export type BusinessMenuItem = Tables<"menu_items"> & {
  media_assets: Array<
    Pick<
      Tables<"media_assets">,
      "id" | "bucket_id" | "storage_path" | "purpose" | "sort_order" | "deleted_at"
    >
  >;
  imageUrl?: string;
};

export type BusinessMenuCategory = Tables<"menu_categories"> & {
  menu_items: BusinessMenuItem[];
};

export type OrganizationRepresentative = {
  member_id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: Tables<"organization_members">["role"];
  is_active: boolean;
  added_at: string;
};

export type OrganizationInvitation = Pick<
  Tables<"organization_member_invitations">,
  "id" | "email" | "role" | "status" | "expires_at" | "created_at"
>;
