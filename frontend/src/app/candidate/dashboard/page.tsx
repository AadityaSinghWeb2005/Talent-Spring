"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CheckCircle2, Clock3, UserRound } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Application } from "@/lib/types";
import { DashboardShell } from "@/components/dashboard-shell";

type ApplicationsResponse = { data: Application[] };
type ProfileResponse = { data: { headline: string | null; skills: unknown[]; resumes: unknown[] } };

export default function CandidateDashboardPage() {
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => apiFetch<ApplicationsResponse>("/applications/me") });
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => apiFetch<ProfileResponse>("/profiles/me") });
  const applicationList = apps.data?.data ?? [];
  const profileComplete = Boolean(profile.data?.data.headline && profile.data.data.skills.length && profile.data.data.resumes.length);
  return <DashboardShell><div><p className="eyebrow">Your journey</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Good morning. Ready for what’s next?</h1><p className="mt-2 text-sm text-muted">Keep your search moving, one thoughtful step at a time.</p></div>
    {!profileComplete && <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl bg-brand p-5 text-white sm:flex-row sm:items-center sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-accent">A little more about you</p><p className="mt-2 font-display text-xl font-bold">Make your profile stand out.</p><p className="mt-1 text-sm text-white/70">Add your experience, skills, and a resume to apply faster.</p></div><Link href="/candidate/profile" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-brand">Complete profile <ArrowRight size={16} /></Link></div>}
    <div className="mt-7 grid gap-4 sm:grid-cols-3"><Stat icon={BriefcaseBusiness} label="Applications" value={String(applicationList.length)} detail="Keep track of each step" /><Stat icon={Clock3} label="In progress" value={String(applicationList.filter((app) => !["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(app.currentStatus)).length)} detail="Still moving forward" /><Stat icon={CheckCircle2} label="Profile status" value={profileComplete ? "Ready" : "In progress"} detail={profileComplete ? "You’re ready to apply" : "A few details to add"} /></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_310px]"><section className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="eyebrow">Recent activity</p><h2 className="mt-2 font-display text-xl font-bold">Your applications</h2></div><Link href="/candidate/applications" className="text-xs font-bold text-brand hover:underline">View all</Link></div>
      <div className="mt-5 divide-y divide-black/[.06]">{applicationList.slice(0, 4).map((application) => <div key={application.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div className="min-w-0"><Link href={`/jobs/${application.job.id}`} className="truncate font-semibold hover:text-brand">{application.job.title}</Link><p className="mt-1 text-xs text-muted">{application.job.company.name} · Applied {new Date(application.createdAt).toLocaleDateString()}</p></div><span className="w-fit rounded-full bg-brand-soft px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-brand">{application.currentStatus.replaceAll("_", " ")}</span></div>)}
      {!applicationList.length && !apps.isLoading && <div className="py-10 text-center"><BriefcaseBusiness className="mx-auto text-brand" size={22} /><p className="mt-3 text-sm font-semibold">Your next opportunity is waiting.</p><Link href="/jobs" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">Explore roles <ArrowUpRight size={14} /></Link></div>}</div>
    </section><aside className="rounded-2xl border border-black/[.06] bg-white p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-brand"><UserRound size={18} /></div><h2 className="mt-4 font-display text-lg font-bold">Keep your momentum</h2><p className="mt-2 text-sm leading-6 text-muted">A complete profile helps hiring teams understand the person behind your application.</p><Link href="/candidate/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand">Update your profile <ArrowRight size={15} /></Link></aside></div>
  </DashboardShell>;
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof BriefcaseBusiness; label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-black/[.06] bg-white p-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted">{label}</p><Icon size={17} className="text-brand" /></div><p className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-muted">{detail}</p></div>;
}
