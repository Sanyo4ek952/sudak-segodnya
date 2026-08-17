export type PublicNavigationIcon = "feed" | "catalog" | "favorites" | "business";

export const publicNavigationItems = [
  { label: "Лента", href: "/", icon: "feed" },
  { label: "Каталог", href: "/organizations", icon: "catalog" },
  { label: "Избранное", href: "/favorites", icon: "favorites" },
  { label: "Для бизнеса", href: "/business", icon: "business" }
] as const;

export function isWorkspacePath(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  return segments[0] === "business" && Boolean(segments[1]) && segments[1] !== "application";
}
