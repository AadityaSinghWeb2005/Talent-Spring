import { describe, expect, it } from "vitest";
import { JobStatus } from "@prisma/client";
import { canTransitionJob } from "../../src/modules/jobs/job-state";

describe("job lifecycle", () => {
  it("lets recruiters publish drafts, pause active jobs, reopen paused jobs, and close postings", () => {
    expect(canTransitionJob(JobStatus.DRAFT, JobStatus.ACTIVE)).toBe(true);
    expect(canTransitionJob(JobStatus.ACTIVE, JobStatus.PAUSED)).toBe(true);
    expect(canTransitionJob(JobStatus.PAUSED, JobStatus.ACTIVE)).toBe(true);
    expect(canTransitionJob(JobStatus.ACTIVE, JobStatus.CLOSED)).toBe(true);
  });

  it("rejects skipped lifecycle steps and changes to a closed or archived job", () => {
    expect(canTransitionJob(JobStatus.DRAFT, JobStatus.CLOSED)).toBe(false);
    expect(canTransitionJob(JobStatus.CLOSED, JobStatus.ACTIVE)).toBe(false);
    expect(canTransitionJob(JobStatus.ARCHIVED, JobStatus.ACTIVE, true)).toBe(false);
  });

  it("allows only administrators to archive a non-archived job", () => {
    expect(canTransitionJob(JobStatus.ACTIVE, JobStatus.ARCHIVED)).toBe(false);
    expect(canTransitionJob(JobStatus.ACTIVE, JobStatus.ARCHIVED, true)).toBe(true);
  });
});
