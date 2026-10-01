export type Role = "CANDIDATE" | "RECRUITER" | "COMPANY_ADMIN" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  companyId: string | null;
};

export type Skill = { id: string; name: string };
export type Company = { id: string; name: string; slug: string; logoUrl: string | null; websiteUrl?: string | null; industry?: string | null };
export type Job = {
  id: string;
  title: string;
  description: string;
  requirements: string;
  locationCity: string | null;
  locationCountry: string | null;
  workplaceType: string;
  employmentType: string;
  experienceLevel: string;
  minSalary: number | string | null;
  maxSalary: number | string | null;
  currency: string;
  status: string;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  company: Company;
  skills: Array<{ skill: Skill }>;
};

export type Resume = { id: string; fileName: string; isPrimary: boolean };
export type Application = {
  id: string;
  currentStatus: string;
  createdAt: string;
  job: Job;
  resume: Resume;
  history: Array<{ fromStatus: string | null; toStatus: string; createdAt: string }>;
};

export type ApiError = { error?: { code?: string; message?: string; details?: unknown } };
