import { describe, expect, it } from "vitest";
import { classroomRulerFrame } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/contexts";
import { BORROW_SENSE } from "@/contextual-learning/candidate-v0/fixtures/borrowing-sharing/knowledge";
import { serializeFact } from "@/contextual-learning/candidate-v0/domain/predicates";

describe("Candidate V0 borrowing-sharing case", () => {
  const transfer = classroomRulerFrame.eventBindings?.find(
    (event) => event.eventId === "TRANSFER_TEMPORARY_POSSESSION",
  );
  const returned = classroomRulerFrame.eventBindings?.find(
    (event) => event.eventId === "RETURN_ITEM",
  );

  it("maps the same transfer to borrow from the requester and lend from the owner", () => {
    const requester = classroomRulerFrame.perspectiveBindings?.find(
      (item) => item.observerRole === "REQUESTER",
    );
    const owner = classroomRulerFrame.perspectiveBindings?.find(
      (item) => item.observerRole === "OWNER",
    );
    expect(requester?.eventId).toBe("TRANSFER_TEMPORARY_POSSESSION");
    expect(owner?.eventId).toBe("TRANSFER_TEMPORARY_POSSESSION");
    expect(requester?.expressedSense.senseId).toBe(BORROW_SENSE.borrow.senseId);
    expect(owner?.expressedSense.senseId).toBe(BORROW_SENSE.lend.senseId);
    expect(requester?.requiredDirection).toEqual({
      sourceRole: "OWNER",
      destinationRole: "REQUESTER",
    });
    expect(owner?.requiredDirection).toEqual(requester?.requiredDirection);
    expect(requester?.expressedSense.senseId).not.toBe(owner?.expressedSense.senseId);
  });

  it("keeps ownership fixed while temporary possession moves, then return restores it", () => {
    expect(transfer).toBeDefined();
    expect(returned).toBeDefined();
    if (!transfer || !returned) {
      return;
    }
    expect(transfer.beforeFacts.some((item) => item.predicate === "owns")).toBe(true);
    expect(transfer.afterFacts.some((item) => item.predicate === "owns")).toBe(true);
    expect(
      transfer.afterFacts.some((item) => item.predicate === "temporarily_possesses"),
    ).toBe(true);
    expect(
      transfer.beforeFacts.some((item) => item.predicate === "temporarily_possesses"),
    ).toBe(false);
    expect(returned.afterFacts.some((item) => item.predicate === "possesses")).toBe(true);
    expect(returned.afterFacts.some((item) => item.predicate === "return_completed")).toBe(
      true,
    );
    expect(
      transfer.afterFacts.map(serializeFact).join(" "),
    ).not.toMatch(/give_would_change_ownership/);
  });

  it("keeps give and share distinct from temporary transfer", () => {
    expect(
      classroomRulerFrame.initialFacts.some(
        (item) => item.predicate === "give_would_change_ownership",
      ),
    ).toBe(true);
    expect(
      transfer?.afterFacts.some((item) => item.predicate === "give_would_change_ownership"),
    ).toBe(false);
    expect(BORROW_SENSE.share.senseId).not.toBe(BORROW_SENSE.give.senseId);
    expect(BORROW_SENSE.borrow.senseId).not.toBe(BORROW_SENSE.give.senseId);
  });
});
