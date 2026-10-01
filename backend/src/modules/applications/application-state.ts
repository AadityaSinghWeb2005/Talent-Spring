import { ApplicationStatus } from "@prisma/client";

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  APPLIED: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED],
  UNDER_REVIEW: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
  SHORTLISTED: [ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.REJECTED],
  INTERVIEW_SCHEDULED: [ApplicationStatus.REJECTED, ApplicationStatus.ACCEPTED],
  REJECTED: [],
  ACCEPTED: [],
  WITHDRAWN: [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return transitions[from].includes(to);
}

export function canCandidateWithdraw(status: ApplicationStatus): boolean {
  const withdrawable: ReadonlySet<ApplicationStatus> = new Set([
    ApplicationStatus.APPLIED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.SHORTLISTED,
  ]);
  return withdrawable.has(status);
}
