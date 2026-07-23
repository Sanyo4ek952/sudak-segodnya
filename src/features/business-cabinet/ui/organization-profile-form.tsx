"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { updateOrganizationProfileAction } from "@/features/business-cabinet/model/actions";
import { initialBusinessActionState } from "@/features/business-cabinet/model/types";
import type { BusinessOrganization } from "@/features/business-cabinet/model/types";
import type { Tables } from "@/shared/api/supabase/database.types";
import { BusinessActionMessage } from "@/features/business-cabinet/ui/business-action-message";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { SubmitButton } from "@/shared/ui/submit-button";
import { Textarea } from "@/shared/ui/textarea";

function getContactLink(organization: BusinessOrganization, key: string) {
  const links = organization.contact_links;

  if (
    typeof links === "object"
    && links !== null
    && !Array.isArray(links)
    && key in links
    && typeof links[key] === "string"
  ) {
    return links[key];
  }

  return "";
}

export function OrganizationProfileForm({
  organization,
  organizationTypes
}: {
  organization: BusinessOrganization;
  organizationTypes: Array<Pick<Tables<"organization_types">, "id" | "name">>;
}) {
  const [state, action] = useActionState(updateOrganizationProfileAction, initialBusinessActionState);
  const [localLogoUrl, setLocalLogoUrl] = useState<string>();
  const [localCoverUrl, setLocalCoverUrl] = useState<string>();
  const logoUrl = state.logoRemoved ? undefined : state.logoUrl ?? localLogoUrl ?? organization.logoUrl;
  const coverUrl = state.coverRemoved ? undefined : state.coverUrl ?? localCoverUrl ?? organization.coverUrl;

  useEffect(() => {
    return () => {
      if (localLogoUrl) URL.revokeObjectURL(localLogoUrl);
      if (localCoverUrl) URL.revokeObjectURL(localCoverUrl);
    };
  }, [localLogoUrl, localCoverUrl]);

  function previewFile(
    file: File | undefined,
    currentUrl: string | undefined,
    setter: (value: string | undefined) => void
  ) {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    setter(file ? URL.createObjectURL(file) : undefined);
  }

  return (
    <form action={action} className="space-y-6" encType="multipart/form-data">
      <input type="hidden" name="organizationId" value={organization.id} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Основные данные</h2>
        <FormField
          id="typeId"
          label="Основной тип"
          hint="Изменение типа вступит в силу только после проверки администратора."
        >
          <Select
            id="typeId"
            name="typeId"
            defaultValue={organization.pending_type_id ?? organization.type_id}
            required
          >
            {organizationTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </Select>
        </FormField>
        {organization.pending_type_id ? (
          <p className="rounded-md bg-warning/10 p-3 text-sm text-foreground">
            Запрос на смену основного типа ожидает проверки администратора.
          </p>
        ) : null}
        <FormField id="name" label="Название">
          <Input id="name" name="name" required defaultValue={organization.name} maxLength={160} />
        </FormField>
        <FormField id="description" label="Описание">
          <Textarea
            id="description"
            name="description"
            required
            defaultValue={organization.description ?? ""}
            maxLength={2000}
            rows={7}
          />
        </FormField>
      </section>

      <section className="space-y-4 border-t border-border pt-5">
        <h2 className="text-lg font-semibold">Адрес и контакты</h2>
        <FormField id="address" label="Адрес">
          <Input id="address" name="address" required defaultValue={organization.address ?? ""} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="latitude" label="Широта">
            <Input
              id="latitude"
              name="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              defaultValue={organization.latitude ?? ""}
            />
          </FormField>
          <FormField id="longitude" label="Долгота">
            <Input
              id="longitude"
              name="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              defaultValue={organization.longitude ?? ""}
            />
          </FormField>
        </div>
        <FormField id="phone" label="Телефон">
          <Input id="phone" name="phone" type="tel" required defaultValue={organization.phone ?? ""} />
        </FormField>
        <FormField id="workingHours" label="График работы">
          <Textarea id="workingHours" name="workingHours" defaultValue={organization.working_hours ?? ""} />
        </FormField>
        <div className="grid gap-4">
          <FormField id="website" label="Сайт">
            <Input
              id="website"
              name="website"
              type="url"
              placeholder="https://example.ru"
              defaultValue={getContactLink(organization, "website")}
            />
          </FormField>
          <FormField id="telegram" label="Telegram">
            <Input
              id="telegram"
              name="telegram"
              type="url"
              placeholder="https://t.me/..."
              defaultValue={getContactLink(organization, "telegram")}
            />
          </FormField>
          <FormField id="vk" label="ВКонтакте">
            <Input
              id="vk"
              name="vk"
              type="url"
              placeholder="https://vk.com/..."
              defaultValue={getContactLink(organization, "vk")}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-5 border-t border-border pt-5">
        <div>
          <h2 className="text-lg font-semibold">Изображения</h2>
          <p className="text-sm leading-6 text-foreground-muted">JPG, PNG или WebP до 5 МБ.</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Логотип</h3>
          {logoUrl ? (
            <div className="relative h-32 w-32 overflow-hidden rounded-lg bg-surface-muted">
              <Image src={logoUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : null}
          <FormField id="logo" label={logoUrl ? "Заменить логотип" : "Загрузить логотип"}>
            <Input
              id="logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => previewFile(event.target.files?.[0], localLogoUrl, setLocalLogoUrl)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="upload-logo" variant="outline" pendingLabel="Загружаем...">
              Загрузить логотип
            </SubmitButton>
            {logoUrl ? (
              <SubmitButton
                name="intent"
                value="remove-logo"
                variant="ghost"
                aria-label="Удалить логотип"
                pendingLabel="Удаляем..."
              >
                Удалить
              </SubmitButton>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Обложка</h3>
          {coverUrl ? (
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-surface-muted">
              <Image src={coverUrl} alt="" fill unoptimized className="object-cover" />
            </div>
          ) : null}
          <FormField id="cover" label={coverUrl ? "Заменить обложку" : "Загрузить обложку"}>
            <Input
              id="cover"
              name="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => previewFile(event.target.files?.[0], localCoverUrl, setLocalCoverUrl)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="upload-cover" variant="outline" pendingLabel="Загружаем...">
              Загрузить обложку
            </SubmitButton>
            {coverUrl ? (
              <SubmitButton
                name="intent"
                value="remove-cover"
                variant="ghost"
                aria-label="Удалить обложку"
                pendingLabel="Удаляем..."
              >
                Удалить
              </SubmitButton>
            ) : null}
          </div>
        </div>
      </section>

      <BusinessActionMessage state={state} />
      <SubmitButton name="intent" value="save" pendingLabel="Сохраняем...">
        Сохранить профиль
      </SubmitButton>
    </form>
  );
}
