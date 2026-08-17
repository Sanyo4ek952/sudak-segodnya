"use client";

import { useEffect, useState } from "react";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { loadPublicationMedia } from "@/entities/publication/api/load-publication-media";
import { PublicationMediaCarousel } from "@/entities/publication/ui/publication-media-carousel";

export function PublicationMediaCarouselLoader({
  publicationId,
  publicationTitle,
  publicationHref,
  initialMedia,
  onMediaChange
}: {
  publicationId: string;
  publicationTitle: string;
  publicationHref: string;
  initialMedia: PublicationMedia[];
  onMediaChange?: (hasMedia: boolean) => void;
}) {
  const [media, setMedia] = useState(initialMedia);
  useEffect(() => {
    let active = true;
    void loadPublicationMedia(publicationId).then((loaded) => {
      if (active && loaded.length) setMedia(loaded);
    });
    return () => { active = false; };
  }, [publicationId]);

  useEffect(() => {
    onMediaChange?.(media.length > 0);
  }, [media.length, onMediaChange]);
  return (
    <PublicationMediaCarousel
      media={media}
      publicationTitle={publicationTitle}
      publicationHref={publicationHref}
    />
  );
}
