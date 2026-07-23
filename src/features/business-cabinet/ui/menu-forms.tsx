"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { saveMenuCategoryAction, saveMenuItemAction } from "@/features/business-cabinet/model/actions";
import { initialBusinessActionState } from "@/features/business-cabinet/model/types";
import type {
  BusinessMenuCategory,
  BusinessMenuItem
} from "@/features/business-cabinet/model/types";
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
  item?: BusinessMenuItem;
  compact?: boolean;
}) {
  const [state, action] = useActionState(saveMenuItemAction, initialBusinessActionState);
  const [localImageUrl, setLocalImageUrl] = useState<string>();
  const imageUrl = state.imageRemoved
    ? undefined
    : state.imageUrl ?? localImageUrl ?? item?.imageUrl;

  useEffect(() => {
    return () => {
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl);
      }
    };
  }, [localImageUrl]);

  function selectImage(file?: File) {
    if (localImageUrl) {
      URL.revokeObjectURL(localImageUrl);
    }

    setLocalImageUrl(file ? URL.createObjectURL(file) : undefined);
  }

  return (
    <form action={action} className="space-y-4" encType="multipart/form-data">
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
      <div className="space-y-3">
        {imageUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-border bg-surface-muted">
            <Image src={imageUrl} alt="" fill unoptimized className="object-cover" />
          </div>
        ) : null}
        <FormField id={`menuItemImage-${item?.id ?? "new"}`} label={imageUrl ? "Заменить изображение" : "Изображение"}>
          <Input
            id={`menuItemImage-${item?.id ?? "new"}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
        </FormField>
        <p className="text-xs leading-5 text-foreground-muted">
          JPG, PNG или WebP до 5 МБ. Файл привязывается только к этой позиции.
        </p>
      </div>
      <BusinessActionMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          size="sm"
          name="intent"
          value={localImageUrl ? "upload-image" : "save"}
          pendingLabel="Сохраняем..."
        >
          {compact ? "Сохранить позицию" : "Добавить позицию"}
        </SubmitButton>
        {imageUrl && item ? (
          <SubmitButton
            size="sm"
            variant="outline"
            name="intent"
            value="remove-image"
            pendingLabel="Удаляем..."
          >
            Удалить изображение
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
