import { notFound } from "next/navigation";
import {
  deleteEmptyMenuCategoryAction,
  deleteMenuItemAction,
  getBusinessMenu
} from "@/features/business-cabinet/model/actions";
import { MenuCategoryForm, MenuItemForm } from "@/features/business-cabinet/ui/menu-forms";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { SectionHeader } from "@/shared/ui/section-header";

type MenuPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function MenuPage({ params }: MenuPageProps) {
  const { organizationId } = await params;
  const categories = await getBusinessMenu(organizationId);

  if (!categories) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Меню и услуги"
        description="Разделы и позиции, которые показываются на публичной странице организации."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{category.name}</h2>
                    {category.description ? (
                      <p className="text-sm leading-6 text-foreground-muted">{category.description}</p>
                    ) : null}
                  </div>
                  <Badge variant={category.is_active ? "success" : "muted"}>
                    {category.is_active ? "Показывается" : "Скрыт"}
                  </Badge>
                </div>
                <MenuCategoryForm organizationId={organizationId} category={category} />
                {!category.menu_items.length ? (
                  <form action={deleteEmptyMenuCategoryAction}>
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <Button type="submit" variant="destructive" size="sm">Удалить пустой раздел</Button>
                  </form>
                ) : null}
                <div className="grid gap-2">
                  {category.menu_items
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((item) => (
                      <div key={item.id} className="space-y-3 rounded-md border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{item.title}</p>
                          <Badge variant={item.is_available ? "success" : "muted"}>
                            {item.is_available ? "Доступно" : "Скрыто"}
                          </Badge>
                        </div>
                        {item.description ? (
                          <p className="mt-1 text-sm leading-6 text-foreground-muted">{item.description}</p>
                        ) : null}
                        {item.price_text ? <p className="mt-1 text-sm">{item.price_text}</p> : null}
                        <MenuItemForm organizationId={organizationId} categories={categories} item={item} compact />
                        <form action={deleteMenuItemAction}>
                          <input type="hidden" name="organizationId" value={organizationId} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="destructive" size="sm">Удалить позицию</Button>
                        </form>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent>
              <h2 className="mb-4 text-lg font-semibold">Новый раздел</h2>
              <MenuCategoryForm organizationId={organizationId} />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h2 className="mb-4 text-lg font-semibold">Новая позиция</h2>
              <MenuItemForm organizationId={organizationId} categories={categories} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
