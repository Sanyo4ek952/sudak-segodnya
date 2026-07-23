import { serializeJsonLd, type JsonLd } from "@/shared/lib/seo";

type JsonLdProps = {
  data: JsonLd;
};

export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
