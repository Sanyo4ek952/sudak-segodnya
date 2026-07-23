import { notFound } from "next/navigation";
import { assertBusinessMembership } from "@/features/business-cabinet/model/actions";
import { SectionNavigation } from "@/widgets/app-shell/ui/section-navigation";

type BusinessOrganizationLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function BusinessOrganizationLayout({
  children,
  params
}: BusinessOrganizationLayoutProps) {
  const { organizationId } = await params;
  const membership = await assertBusinessMembership(organizationId);

  if (!membership) {
    notFound();
  }

  const basePath = `/business/${organizationId}`;
  const navigationItems = [
    { label: "Главная", href: basePath, exact: true },
    { label: "Мои организации", href: "/business", exact: true },
    { label: "Профиль", href: `${basePath}/profile` },
    { label: "Публикации", href: `${basePath}/publications` },
    { label: "Меню и услуги", href: `${basePath}/menu` },
    { label: "Статистика", href: `${basePath}/statistics` },
    { label: "Представители", href: `${basePath}/settings` }
  ];

  return (
    <div className="space-y-6">
      <SectionNavigation label="Навигация кабинета организации" items={navigationItems} />
      {children}
    </div>
  );
}
