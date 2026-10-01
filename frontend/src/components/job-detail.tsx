"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Bookmark, BriefcaseBusiness, Building2, Check, Clock3, MapPin, Share2, UsersRound } from "lucide-react";
import { useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import type { Job, Resume } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

type JobResponse = { data: Job };
type ProfileResponse = { data: { resumes: Resume[] } };

export function JobDetail({ jobId, initialJob }: { jobId: string; initialJob?: Job }) {
  const user = useAuthStore((state) => state.user);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["job", jobId], queryFn: () => apiFetch<JobResponse>(`/jobs/${jobId}`), initialData: initialJob ? { data: initialJob } : undefined, staleTime: 60_000 });
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: () => apiFetch<ProfileResponse>("/profiles/me"), enabled: Boolean(user?.roles.includes("CANDIDATE")) });
  const saveMutation = useMutation({
    mutationFn: () => apiFetch(`/jobs/${jobId}/save`, { method: "POST" }),
    onSuccess: () => setNotice("Saved to your list. You can find it in Saved jobs."),
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "Could not save this role."),
  });
  const applyMutation = useMutation({
    mutationFn: () => apiFetch("/applications", { method: "POST", body: JSON.stringify({ jobId, resumeId, coverLetter }) }),
    onSuccess: () => { setApplying(false); setNotice("Application sent. You can track it from your applications."); queryClient.invalidateQueries({ queryKey: ["applications"] }); },
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "Could not submit your application."),
  });

  if (isLoading) return <div className="mx-auto max-w-5xl px-5 py-12"><div className="skeleton h-96" /></div>;
  if (isError || !data) return <div className="mx-auto max-w-4xl px-5 py-20 text-center"><h1 className="font-display text-3xl font-bold">This role isn’t available</h1><p className="mt-3 text-muted">The posting may have closed or the link may be incorrect.</p><Link className="button-primary mt-6" href="/jobs">Back to open roles</Link></div>;
  const job = data.data;
  const recruiter = user?.roles.some((role) => role === "RECRUITER" || role === "COMPANY_ADMIN" || role === "ADMIN");

  return <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-12">
    <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand"><ArrowLeft size={16} /> All open roles</Link>
    <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_330px]">
      <article>
        <div className="rounded-[1.7rem] border border-black/[.06] bg-white p-6 sm:p-9">
          <div className="flex items-start justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft font-display text-xl font-bold text-brand">{job.company.name.slice(0, 1)}</div><div><Link href={`/companies/${job.company.slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-brand">{job.company.name}<ArrowUpRight size={14} /></Link><p className="mt-1 text-xs text-muted">{job.company.industry ?? "A team building what’s next"}</p></div></div><button onClick={() => { setError(""); setNotice(""); if (!user) { window.location.href = "/login"; return; } void saveMutation.mutateAsync(); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-black/10 text-muted hover:border-brand/25 hover:text-brand" aria-label="Save job"><Bookmark size={18} /></button></div>
          <h1 className="mt-8 max-w-3xl font-display text-4xl font-bold leading-tight tracking-[-.055em] sm:text-5xl">{job.title}</h1>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted"><span className="flex items-center gap-1.5"><MapPin size={15} />{[job.locationCity, job.locationCountry].filter(Boolean).join(", ") || "Flexible location"}</span><span className="flex items-center gap-1.5"><BriefcaseBusiness size={15} />{job.employmentType.replaceAll("_", " ")}</span><span className="flex items-center gap-1.5"><Clock3 size={15} />{job.experienceLevel.toLowerCase()} level</span></div>
          <div className="mt-7 flex flex-wrap gap-2"><span className="tag">{job.workplaceType.replaceAll("_", " ")}</span>{job.skills.map(({ skill }) => <span key={skill.id} className="tag">{skill.name}</span>)}</div>
          <div className="my-8 h-px bg-black/[.07]" />
          <section><h2 className="font-display text-xl font-bold">About the role</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">{job.description}</p></section>
          <section className="mt-8"><h2 className="font-display text-xl font-bold">What you’ll bring</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">{job.requirements}</p></section>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-black/[.06] pt-6">{job.skills.map(({ skill }) => <span key={skill.id} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-muted">{skill.name}</span>)}</div>
        </div>
      </article>
      <aside className="space-y-4"><div className="sticky top-24 rounded-[1.5rem] border border-black/[.06] bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Compensation</p><p className="mt-2 font-display text-2xl font-bold">{job.minSalary && job.maxSalary ? `${job.currency} ${Math.round(Number(job.minSalary) / 1000)}k–${Math.round(Number(job.maxSalary) / 1000)}k` : "Competitive pay"}</p><p className="mt-1 text-xs text-muted">Based on experience and location</p>
        {!recruiter && <button onClick={() => { setError(""); setNotice(""); if (!user) { window.location.href = "/login?next=" + encodeURIComponent(`/jobs/${jobId}`); return; } if (user.roles.includes("CANDIDATE")) setApplying((open) => !open); else setError("Candidate accounts can apply to roles."); }} className="button-primary mt-6 w-full">Apply for this role <ArrowUpRight size={16} /></button>}
        {recruiter && <Link href="/recruiter/jobs" className="button-primary mt-6 w-full">Recruiter workspace <ArrowUpRight size={16} /></Link>}
        {applying && <form className="mt-5 space-y-3 border-t border-black/[.07] pt-5" onSubmit={(event) => { event.preventDefault(); if (!resumeId) { setError("Choose a resume before continuing."); return; } setError(""); applyMutation.mutate(); }}>
          <label className="field-label" htmlFor="resume">Choose a resume</label><select id="resume" className="field-control" value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Select a resume</option>{profile?.data.resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.fileName}{resume.isPrimary ? " · Primary" : ""}</option>)}</select>
          {!profile?.data.resumes.length && <p className="text-xs text-muted">Add a resume to your profile before applying.</p>}
          <label className="field-label" htmlFor="coverLetter">A note to the team <span className="font-normal text-muted">(optional)</span></label><textarea id="coverLetter" className="field-control min-h-24 resize-y" maxLength={10000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Why does this role feel right for you?" />
          <button disabled={applyMutation.isPending || !profile?.data.resumes.length} className="button-primary w-full">{applyMutation.isPending ? "Sending…" : "Submit application"}</button>
        </form>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-brand-soft p-3 text-xs leading-5 text-brand">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
        <div className="my-6 h-px bg-black/[.07]" /><div className="space-y-3 text-xs text-muted"><p className="flex items-center gap-2"><Building2 size={15} /> {job.company.name}</p><p className="flex items-center gap-2"><UsersRound size={15} /> Join a team making an impact</p><button onClick={async () => { await navigator.clipboard?.writeText(window.location.href); setNotice("Link copied to your clipboard."); }} className="flex items-center gap-2 hover:text-brand"><Share2 size={15} /> Share this opportunity</button><p className="flex items-center gap-2 text-brand"><Check size={15} /> Applications are reviewed by the team</p></div>
      </div></aside>
    </div>
  </div>;
}
