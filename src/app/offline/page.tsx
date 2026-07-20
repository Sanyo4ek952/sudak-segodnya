import { LinkButton } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-form space-y-6">
      <SectionHeader
        as="h1"
        title="Нет соединения"
        description="Приложение не смогло загрузить свежие данные. Проверьте интернет и попробуйте снова."
      />

      <Card>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-foreground-muted">
            Offline-режим показывает только безопасные сохраненные публичные страницы и служебные файлы приложения.
            Актуальность публикаций, погоды, организаций и данных кабинетов без сети не гарантируется.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/" variant="primary">
              На главную
            </LinkButton>
            <LinkButton href="/offline" variant="outline">
              Повторить
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
