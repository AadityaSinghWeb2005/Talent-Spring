"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, Download, MessageSquare, UserRound } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";

type Applicant = { id: string; currentStatus: string; createdAt: string; candidate: { id: string; firstName: string; lastName: string; email: string; profile: { headline: string | null; locationCity: string | null; yearsOfExperience: number } | null; candidateSkills: Array<{ skill: { name: string } }>; educations: Array<{ id: string; institution: string; degree: string | null; fieldOfStudy: string | null }>; experiences: Array<{ id: string; companyName: string; title: string; location: string | null; startedAt: string; endedAt: string | null }> }; resume: { id: string; fileName: string }; notes: Array<{ id: string; note: string; createdAt: string; author: { firstName: string; lastName: string } | null }> };

export default function ApplicantsPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [interviewDrafts, setInterviewDrafts] = useState<Record<string, { start: string; end: string }>>({});
  const query = useQuery({ queryKey: ["applicants", jobId], queryFn: () => apiFetch<{ data: Applicant[] }>(`/jobs/${jobId}/applications`) });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiFetch(`/applications/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["applicants", jobId] }),
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "The candidate stage could not be updated."),
  });
  const addNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => apiFetch(`/applications/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => { setDraftNotes({}); client.invalidateQueries({ queryKey: ["applicants", jobId] }); },
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "Your note could not be saved."),
  });
  const scheduleInterview = useMutation({
    mutationFn: ({ id, start, end }: { id: string; start: string; end: string }) => apiFetch(`/applications/${id}/interviews`, { method: "POST", body: JSON.stringify({ title: "Interview", startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() }) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["applicants", jobId] }),
    onError: (reason) => setError(reason instanceof ApiRequestError ? reason.message : "The interview could not be scheduled."),
  });
  const applicants = query.data?.data ?? [];
  const columns = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "ACCEPTED", "REJECTED"];
  return <DashboardShell audience="recruiter"><Link href="/recruiter/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-brand"><ArrowLeft size={15} /> All roles</Link><p className="eyebrow mt-6">A thoughtful hiring process</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Applicants</h1><p className="mt-2 text-sm text-muted">Review the people who have raised their hand for this role.</p>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {query.isLoading ? <div className="skeleton mt-7 h-72" /> : !applicants.length ? <div className="card mt-7 p-10 text-center"><UserRound className="mx-auto text-brand" size={23} /><h2 className="mt-3 font-display text-lg font-bold">The right person may be just around the corner.</h2><p className="mt-2 text-sm text-muted">New applications will appear here.</p></div> : <div className="mt-7 space-y-8">{columns.filter((stage) => applicants.some((applicant) => applicant.currentStatus === stage)).map((stage) => <section key={stage}><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">{stage.replaceAll("_", " ")}</h2><span className="tag">{applicants.filter((applicant) => applicant.currentStatus === stage).length} people</span></div><div className="grid gap-4 xl:grid-cols-2">{applicants.filter((applicant) => applicant.currentStatus === stage).map((applicant) => <article key={applicant.id} className="rounded-2xl border border-black/[.06] bg-white p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><UserRound size={18} /></span><div className="min-w-0 flex-1"><h3 className="font-display text-lg font-bold">{applicant.candidate.firstName} {applicant.candidate.lastName}</h3><p className="mt-0.5 truncate text-xs text-muted">{applicant.candidate.profile?.headline ?? applicant.candidate.email}</p><p className="mt-1 text-[11px] text-muted">{applicant.candidate.profile?.locationCity ?? "Location not listed"} · {applicant.candidate.profile?.yearsOfExperience ?? 0} years experience · {applicant.resume.fileName}</p></div></div>
        <div className="mt-4 flex flex-wrap gap-1.5">{applicant.candidate.candidateSkills.slice(0, 6).map(({ skill }) => <span className="tag" key={skill.name}>{skill.name}</span>)}</div>
        {(applicant.candidate.experiences.length > 0 || applicant.candidate.educations.length > 0) && <div className="mt-4 space-y-2 border-t border-black/[.06] pt-3 text-xs">{applicant.candidate.experiences.slice(0, 2).map((experience) => <p key={experience.id} className="text-muted"><span className="font-semibold text-ink">{experience.title}</span> · {experience.companyName}{experience.location ? ` · ${experience.location}` : ""}</p>)}{applicant.candidate.educations.slice(0, 2).map((education) => <p key={education.id} className="text-muted"><span className="font-semibold text-ink">{[education.degree, education.fieldOfStudy].filter(Boolean).join(" · ") || "Education"}</span> · {education.institution}</p>)}</div>}
        <div className="mt-4 flex flex-wrap gap-2">{nextStatuses(stage).map((status) => <button key={status} onClick={() => updateStatus.mutate({ id: applicant.id, status })} disabled={updateStatus.isPending} className={`rounded-lg px-3 py-2 text-xs font-bold ${status === "REJECTED" ? "border border-rose-200 text-rose-700 hover:bg-rose-50" : "bg-brand-soft text-brand hover:bg-brand hover:text-white"}`}>{status === "REJECTED" ? "Decline" : `Move to ${status.replaceAll("_", " ").toLowerCase()}`}</button>)}<button onClick={async () => { const result = await apiFetch<{ data: { downloadUrl: string } }>(`/uploads/resumes/${applicant.resume.id}/download-url`); window.location.assign(result.data.downloadUrl); }} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold"><Download size={14} /> Resume</button></div>
        {stage === "SHORTLISTED" && <details className="mt-4 rounded-xl bg-canvas p-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold"><CalendarDays size={14} className="text-brand" /> Schedule an interview</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-[11px] font-semibold text-muted">Starts<input type="datetime-local" value={interviewDrafts[applicant.id]?.start ?? ""} onChange={(event) => setInterviewDrafts((items) => ({ ...items, [applicant.id]: { start: event.target.value, end: items[applicant.id]?.end ?? "" } }))} className="field-control mt-1 !py-2 !text-xs" /></label><label className="text-[11px] font-semibold text-muted">Ends<input type="datetime-local" value={interviewDrafts[applicant.id]?.end ?? ""} onChange={(event) => setInterviewDrafts((items) => ({ ...items, [applicant.id]: { start: items[applicant.id]?.start ?? "", end: event.target.value } }))} className="field-control mt-1 !py-2 !text-xs" /></label></div><button onClick={() => { const draft = interviewDrafts[applicant.id]; if (draft?.start && draft.end) scheduleInterview.mutate({ id: applicant.id, start: draft.start, end: draft.end }); }} disabled={scheduleInterview.isPending} className="button-primary mt-3 !px-3 !py-2 !text-xs">Confirm interview time</button></details>}
        <div className="mt-5 border-t border-black/[.06] pt-4"><p className="flex items-center gap-2 text-xs font-bold"><MessageSquare size={14} className="text-brand" /> Private team notes</p>{applicant.notes.slice(0, 2).map((note) => <p key={note.id} className="mt-2 rounded-lg bg-canvas p-2.5 text-xs leading-5 text-muted"><span className="font-semibold text-ink">{note.author?.firstName ?? "Team"}:</span> {note.note}</p>)}<div className="mt-2 flex gap-2"><input className="field-control !py-2.5 !text-xs" value={draftNotes[applicant.id] ?? ""} onChange={(event) => setDraftNotes((notes) => ({ ...notes, [applicant.id]: event.target.value }))} placeholder="Add a note for your team" /><button aria-label="Save note" onClick={() => { const note = draftNotes[applicant.id]?.trim(); if (note) addNote.mutate({ id: applicant.id, note }); }} className="grid w-11 shrink-0 place-items-center rounded-xl bg-brand text-white"><Check size={16} /></button></div></div>
      </article>)}</div></section>)}</div>}
  </DashboardShell>;
}

function nextStatuses(stage: string): string[] {
  if (stage === "APPLIED") return ["UNDER_REVIEW", "REJECTED"];
  if (stage === "UNDER_REVIEW") return ["SHORTLISTED", "REJECTED"];
  if (stage === "SHORTLISTED") return ["REJECTED"];
  if (stage === "INTERVIEW_SCHEDULED") return ["ACCEPTED", "REJECTED"];
  return [];
}
