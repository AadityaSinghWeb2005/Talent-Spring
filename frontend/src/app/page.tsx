"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Compass, Search, Sparkles, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/job-card";

type JobResponse = { data: Job[] };

export default function HomePage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["featured-jobs"], queryFn: () => apiFetch<JobResponse>("/jobs?limit=3") });
  return <>
    <section className="relative overflow-hidden bg-[#edf1e5]">
      <div className="absolute -right-36 -top-40 h-[570px] w-[570px] rounded-full border border-brand/10" /><div className="absolute -right-16 -top-20 h-[330px] w-[330px] rounded-full border border-brand/10" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24 lg:px-8">
        <div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand"><Sparkles size={14} /> A more human way to find work</span>
          <h1 className="mt-6 font-display text-[clamp(3rem,7vw,5.65rem)] font-bold leading-[.98] tracking-[-.075em] text-ink">Your next chapter <span className="text-brand">starts here.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">Find teams that see your potential. Explore roles built around the way you want to work and the life you want to lead.</p>
          <form onSubmit={(event) => { event.preventDefault(); window.location.href = `/jobs?q=${encodeURIComponent(search)}`; }} className="mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-card sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Search className="shrink-0 text-brand" size={19} /><span className="sr-only">Search jobs</span><input className="min-w-0 flex-1 py-2 text-sm outline-none placeholder:text-muted/60" placeholder="Role, skill, or company" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <button className="button-primary">Explore jobs <ArrowRight size={16} /></button>
          </form>
          <p className="mt-4 text-xs text-muted">Popular: <span className="font-semibold text-ink">Product design, Engineering, Remote</span></p>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-7 top-14 z-10 hidden rounded-2xl bg-white p-4 shadow-card sm:block"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-brand"><Check size={19} /></span><div><p className="text-sm font-bold">A good fit, found</p><p className="text-xs text-muted">Made for your next move</p></div></div></div>
          <div className="overflow-hidden rounded-[2rem] bg-brand p-7 text-white shadow-[0_30px_80px_rgba(23,107,91,.24)] sm:p-9">
            <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-white/60">A better kind of search</p><h2 className="mt-3 max-w-xs font-display text-3xl font-bold leading-tight tracking-tight">Make room for meaningful work.</h2></div><Compass className="text-accent" size={26} /></div>
            <div className="my-8 h-px bg-white/15" />
            <div className="space-y-5">{[["01", "Discover", "Explore opportunities that fit your goals."], ["02", "Connect", "Meet teams who value how you think."], ["03", "Grow", "Take your next step with confidence."]].map(([number, title, copy]) => <div className="flex gap-4" key={number}><span className="font-display text-sm font-bold text-accent">{number}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-white/65">{copy}</p></div></div>)}</div>
            <div className="mt-8 flex items-center gap-3 rounded-xl bg-white/10 p-4"><UsersRound size={20} className="text-accent" /><div><p className="text-sm font-bold">A community built on possibility</p><p className="mt-0.5 text-xs text-white/65">For people and teams ready to grow.</p></div></div>
          </div>
          <div className="absolute -bottom-5 -right-4 hidden rounded-2xl border border-black/5 bg-white px-5 py-4 shadow-card sm:block"><p className="font-display text-xl font-bold">Good work changes things.</p><p className="mt-1 text-xs text-muted">Start where you are.</p></div>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Opportunities worth a look</p><h2 className="section-heading mt-3">A few good places to start.</h2></div><Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:text-brand-dark">See all openings <ArrowUpRight size={16} /></Link></div>
      {isLoading ? <div className="mt-8 grid gap-4 md:grid-cols-3"><div className="skeleton h-64"/><div className="skeleton h-64"/><div className="skeleton h-64"/></div> : <div className="mt-8 grid gap-4 md:grid-cols-3">{(data?.data ?? []).map((job) => <JobCard key={job.id} job={job} />)}</div>}
      {!isLoading && !data?.data.length && <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white p-10 text-center text-sm text-muted">New opportunities are on the way. Check back soon.</div>}
    </section>
    <section className="bg-white"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 sm:grid-cols-3 lg:px-8">{[["01", "People before profiles", "We make space for the person behind every resume."], ["02", "Clarity at every step", "A thoughtful search should feel simple and transparent."], ["03", "Built for what’s next", "Good work should help you move toward a life you love."]].map(([n, title, body]) => <div key={n} className="border-l-2 border-brand/20 pl-5"><p className="eyebrow">{n}</p><h3 className="mt-3 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{body}</p></div>)}</div></section>
  </>;
}
