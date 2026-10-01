import { describe, expect, it } from "vitest";
import { ApplicationStatus as Status } from "@prisma/client";
import { canCandidateWithdraw, canTransitionApplication } from "../../src/modules/applications/application-state";

describe("application lifecycle", () => {
  it("allows the expected recruiter pipeline transitions", () => {
    expect(canTransitionApplication(Status.APPLIED, Status.UNDER_REVIEW)).toBe(true);
    expect(canTransitionApplication(Status.UNDER_REVIEW, Status.SHORTLISTED)).toBe(true);
    expect(canTransitionApplication(Status.SHORTLISTED, Status.INTERVIEW_SCHEDULED)).toBe(true);
    expect(canTransitionApplication(Status.INTERVIEW_SCHEDULED, Status.ACCEPTED)).toBe(true);
  });

  it("rejects skipped, reverse, and terminal transitions", () => {
    expect(canTransitionApplication(Status.APPLIED, Status.ACCEPTED)).toBe(false);
    expect(canTransitionApplication(Status.SHORTLISTED, Status.APPLIED)).toBe(false);
    expect(canTransitionApplication(Status.REJECTED, Status.UNDER_REVIEW)).toBe(false);
    expect(canTransitionApplication(Status.ACCEPTED, Status.REJECTED)).toBe(false);
    expect(canTransitionApplication(Status.WITHDRAWN, Status.APPLIED)).toBe(false);
  });

  it("allows candidates to withdraw only before an interview is scheduled", () => {
    expect(canCandidateWithdraw(Status.APPLIED)).toBe(true);
    expect(canCandidateWithdraw(Status.UNDER_REVIEW)).toBe(true);
    expect(canCandidateWithdraw(Status.SHORTLISTED)).toBe(true);
    expect(canCandidateWithdraw(Status.INTERVIEW_SCHEDULED)).toBe(false);
    expect(canCandidateWithdraw(Status.REJECTED)).toBe(false);
    expect(canCandidateWithdraw(Status.ACCEPTED)).toBe(false);
    expect(canCandidateWithdraw(Status.WITHDRAWN)).toBe(false);
  });
});
