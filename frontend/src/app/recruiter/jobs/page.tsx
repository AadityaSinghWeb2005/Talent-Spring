"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, Pause, Plus, Radio, UsersRound, XCircle } from "lucide-react";
import { useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import type { Job } from "@/lib/types";
import { DashboardShell } from "@/components/dashboard-shell";

type RecruiterJob = Job & { _count: { applications: number } };

export default function RecruiterJobsPage() {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["recruiter-jobs"], queryFn: () => apiFetch<{ data: RecruiterJob[] }>("/jobs/mine") });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { setError(""); void client.invalidateQueries({ queryKey: ["recruiter-jobs"] }); },
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "The job status could not be updated."),
  });
  const jobs = query.data?.data ?? [];
  return <DashboardShell audience="recruiter"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Your hiring workspace</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Find the person who moves you forward.</h1><p className="mt-2 text-sm text-muted">Create a thoughtful posting and keep your hiring process moving.</p></div><Link href="/recruiter/jobs/create" className="button-primary !px-4 !py-2.5 !text-xs"><Plus size={16} /> Create a role</Link></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="card p-5"><p className="text-xs font-semibold text-muted">Open roles</p><p className="mt-3 font-display text-3xl font-bold">{jobs.filter((job) => job.status === "ACTIVE").length}</p></div><div className="card p-5"><p className="text-xs font-semibold text-muted">Applicants</p><p className="mt-3 font-display text-3xl font-bold">{jobs.reduce((total, job) => total + job._count.applications, 0)}</p></div><div className="card p-5"><p className="text-xs font-semibold text-muted">All postings</p><p className="mt-3 font-display text-3xl font-bold">{jobs.length}</p></div></div>
    <section className="mt-8"><div className="flex items-center justify-between"><div><p className="eyebrow">Your roles</p><h2 className="mt-2 font-display text-xl font-bold">Job postings</h2></div><Link href="/recruiter/company" className="text-xs font-bold text-brand">Company settings</Link></div>
      <div className="mt-4 space-y-3">{jobs.map((job) => <article key={job.id} className="rounded-2xl border border-black/[.06] bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><BriefcaseBusiness size={18} /></span><div className="min-w-0"><Link href={job.status === "ACTIVE" ? `/jobs/${job.id}` : `/recruiter/applicants/${job.id}`} className="truncate font-display text-lg font-bold hover:text-brand">{job.title}</Link><p className="mt-1 text-xs text-muted">{job.company.name} · {job.locationCity ?? "Flexible"} · Updated {new Date(job.updatedAt).toLocaleDateString()}</p></div></div><div className="flex flex-wrap items-center gap-3"><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${job.status === "ACTIVE" ? "bg-brand-soft text-brand" : "bg-canvas text-muted"}`}>{job.status}</span><span className="inline-flex items-center gap-1.5 text-xs text-muted"><UsersRound size={14} />{job._count.applications} applicants</span><Link href={`/recruiter/applicants/${job.id}`} className="button-secondary !px-3 !py-2 !text-xs">Review <ArrowRight size={14} /></Link>{job.status === "DRAFT" && <button onClick={() => setStatus.mutate({ id: job.id, status: "ACTIVE" })} disabled={setStatus.isPending} className="button-primary !px-3 !py-2 !text-xs"><Radio size={14} /> Publish</button>}{job.status === "ACTIVE" && <button onClick={() => setStatus.mutate({ id: job.id, status: "PAUSED" })} disabled={setStatus.isPending} className="button-secondary !px-3 !py-2 !text-xs"><Pause size={14} /> Pause</button>}{job.status === "PAUSED" && <button onClick={() => setStatus.mutate({ id: job.id, status: "ACTIVE" })} disabled={setStatus.isPending} className="button-primary !px-3 !py-2 !text-xs"><Radio size={14} /> Reopen</button>}{["ACTIVE", "PAUSED"].includes(job.status) && <button onClick={() => { if (window.confirm("Close this job? Candidates will no longer be able to apply.")) setStatus.mutate({ id: job.id, status: "CLOSED" }); }} disabled={setStatus.isPending} className="button-secondary !px-3 !py-2 !text-xs"><XCircle size={14} /> Close</button>}</div></div>{error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}</article>)}
      {!jobs.length && !query.isLoading && <div className="rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center"><BriefcaseBusiness className="mx-auto text-brand" size={23} /><h3 className="mt-3 font-display text-lg font-bold">Your next great hire starts with a role.</h3><p className="mt-2 text-sm text-muted">Create a clear, welcoming description and meet the people who fit.</p><Link href="/recruiter/jobs/create" className="button-primary mt-5">Create your first role <ArrowUpRight size={15} /></Link></div>}</div>
    </section>
  </DashboardShell>;
}
