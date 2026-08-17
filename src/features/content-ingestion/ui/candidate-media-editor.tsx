"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  addCandidateVkMediaAction,
  mutateCandidateMediaAction,
  uploadCandidatePhotoAction,
  type CandidateMediaActionState
} from "@/features/content-ingestion/model/candidate-media-actions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export type CandidateMediaEditorItem = {
  id: string;
  kind: "photo" | "video" | "clip";
  sourceKind: "vk_import" | "manual_upload" | "manual_vk";
  posterUrl?: string;
  title?: string;
  included: boolean;
  status: "ready" | "pending" | "error";
  errorMessage?: string;
};

type CandidateMediaEditorProps = {
  candidateId: string;
  items: CandidateMediaEditorItem[];
};

const initialState: CandidateMediaActionState = { status: "idle" };

function kindLabel(kind: CandidateMediaEditorItem["kind"]) {
  return kind === "photo" ? "Фото" : kind === "clip" ? "Клип" : "Видео";
}

export function CandidateMediaEditor({ candidateId, items }: CandidateMediaEditorProps) {
  const [photoState, photoAction, photoPending] = useActionState(uploadCandidatePhotoAction, initialState);
  const [vkState, vkAction, vkPending] = useActionState(addCandidateVkMediaAction, initialState);
  const includedCount = items.filter((item) => item.included).length;

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Медиагалерея</h3>
          <p className="mt-1 text-sm text-muted-foreground">Первый выбранный элемент станет обложкой публикации.</p>
        </div>
        <Badge variant={includedCount >= 10 ? "warning" : undefined}>{includedCount} из 10</Badge>
      </div>

      {items.length ? (
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={item.id} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 rounded-xl border p-3">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                {item.posterUrl ? (
                  <Image src={item.posterUrl} alt="" fill sizes="96px" className="object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-xs text-muted-foreground">Нет превью</div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{kindLabel(item.kind)}</Badge>
                  <Badge variant={item.status === "ready" ? "success" : "warning"}>
                    {item.status === "ready" ? "Готово" : item.status === "error" ? "Ошибка" : "Подготовка"}
                  </Badge>
                  {!item.included ? <Badge>Исключено</Badge> : null}
                </div>
                {item.title ? <p className="truncate text-sm font-medium">{item.title}</p> : null}
                {item.errorMessage ? <p className="text-xs text-destructive">{item.errorMessage}</p> : null}
                <div className="flex flex-wrap gap-1">
                  {[
                    ["up", "Выше", "↑"],
                    ["down", "Ниже", "↓"],
                    ["cover", "Обложка", "★"]
                  ].map(([intent, label, glyph]) => (
                    <form key={String(intent)} action={mutateCandidateMediaAction}>
                      <input type="hidden" name="candidateId" value={candidateId} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="intent" value={String(intent)} />
                      <Button type="submit" size="sm" variant="ghost" aria-label={String(label)}>
                        <span aria-hidden="true">{glyph}</span>
                      </Button>
                    </form>
                  ))}
                  <form action={mutateCandidateMediaAction}>
                    <input type="hidden" name="candidateId" value={candidateId} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <input type="hidden" name="intent" value="toggle" />
                    <Button type="submit" size="sm" variant="outline" disabled={item.status !== "ready"}>
                      {item.included ? "Исключить" : "Включить"}
                    </Button>
                  </form>
                  {item.status !== "ready" && item.kind !== "photo" ? (
                    <form action={mutateCandidateMediaAction}>
                      <input type="hidden" name="candidateId" value={candidateId} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="intent" value="retry" />
                      <Button type="submit" size="sm" variant="outline">
                        <span aria-hidden="true" className="mr-1">↻</span> Повторить
                      </Button>
                    </form>
                  ) : null}
                  {item.sourceKind !== "vk_import" ? (
                    <form action={mutateCandidateMediaAction}>
                      <input type="hidden" name="candidateId" value={candidateId} />
                      <input type="hidden" name="mediaId" value={item.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <Button type="submit" size="sm" variant="ghost" aria-label="Удалить медиа">
                        <span aria-hidden="true" className="text-destructive">×</span>
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Медиа пока нет.</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={photoAction} className="space-y-2 rounded-xl border p-3">
          <input type="hidden" name="candidateId" value={candidateId} />
          <label className="flex items-center gap-2 text-sm font-medium" htmlFor={`candidate-photo-${candidateId}`}>
            <span aria-hidden="true">＋</span> Добавить фото
          </label>
          <input
            id={`candidate-photo-${candidateId}`}
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="block w-full text-sm"
          />
          <Button type="submit" size="sm" disabled={photoPending}>{photoPending ? "Загрузка…" : "Загрузить"}</Button>
          {photoState.message ? <p className="text-xs text-muted-foreground">{photoState.message}</p> : null}
        </form>
        <form action={vkAction} className="space-y-2 rounded-xl border p-3">
          <input type="hidden" name="candidateId" value={candidateId} />
          <label className="flex items-center gap-2 text-sm font-medium" htmlFor={`candidate-vk-${candidateId}`}>
            <span aria-hidden="true">🔗</span> Добавить VK-видео
          </label>
          <input
            id={`candidate-vk-${candidateId}`}
            name="sourceUrl"
            type="url"
            inputMode="url"
            required
            placeholder="https://vk.com/video-…_…"
            className="min-h-10 w-full rounded-lg border bg-background px-3 text-sm"
          />
          <Button type="submit" size="sm" disabled={vkPending}>{vkPending ? "Подготовка…" : "Добавить"}</Button>
          {vkState.message ? <p className="text-xs text-muted-foreground">{vkState.message}</p> : null}
        </form>
      </div>
    </Card>
  );
}
