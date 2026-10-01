import { JobStatus } from "@prisma/client";

const recruiterTransitions: Record<JobStatus, readonly JobStatus[]> = {
  [JobStatus.DRAFT]: [JobStatus.ACTIVE],
  [JobStatus.ACTIVE]: [JobStatus.PAUSED, JobStatus.CLOSED],
  [JobStatus.PAUSED]: [JobStatus.ACTIVE, JobStatus.CLOSED],
  [JobStatus.CLOSED]: [],
  [JobStatus.ARCHIVED]: [],
};

export function canTransitionJob(current: JobStatus, next: JobStatus, isAdmin = false): boolean {
  if (current === next) return true;
  if (next === JobStatus.ARCHIVED) return isAdmin && current !== JobStatus.ARCHIVED;
  return recruiterTransitions[current].includes(next);
}
