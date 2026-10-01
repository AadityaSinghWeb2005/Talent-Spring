"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Building2, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Job } from "@/lib/types";
import { JobCard } from "@/components/job-card";

type Company = { id: string; name: string; description: string | null; industry: string | null; companySize: string | null; websiteUrl: string | null; jobs: Job[] };
export default function CompanyPage() {
  const { slug } = useParams<{ slug: string }>();
  const query = useQuery({ queryKey: ["company", slug], queryFn: () => apiFetch<{ data: Company }>(`/companies/directory/${slug}`) });
  if (query.isLoading) return <div className="mx-auto max-w-5xl px-5 py-12"><div className="skeleton h-72" /></div>;
  if (!query.data) return <div className="mx-auto max-w-5xl px-5 py-20 text-center"><h1 className="font-display text-3xl font-bold">Company not found</h1><Link href="/companies" className="button-primary mt-5">Explore teams</Link></div>;
  const company = query.data.data;
  return <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><Link href="/companies" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand"><ArrowLeft size={15} /> All teams</Link><div className="mt-6 rounded-[1.7rem] bg-brand p-7 text-white sm:p-10"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-start"><div className="flex items-start gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-bold">{company.name.slice(0, 1)}</span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-accent">{company.industry ?? "A TalentSpring team"}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-.05em]">{company.name}</h1><p className="mt-2 text-sm text-white/70">{company.companySize ?? "Growing team"}</p></div></div>{company.websiteUrl && <a href={company.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">Visit website <ArrowUpRight size={15} /></a>}</div><p className="mt-8 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/80">{company.description ?? "A team creating meaningful work."}</p></div><div className="mt-10"><p className="eyebrow">Open opportunities</p><h2 className="mt-2 font-display text-2xl font-bold">Roles at {company.name}</h2>{company.jobs.length ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{company.jobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <p className="mt-5 rounded-xl bg-white p-6 text-sm text-muted">No open roles at the moment. Check back soon.</p>}</div></div>;
}
