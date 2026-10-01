"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, ChevronRight, MapPin } from "lucide-react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import type { Application } from "@/lib/types";
import { DashboardShell } from "@/components/dashboard-shell";

type Response = { data: Application[] };

export default function CandidateApplicationsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["applications"], queryFn: () => apiFetch<Response>("/applications/me") });
  const withdraw = useMutation({ mutationFn: (id: string) => apiFetch(`/applications/${id}/withdraw`, { method: "PATCH" }), onSuccess: () => client.invalidateQueries({ queryKey: ["applications"] }) });
  const applications = query.data?.data ?? [];
  return <DashboardShell><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">A record of every step</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">My applications</h1><p className="mt-2 text-sm text-muted">Stay close to every possibility you’ve explored.</p></div><Link href="/jobs" className="button-primary !px-4 !py-2.5 !text-xs">Find more roles <ArrowUpRight size={15} /></Link></div>
    <div className="mt-7 space-y-3">{applications.map((application) => <article key={application.id} className="rounded-2xl border border-black/[.06] bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft font-bold text-brand">{application.job.company.name.slice(0, 1)}</div><div><Link href={`/jobs/${application.job.id}`} className="font-display text-lg font-bold hover:text-brand">{application.job.title}</Link><p className="mt-1 text-xs text-muted">{application.job.company.name} · {[application.job.locationCity, application.job.locationCountry].filter(Boolean).join(", ")}</p><p className="mt-1 text-[11px] text-muted">Submitted {new Date(application.createdAt).toLocaleDateString()} · Resume: {application.resume.fileName}</p></div></div><span className="w-fit rounded-full bg-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand">{application.currentStatus.replaceAll("_", " ")}</span></div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-4">{application.history.map((entry, index) => <span key={`${entry.toStatus}-${index}`} className="inline-flex items-center gap-2 text-[10px] font-semibold text-muted"><span className={`rounded-full px-2.5 py-1 ${entry.toStatus === application.currentStatus ? "bg-accent text-ink" : "bg-canvas"}`}>{entry.toStatus.replaceAll("_", " ")}</span>{index < application.history.length - 1 && <ChevronRight size={12} />}</span>)}
        {!["ACCEPTED", "REJECTED", "WITHDRAWN", "INTERVIEW_SCHEDULED"].includes(application.currentStatus) && <button onClick={() => withdraw.mutate(application.id)} disabled={withdraw.isPending} className="ml-auto text-xs font-semibold text-muted hover:text-rose-700">Withdraw</button>}
      </div></article>)}
      {!applications.length && !query.isLoading && <div className="rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center"><BriefcaseBusiness className="mx-auto text-brand" size={24} /><h2 className="mt-4 font-display text-xl font-bold">Your next chapter starts with one application.</h2><p className="mt-2 text-sm text-muted">Explore open roles and save the ones that feel right.</p><Link href="/jobs" className="button-primary mt-5">Explore jobs</Link></div>}
      {query.isError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{query.error instanceof ApiRequestError ? query.error.message : "Unable to load applications."}</p>}
    </div>
  </DashboardShell>;
}
