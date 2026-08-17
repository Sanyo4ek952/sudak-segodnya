import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicationMedia } from "@/entities/publication/model/types";
import { PublicationMediaCarousel } from "@/entities/publication/ui/publication-media-carousel";
import { PublicationMediaViewer } from "@/entities/publication/ui/publication-media-viewer";

const media: PublicationMedia[] = [
  {
    id: "photo-1",
    kind: "photo",
    posterUrl: "/brand/vk-import-fallback.png"
  },
  {
    id: "clip-1",
    kind: "clip",
    provider: "vk",
    posterUrl: "/brand/vk-import-fallback.png",
    sourceUrl: "https://vk.com/clip-1_2",
    embedUrl: "https://vk.com/video_ext.php?oid=-1&id=2"
  }
];

describe("PublicationMediaCarousel", () => {
  it("renders an ordered indicator and never creates an iframe in the card", () => {
    const html = renderToStaticMarkup(
      <PublicationMediaCarousel
        media={media}
        publicationTitle="Судак"
        publicationHref="/publications/sudak"
      />
    );
    expect(html).toContain("1 / 2");
    expect(html).toContain("Воспроизвести видео");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("h-96");
    expect(html).not.toContain("min-h-80");
  });

  it("uses a vertical 9:16 frame for a clip viewer", () => {
    const html = renderToStaticMarkup(
      <PublicationMediaViewer media={media[1]} publicationTitle="Клип" onClose={() => undefined} />
    );
    expect(html).toContain("aspect-\[9/16\]");
    expect(html).toContain("referrerPolicy=\"strict-origin-when-cross-origin\"");
    expect(html).toContain(
      'allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"'
    );
    expect(html).toContain('loading="eager"');
    expect(html).toContain('src="https://vk.com/video_ext.php?oid=-1&amp;id=2&amp;autoplay=1"');
  });
});
