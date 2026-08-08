import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers())
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`Unexpected redirect to ${location}`);
  })
}));

vi.mock("@/shared/api/supabase/server", () => ({
  createSupabaseServerClient: vi.fn()
}));

import { createSupabaseServerClient } from "@/shared/api/supabase/server";
import {
  saveAdminPublicationAction,
  saveBusinessPublicationAction
} from "./actions";
import { initialBusinessActionState } from "./types";

const organizationId = "00000000-0000-4000-8000-000000000001";
const publicationId = "00000000-0000-4000-8000-000000000002";
const clientRequestId = "00000000-0000-4000-8000-000000000003";
const categoryId = "00000000-0000-4000-8000-000000000004";
const userId = "00000000-0000-4000-8000-000000000005";

function createPublicationFormData(overrides: Record<string, string> = {}) {
  const values = {
    organizationId,
    publicationId,
    clientRequestId,
    intent: "draft",
    type: "news",
    title: "Новая публикация",
    description: "",
    categoryId,
    startsAt: "",
    endsAt: "",
    validUntil: "",
    publishAt: "",
    place: "",
    priceText: "",
    ageLimit: "",
    contactPhone: "",
    scheduleEntries: "[]",
    ...overrides
  };
  const formData = new FormData();

  Object.entries(values).forEach(([name, value]) => formData.set(name, value));
  return formData;
}

function createMemberClient({
  hasMembership,
  rpc
}: {
  hasMembership: boolean;
  rpc: ReturnType<typeof vi.fn>;
}) {
  const membershipQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: hasMembership
        ? {
            id: "00000000-0000-4000-8000-000000000006",
            organization_id: organizationId,
            user_id: userId,
            role: "owner",
            is_active: true,
            created_at: "2026-08-08T00:00:00.000Z",
            updated_at: "2026-08-08T00:00:00.000Z",
            organizations: {
              id: organizationId,
              name: "Организация",
              slug: "organization",
              status: "active"
            }
          }
        : null,
      error: null
    }))
  };
  membershipQuery.select.mockReturnValue(membershipQuery);
  membershipQuery.eq.mockReturnValue(membershipQuery);

  const mediaQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    insert: vi.fn(async () => ({ error: null }))
  };
  mediaQuery.select.mockReturnValue(mediaQuery);
  mediaQuery.eq.mockReturnValue(mediaQuery);
  mediaQuery.is.mockReturnValue(mediaQuery);

  const storageBucket = {
    upload: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://example.test/publication-image" },
      error: null
    }))
  };

  return {
    client: {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: userId } },
          error: null
        }))
      },
      from: vi.fn((table: string) => (
        table === "organization_members" ? membershipQuery : mediaQuery
      )),
      rpc,
      storage: {
        from: vi.fn(() => storageBucket)
      }
    },
    membershipQuery,
    mediaQuery,
    storageBucket
  };
}

describe("publication save actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks active membership and always uses the member RPC in the business action", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "save_member_publication") {
        return {
          data: { id: publicationId, status: "draft", slug: "new-publication" },
          error: null
        };
      }

      throw new Error(`Unexpected RPC: ${name}`);
    });
    const { client, membershipQuery } = createMemberClient({ hasMembership: true, rpc });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await saveBusinessPublicationAction(
      initialBusinessActionState,
      createPublicationFormData()
    );

    expect(client.auth.getUser).toHaveBeenCalledOnce();
    expect(membershipQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["save_member_publication"]);
    expect(result).toMatchObject({ status: "success", publicationId });
  });

  it("does not call a save RPC without an active organization membership", async () => {
    const rpc = vi.fn();
    const { client } = createMemberClient({ hasMembership: false, rpc });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);

    const result = await saveBusinessPublicationAction(
      initialBusinessActionState,
      createPublicationFormData()
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "error",
      message: "Нет доступа к этой организации."
    });
  });

  it("uploads a selected image together with the final business save", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "save_member_publication") {
        return {
          data: { id: publicationId, status: "published", slug: "new-publication" },
          error: null
        };
      }

      throw new Error(`Unexpected RPC: ${name}`);
    });
    const { client, mediaQuery, storageBucket } = createMemberClient({
      hasMembership: true,
      rpc
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    const formData = createPublicationFormData({
      intent: "publish",
      description: "Подробное описание новой публикации.",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
    });
    formData.set("image", new File(["image"], "publication.png", { type: "image/png" }));

    const result = await saveBusinessPublicationAction(initialBusinessActionState, formData);

    expect(storageBucket.upload).toHaveBeenCalledOnce();
    expect(mediaQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      publication_id: publicationId,
      purpose: "publication_photo",
      bucket_id: "publication-images"
    }));
    expect(result).toMatchObject({
      status: "success",
      publicationId,
      imageUrl: "https://example.test/publication-image"
    });
  });

  it("uses the admin RPC only from the dedicated admin edit action", async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === "is_admin") {
        return { data: true, error: null };
      }
      if (name === "save_admin_publication") {
        return {
          data: { id: publicationId, status: "draft", slug: "existing-publication" },
          error: null
        };
      }

      throw new Error(`Unexpected RPC: ${name}`);
    });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);

    const result = await saveAdminPublicationAction(
      initialBusinessActionState,
      createPublicationFormData()
    );

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "is_admin",
      "save_admin_publication"
    ]);
    expect(result).toMatchObject({ status: "success", publicationId });
  });

  it("rejects the admin action when there is no existing publication id", async () => {
    const rpc = vi.fn();
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);

    const result = await saveAdminPublicationAction(
      initialBusinessActionState,
      createPublicationFormData({ publicationId: "" })
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "error", message: "Публикация не найдена." });
  });
});
