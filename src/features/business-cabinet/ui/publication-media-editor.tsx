"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  addBusinessPublicationPhotoAction,
  addBusinessPublicationVkAction,
  mutateBusinessPublicationMediaAction,
  type BusinessMediaActionState
} from "@/features/business-cabinet/model/publication-media-actions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export type BusinessPublicationMediaItem = {
  id: string;
  kind: "photo" | "video" | "clip";
  posterUrl: string;
  title?: string;
};

const initialState: BusinessMediaActionState = { status: "idle" };

export function PublicationMediaEditor({
  publicationId,
  items
}: {
  publicationId: string;
  items: BusinessPublicationMediaItem[];
}) {
  const [photoState, photoAction, photoPending] = useActionState(addBusinessPublicationPhotoAction, initialState);
  const [vkState, vkAction, vkPending] = useActionState(addBusinessPublicationVkAction, initialState);

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Галерея публикации</h3>
          <p className="mt-1 text-sm text-muted-foreground">До 10 фото, VK-видео и клипов. Первый элемент — обложка.</p>
        </div>
        <Badge variant={items.length >= 10 ? "warning" : undefined}>{items.length} из 10</Badge>
      </div>

      {items.length ? (
        <ol className="grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 rounded-xl border p-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <Image src={item.posterUrl} alt="" fill sizes="96px" className="object-cover" />
                {item.kind !== "photo" ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/20 text-2xl text-white" aria-hidden="true">▶</span>
                ) : null}
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge>{item.kind === "photo" ? "Фото" : item.kind === "clip" ? "Клип" : "Видео"}</Badge>
                  {index === 0 ? <Badge variant="success">Обложка</Badge> : null}
                </div>
                {item.title ? <p className="truncate text-sm">{item.title}</p> : null}
                <div className="flex flex-wrap gap-1">
                  {[
                    ["up", "Переместить выше", "↑"],
                    ["down", "Переместить ниже", "↓"],
                    ["cover", "Сделать обложкой", "★"],
                    ["delete", "Удалить", "×"]
                  ].map(([intent, label, glyph]) => (
                    <form key={String(intent)} action={mutateBusinessPublicationMediaAction}>
                      <input type="hidden" name="publicationId" value={publicationId} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="intent" value={String(intent)} />
                      <Button type="submit" size="sm" variant="ghost" aria-label={String(label)}>
                        <span aria-hidden="true" className={intent === "delete" ? "text-destructive" : ""}>{glyph}</span>
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Добавьте первое фото или VK-видео.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={photoAction} className="space-y-2 rounded-xl border p-3">
          <input type="hidden" name="publicationId" value={publicationId} />
          <label htmlFor={`publication-photo-${publicationId}`} className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden="true">＋</span> Добавить фото
          </label>
          <input id={`publication-photo-${publicationId}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
          <Button type="submit" size="sm" disabled={photoPending || items.length >= 10}>{photoPending ? "Загрузка…" : "Загрузить"}</Button>
          {photoState.message ? <p className="text-xs text-muted-foreground">{photoState.message}</p> : null}
        </form>
        <form action={vkAction} className="space-y-2 rounded-xl border p-3">
          <input type="hidden" name="publicationId" value={publicationId} />
          <label htmlFor={`publication-vk-${publicationId}`} className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden="true">🔗</span> Добавить VK-видео
          </label>
          <input id={`publication-vk-${publicationId}`} name="sourceUrl" type="url" inputMode="url" required placeholder="https://vk.com/video-…_…" className="min-h-10 w-full rounded-lg border bg-background px-3 text-sm" />
          <Button type="submit" size="sm" disabled={vkPending || items.length >= 10}>{vkPending ? "Подготовка…" : "Добавить"}</Button>
          {vkState.message ? <p className="text-xs text-muted-foreground">{vkState.message}</p> : null}
        </form>
      </div>
    </Card>
  );
}
