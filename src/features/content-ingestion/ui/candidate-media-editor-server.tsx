import { CandidateMediaEditor } from "@/features/content-ingestion/ui/candidate-media-editor";
import { createSupabaseAdminClient } from "@/shared/api/supabase/admin";

export async function CandidateMediaEditorServer({ candidateId }: { candidateId: string }) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("content_candidate_media")
    .select("id, kind, source_kind, bucket_id, storage_path, title, included, status, error_message")
    .eq("candidate_id", candidateId)
    .order("sort_order")
    .order("id");
  const items = await Promise.all((data ?? []).map(async (media) => {
    const signed = media.bucket_id && media.storage_path
      ? await admin.storage.from(media.bucket_id).createSignedUrl(media.storage_path, 60 * 10)
      : null;
    return {
      id: media.id,
      kind: media.kind,
      sourceKind: media.source_kind,
      posterUrl: signed?.data?.signedUrl,
      title: media.title ?? undefined,
      included: media.included,
      status: media.status,
      errorMessage: media.error_message ?? undefined
    };
  }));
  return <CandidateMediaEditor candidateId={candidateId} items={items} />;
}
