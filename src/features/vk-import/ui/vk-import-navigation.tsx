import { SectionNavigation } from "@/widgets/app-shell/ui/section-navigation";

const items = [
  { label: "Очередь VK", href: "/admin/vk", exact: true },
  { label: "Источники VK", href: "/admin/vk/sources" }
];

export function VkImportNavigation() {
  return <SectionNavigation label="Навигация импорта VK" items={items} />;
}
