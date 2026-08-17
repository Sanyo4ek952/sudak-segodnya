"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { Dialog } from "@/shared/ui/dialog";

type PublicationMediaViewerProps = {
  media: PublicationMedia;
  publicationTitle: string;
  onClose: () => void;
};

function withAutoplay(embedUrl: string) {
  try {
    const url = new URL(embedUrl);
    url.searchParams.set("autoplay", "1");
    return url.toString();
  } catch {
    return embedUrl;
  }
}

export function PublicationMediaViewer({ media, publicationTitle, onClose }: PublicationMediaViewerProps) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const title = media.title || (media.kind === "photo" ? publicationTitle : `Видео: ${publicationTitle}`);
  return (
    <Dialog title={title} onClose={onClose} variant="viewer">
      {media.kind === "photo" ? (
        <div className="relative mx-auto min-h-72 w-full overflow-hidden rounded-xl bg-muted sm:min-h-[70dvh]">
          <Image
            src={media.posterUrl}
            alt={media.title || publicationTitle}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className={media.kind === "clip"
              ? "relative aspect-[9/16] max-h-[calc(100dvh-10rem)] w-auto max-w-full overflow-hidden rounded-xl bg-black"
              : "relative aspect-video w-full overflow-hidden rounded-xl bg-black"}
            style={media.kind === "clip" ? { height: "min(72dvh, 800px)" } : undefined}
          >
            {online ? (
              <iframe
                src={withAutoplay(media.embedUrl)}
                title={title}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
                allowFullScreen
                loading="eager"
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full border-0"
              />
            ) : (
              <div className="absolute inset-0">
                <Image src={media.posterUrl} alt="" fill sizes="100vw" className="object-contain opacity-70" />
                <div className="absolute inset-0 grid place-items-center bg-black/55 p-6 text-center text-sm text-white">
                  Для просмотра видео подключитесь к интернету.
                </div>
              </div>
            )}
          </div>
          <a
            href={media.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Видео не воспроизводится? Открыть в VK
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}
    </Dialog>
  );
}
