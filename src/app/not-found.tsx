import { LinkButton } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-form">
      <EmptyState
        title="Страница не найдена"
        description="Возможно, публикация или организация уже недоступна."
      />
      <div className="mt-4 flex justify-center">
        <LinkButton href="/" variant="outline">
          На главную
        </LinkButton>
      </div>
    </div>
  );
}
