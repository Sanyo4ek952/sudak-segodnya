import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminVkLoading() {
  return (
    <div className="mx-auto max-w-content space-y-6" aria-busy="true" aria-label="Загрузка импорта VK">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-full max-w-form" />
      </div>
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardContent className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
