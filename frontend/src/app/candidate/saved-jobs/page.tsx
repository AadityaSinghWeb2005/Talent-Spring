"use client";

import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/job-card";
import { DashboardShell } from "@/components/dashboard-shell";

export default function SavedJobsPage() {
  const query = useQuery({ queryKey: ["saved-jobs"], queryFn: () => apiFetch<{ data: Job[] }>("/jobs/saved/me") });
  return <DashboardShell><p className="eyebrow">Keep the possibilities close</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Saved jobs</h1><p className="mt-2 text-sm text-muted">Roles you want to come back to.</p>
    {query.data?.data.length ? <div className="mt-7 grid gap-4 md:grid-cols-2">{query.data.data.map((job) => <JobCard key={job.id} job={job} />)}</div> : !query.isLoading && <div className="mt-7 rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center"><Bookmark className="mx-auto text-brand" size={23} /><h2 className="mt-4 font-display text-xl font-bold">Keep a few roles on your radar.</h2><p className="mt-2 text-sm text-muted">Tap the bookmark on any listing that catches your eye.</p></div>}
  </DashboardShell>;
}
