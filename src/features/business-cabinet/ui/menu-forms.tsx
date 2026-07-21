"use client";

import { useActionState } from "react";
import { saveMenuCategoryAction, saveMenuItemAction } from "@/features/business-cabinet/model/actions";
import { initialBusinessActionState } from "@/features/business-cabinet/model/types";
import type { BusinessMenuCategory } from "@/features/business-cabinet/model/types";
import type { Tables } from "@/shared/api/supabase/database.types";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

export function MenuCategoryForm({
  organizationId,
  category
}: {
  organizationId: string;
  category?: BusinessMenuCategory;
}) {
  const [state, action] = useActionState(saveMenuCategoryAction, initialBusinessActionState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="categoryId" value={category?.id ?? ""} />
      <FormField id={`category-name-${category?.id ?? "new"}`} label="Раздел">
        <Input id={`category-name-${category?.id ?? "new"}`} name="name" required defaultValue={category?.name ?? ""} />
      </FormField>
      <FormField id={`category-description-${category?.id ?? "new"}`} label="Описание">
        <Textarea id={`category-description-${category?.id ?? "new"}`} name="description" defaultValue={category?.description ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`category-sort-${category?.id ?? "new"}`} label="Порядок">
          <Input id={`category-sort-${category?.id ?? "new"}`} name="sortOrder" type="number" min="0" defaultValue={category?.sort_order ?? 0} />
        </FormField>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-border bg-surface px-3 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={category?.is_active ?? true} />
          Показывать раздел
        </label>
      </div>
      <BusinessActionMessage state={state} />
      <SubmitButton size="sm" pendingLabel="Сохраняем...">Сохранить раздел</SubmitButton>
    </form>
  );
}

export function MenuItemForm({
  organizationId,
  categories,
  item,
  compact = false
}: {
  organizationId: string;
  categories: BusinessMenuCategory[];
  item?: Tables<"menu_items">;
  compact?: boolean;
}) {
  const [state, action] = useActionState(saveMenuItemAction, initialBusinessActionState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="itemId" value={item?.id ?? ""} />
      <FormField id={`menuItemCategory-${item?.id ?? "new"}`} label="Раздел">
        <Select
          id={`menuItemCategory-${item?.id ?? "new"}`}
          name="categoryId"
          defaultValue={item?.category_id ?? categories[0]?.id ?? ""}
        >
          <option value="">Без раздела</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      </FormField>
      <FormField id={`menuItemTitle-${item?.id ?? "new"}`} label="Название позиции">
        <Input id={`menuItemTitle-${item?.id ?? "new"}`} name="title" required defaultValue={item?.title ?? ""} />
      </FormField>
      <FormField id={`menuItemDescription-${item?.id ?? "new"}`} label="Описание">
        <Textarea id={`menuItemDescription-${item?.id ?? "new"}`} name="description" defaultValue={item?.description ?? ""} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`menuItemPrice-${item?.id ?? "new"}`} label="Цена">
          <Input id={`menuItemPrice-${item?.id ?? "new"}`} name="priceText" defaultValue={item?.price_text ?? ""} />
        </FormField>
        <FormField id={`menuItemSort-${item?.id ?? "new"}`} label="Порядок">
          <Input id={`menuItemSort-${item?.id ?? "new"}`} name="sortOrder" type="number" min="0" defaultValue={item?.sort_order ?? 0} />
        </FormField>
      </div>
      <label className="flex min-h-11 items-center gap-3 rounded-md border border-border bg-surface px-3 text-sm">
        <input type="checkbox" name="isAvailable" defaultChecked={item?.is_available ?? true} />
        Доступно
      </label>
      <BusinessActionMessage state={state} />
      <SubmitButton size="sm" pendingLabel="Сохраняем...">
        {compact ? "Сохранить позицию" : "Добавить позицию"}
      </SubmitButton>
    </form>
  );
}
