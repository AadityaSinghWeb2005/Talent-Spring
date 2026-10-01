import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Job } from "@/lib/types";

export function JobCard({ job }: { job: Job }) {
  const salary = job.minSalary && job.maxSalary
    ? `${job.currency} ${Math.round(Number(job.minSalary) / 1000)}k–${Math.round(Number(job.maxSalary) / 1000)}k`
    : "Salary not listed";
  return (
    <Link href={`/jobs/${job.id}`} className="group block rounded-2xl border border-black/[.07] bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-soft font-display text-lg font-bold text-brand">{job.company.name.slice(0, 1)}</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{job.company.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><MapPin size={12} />{[job.locationCity, job.locationCountry].filter(Boolean).join(", ") || "Location flexible"}</p></div>
        </div>
        <ArrowUpRight size={18} className="shrink-0 text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">{job.title}</h3>
      <div className="mt-3 flex flex-wrap gap-2"><span className="tag">{job.workplaceType.replaceAll("_", " ")}</span><span className="tag">{job.employmentType.replaceAll("_", " ")}</span><span className="tag">{job.experienceLevel} level</span></div>
      <div className="mt-5 flex items-center justify-between border-t border-black/[.06] pt-4 text-xs text-muted"><span className="font-semibold text-ink">{salary}</span><span>{new Date(job.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
    </Link>
  );
}
