"use client";

import Image from "next/image";
import Link from "next/link";
import { type TouchEvent, useRef, useState } from "react";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { PublicationMediaViewer } from "@/entities/publication/ui/publication-media-viewer";

type PublicationMediaCarouselProps = {
  media: PublicationMedia[];
  publicationTitle: string;
  publicationHref: string;
  variant?: "card" | "detail";
  className?: string;
};

export function PublicationMediaCarousel({
  media,
  publicationTitle,
  publicationHref,
  variant = "card",
  className = ""
}: PublicationMediaCarouselProps) {
  const items = media.slice(0, 10);
  const [current, setCurrent] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (items.length === 0) return null;
  const activeIndex = Math.min(current, items.length - 1);

  function move(delta: number) {
    setCurrent((value) => Math.max(0, Math.min(items.length - 1, value + delta)));
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    move(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <div
        className={`group relative isolate overflow-hidden bg-surface-muted ${
          variant === "detail"
            ? "aspect-video rounded-xl"
            : "h-96"
        } ${className}`}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={onTouchEnd}
      >
        {items.map((item, index) => {
          const shouldRender = Math.abs(index - activeIndex) <= 1;
          const content = shouldRender ? (
            <>
              <Image
                src={item.posterUrl}
                alt={item.title || publicationTitle}
                fill
                unoptimized
                sizes={variant === "card" ? "(max-width: 768px) 100vw, 640px" : "(max-width: 768px) 100vw, 960px"}
                className={item.kind === "clip" ? "object-cover" : "object-cover"}
                priority={index === 0 && variant === "detail"}
              />
              {item.kind !== "photo" ? (
                <span className="absolute inset-0 grid place-items-center bg-black/10">
                  <span className="grid size-14 place-items-center rounded-full bg-black/65 text-white shadow-lg backdrop-blur-sm">
                    <span aria-hidden="true" className="ml-0.5 text-2xl">▶</span>
                  </span>
                  <span className="sr-only">Открыть видео</span>
                </span>
              ) : null}
            </>
          ) : <span className="absolute inset-0 bg-surface-muted" aria-hidden="true" />;

          const interactive = item.kind === "photo" && variant === "card" ? (
            <Link href={publicationHref} className="absolute inset-0">{content}</Link>
          ) : (
            <button
              type="button"
              className="absolute inset-0 text-left"
              onClick={() => setViewerIndex(index)}
              aria-label={item.kind === "photo" ? "Открыть фотографию" : "Воспроизвести видео"}
            >
              {content}
            </button>
          );
          return (
            <div
              key={item.id}
              className={`absolute inset-0 transition-transform duration-200 motion-reduce:transition-none ${
                index === activeIndex ? "translate-x-0" : index < activeIndex ? "-translate-x-full" : "translate-x-full"
              }`}
              aria-hidden={index !== activeIndex}
            >
              {interactive}
            </div>
          );
        })}

        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={activeIndex === 0}
              aria-label="Предыдущее медиа"
              className="absolute left-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white disabled:opacity-30 sm:grid"
            >
              <span aria-hidden="true" className="text-3xl leading-none">‹</span>
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={activeIndex === items.length - 1}
              aria-label="Следующее медиа"
              className="absolute right-2 top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white disabled:opacity-30 sm:grid"
            >
              <span aria-hidden="true" className="text-3xl leading-none">›</span>
            </button>
            <span className="absolute right-3 top-3 z-10 rounded-full bg-black/65 px-2.5 py-1 text-xs font-medium tabular-nums text-white">
              {activeIndex + 1} / {items.length}
            </span>
          </>
        ) : null}
      </div>
      {viewerIndex !== null && items[viewerIndex] ? (
        <PublicationMediaViewer
          media={items[viewerIndex]}
          publicationTitle={publicationTitle}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </>
  );
}
