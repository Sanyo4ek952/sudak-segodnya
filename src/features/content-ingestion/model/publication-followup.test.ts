import { describe, expect, it } from "vitest";
import { resolvePublicationFollowup } from "@/features/content-ingestion/model/publication-followup";

const publicationId = "11111111-1111-4111-8111-111111111111";

describe("imported publication follow-up", () => {
  it("turns a changed repeated publication into an update", () => {
    expect(resolvePublicationFollowup({
      incomingAction: "create_publication",
      previousAction: "create_publication",
      previousPublicationId: publicationId,
      cancellationConfirmed: false
    })).toEqual({
      action: "update_publication",
      targetPublicationId: publicationId,
      skip: false
    });
  });

  it("turns explicit cancellation of an imported publication into cancellation", () => {
    expect(resolvePublicationFollowup({
      incomingAction: "create_publication",
      previousAction: "update_publication",
      previousPublicationId: publicationId,
      cancellationConfirmed: true
    })).toEqual({
      action: "cancel_publication",
      targetPublicationId: publicationId,
      skip: false
    });
  });

  it("does not create repeated cancellation candidates", () => {
    expect(resolvePublicationFollowup({
      incomingAction: "create_publication",
      previousAction: "cancel_publication",
      previousPublicationId: publicationId,
      cancellationConfirmed: true
    }).skip).toBe(true);
  });

  it("treats changed content after a cancellation as a new publication", () => {
    expect(resolvePublicationFollowup({
      incomingAction: "create_publication",
      previousAction: "cancel_publication",
      previousPublicationId: publicationId,
      cancellationConfirmed: false
    })).toEqual({
      action: "create_publication",
      targetPublicationId: null,
      skip: false
    });
  });
});
