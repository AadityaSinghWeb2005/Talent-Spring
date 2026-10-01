"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/job-card";

type Response = { data: Job[]; page: { hasMore: boolean; nextCursor: string | null } };

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [workplaceType, setWorkplaceType] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [collected, setCollected] = useState<Job[]>([]);
  useEffect(() => { setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); }, []);
  const params = new URLSearchParams({ limit: "12" });
  if (query) params.set("q", query);
  if (city) params.set("city", city);
  if (workplaceType) params.set("workplaceType", workplaceType);
  if (cursor) params.set("cursor", cursor);
  const key = params.toString();
  const { data, isLoading, isError } = useQuery({ queryKey: ["jobs", key], queryFn: () => apiFetch<Response>(`/jobs?${key}`) });
  const jobs = cursor ? [...collected, ...(data?.data ?? [])] : data?.data ?? [];
  function resetPage() { setCursor(null); setCollected([]); }
  return <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
    <div className="max-w-2xl"><p className="eyebrow">The work is out there</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.05em] sm:text-5xl">Find your next <span className="text-brand">good thing.</span></h1><p className="mt-4 text-base leading-7 text-muted">Search roles from teams that care about the work and the people doing it.</p></div>
    <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside className="h-fit rounded-2xl border border-black/[.06] bg-white p-5"><div className="flex items-center gap-2 font-bold"><SlidersHorizontal size={17} className="text-brand" /> Refine your search</div>
        <label className="field-label mt-5" htmlFor="job-search">Keywords</label><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input id="job-search" value={query} onChange={(event) => { setQuery(event.target.value); resetPage(); }} className="field-control pl-9" placeholder="Role or skill" /></div>
        <label className="field-label mt-5" htmlFor="job-city">Location</label><input id="job-city" value={city} onChange={(event) => { setCity(event.target.value); resetPage(); }} className="field-control" placeholder="City or country" />
        <label className="field-label mt-5" htmlFor="job-workplace">Work style</label><select id="job-workplace" value={workplaceType} onChange={(event) => { setWorkplaceType(event.target.value); resetPage(); }} className="field-control"><option value="">Any arrangement</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ON_SITE">On-site</option></select>
        <button onClick={() => { setQuery(""); setCity(""); setWorkplaceType(""); resetPage(); }} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand"><X size={14} /> Clear filters</button>
      </aside>
      <div><div className="mb-5 flex items-center justify-between"><p className="text-sm text-muted">{isLoading ? "Finding opportunities…" : `${jobs.length}${data?.page.hasMore ? "+" : ""} roles to explore`}</p><span className="tag">Updated regularly</span></div>
        {isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">We couldn’t load jobs just now. Check the API is running and try again.</div>}
        {isLoading ? <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((n) => <div className="skeleton h-60" key={n} />)}</div> : <div className="grid gap-4 sm:grid-cols-2">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div>}
        {!isLoading && !isError && jobs.length === 0 && <div className="rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center"><Search className="mx-auto text-brand" size={24} /><h2 className="mt-4 font-display text-xl font-bold">No matches just yet</h2><p className="mt-2 text-sm text-muted">Try changing your search or clearing a filter.</p></div>}
        {data?.page.hasMore && <button onClick={() => { setCollected(jobs); setCursor(data.page.nextCursor); }} className="button-secondary mt-7 w-full sm:w-auto">Load more opportunities</button>}
      </div>
    </div>
  </div>;
}
