"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Video } from "lucide-react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";

type Interview = { id: string; title: string; startTime: string; endTime: string; meetingLink: string | null; status: string; application: { job: { title: string; company: { name: string } } } };
export default function CandidateInterviewsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["interviews"], queryFn: () => apiFetch<{ data: Interview[] }>("/interviews/me") });
  const cancel = useMutation({ mutationFn: (id: string) => apiFetch(`/interviews/${id}/cancel`, { method: "PATCH" }), onSuccess: () => client.invalidateQueries({ queryKey: ["interviews"] }) });
  const items = query.data?.data ?? [];
  return <DashboardShell><p className="eyebrow">The next conversation</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Interviews</h1><p className="mt-2 text-sm text-muted">A little preparation goes a long way. Keep your upcoming conversations close.</p>
    <div className="mt-7 space-y-3">{items.map((interview) => <article key={interview.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-black/[.06] bg-white p-5 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><CalendarDays size={18} /></span><div><h2 className="font-display text-lg font-bold">{interview.title}</h2><p className="mt-1 text-xs text-muted">{interview.application.job.title} · {interview.application.job.company.name}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink"><Clock3 size={13} />{new Date(interview.startTime).toLocaleString()} – {new Date(interview.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div></div><div className="flex items-center gap-2">{interview.meetingLink && <a href={interview.meetingLink} target="_blank" rel="noreferrer" className="button-primary !px-3 !py-2 !text-xs"><Video size={14} /> Join</a>}<span className="tag">{interview.status}</span>{interview.status === "SCHEDULED" && <button onClick={() => cancel.mutate(interview.id)} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-muted">Cancel</button>}</div></article>)}
      {!items.length && !query.isLoading && <div className="rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center"><CalendarDays className="mx-auto text-brand" size={24} /><h2 className="mt-4 font-display text-xl font-bold">Your next great conversation is ahead.</h2><p className="mt-2 text-sm text-muted">When a team schedules an interview, you’ll find the details here.</p></div>}
      {query.isError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{query.error instanceof ApiRequestError ? query.error.message : "Interviews could not be loaded."}</p>}
    </div>
  </DashboardShell>;
}
