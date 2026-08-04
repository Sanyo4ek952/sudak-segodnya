import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export default function AdminImportsLoading() {
  return (
    <div className="mx-auto max-w-content space-y-6" aria-busy="true" aria-label="Загрузка очереди импорта">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-full max-w-form" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-10 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
