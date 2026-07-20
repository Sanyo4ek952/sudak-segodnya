import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/shared/api/supabase/server";

export default async function BusinessLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login?next=/business");
  }

  return children;
}
