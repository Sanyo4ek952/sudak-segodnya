function normalizedHostname(value: string) {
  return value
    .replace(/\.$/, "")
    .toLocaleLowerCase("en-US")
    .replace(/^www\./, "");
}

export function normalizeExcludedDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Укажите домен.");

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Укажите корректный домен или URL.");
  }

  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Укажите публичный HTTPS-домен без учётных данных и нестандартного порта.");
  }

  const domain = normalizedHostname(url.hostname);
  const labels = domain.split(".");
  const validLabels = labels.length >= 2 && labels.every((label) =>
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
  if (!validLabels || domain.length > 253) {
    throw new Error("Укажите корректное доменное имя, например example.org.");
  }

  return domain;
}

export function isUrlExcludedByDomain(urlValue: string, excludedDomains: readonly string[]) {
  let hostname: string;
  try {
    hostname = normalizedHostname(new URL(urlValue).hostname);
  } catch {
    return false;
  }

  return excludedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
