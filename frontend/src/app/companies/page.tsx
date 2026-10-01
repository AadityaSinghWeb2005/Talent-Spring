"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Search } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Company = { id: string; name: string; slug: string; description: string | null; industry: string | null; companySize: string | null; _count: { jobs: number } };
export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["company-directory", search], queryFn: () => apiFetch<{ data: Company[] }>(`/companies/directory${search ? `?q=${encodeURIComponent(search)}` : ""}`) });
  return <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8"><p className="eyebrow">Teams with a point of view</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">Meet the people <span className="text-brand">behind the work.</span></h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted">A good next move starts with the right people. Explore teams with open opportunities and see what they’re building.</p>
    <div className="relative mt-8 max-w-md"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input className="field-control pl-11" placeholder="Search company or industry" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data?.data.map((company) => <Link key={company.id} href={`/companies/${company.slug}`} className="group rounded-2xl border border-black/[.06] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-card"><div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft font-display text-xl font-bold text-brand">{company.name.slice(0, 1)}</span><ArrowUpRight className="text-muted group-hover:text-brand" size={18} /></div><h2 className="mt-5 font-display text-xl font-bold">{company.name}</h2><p className="mt-1 text-xs text-muted">{[company.industry, company.companySize].filter(Boolean).join(" · ") || "A team creating what’s next"}</p><p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">{company.description ?? "Explore the opportunities this team has open."}</p><p className="mt-5 flex items-center gap-2 border-t border-black/[.06] pt-4 text-xs font-bold text-brand"><Building2 size={15} />{company._count.jobs} open {company._count.jobs === 1 ? "role" : "roles"}</p></Link>)}</div>
    {!query.isLoading && !query.data?.data.length && <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white p-12 text-center text-sm text-muted">No teams matched that search.</div>}
  </div>;
}
