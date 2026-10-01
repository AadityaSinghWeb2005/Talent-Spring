"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Globe2, Save, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";

const schema = z.object({ name: z.string().trim().min(2).max(255), websiteUrl: z.string().url().or(z.literal("")), industry: z.string().max(100), companySize: z.string().max(50), description: z.string().max(10000) });
type Values = z.infer<typeof schema>;
type Company = Values & { id: string; slug: string; logoUrl: string | null; _count?: { jobs: number; members: number } };

export default function RecruiterCompanyPage() {
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const companies = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch<{ data: Company[] }>("/companies/me") });
  const company = companies.data?.data[0];
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", websiteUrl: "", industry: "", companySize: "", description: "" } });
  useEffect(() => { if (company) form.reset({ name: company.name, websiteUrl: company.websiteUrl ?? "", industry: company.industry ?? "", companySize: company.companySize ?? "", description: company.description ?? "" }); }, [company, form]);
  const save = useMutation({
    mutationFn: (values: Values) => apiFetch<{ data: Company }>(company ? `/companies/${company.id}` : "/companies", { method: company ? "PATCH" : "POST", body: JSON.stringify(values) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["companies"] }); setSaved(true); window.setTimeout(() => setSaved(false), 2200); },
  });
  return <DashboardShell audience="recruiter"><p className="eyebrow">Tell the story behind the work</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Company profile</h1><p className="mt-2 text-sm text-muted">Give candidates a feel for the people, purpose, and possibility at your company.</p>
    {company && <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-brand p-5 text-white"><p className="text-xs font-semibold text-white/70">Open roles and drafts</p><p className="mt-2 font-display text-3xl font-bold">{company._count?.jobs ?? "—"}</p></div><div className="rounded-2xl bg-accent p-5"><p className="text-xs font-semibold text-muted">People in your hiring workspace</p><p className="mt-2 font-display text-3xl font-bold">{company._count?.members ?? "—"}</p></div></div>}
    <form onSubmit={form.handleSubmit((values) => save.mutate(values))} className="card mt-7 p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Building2 size={18} /></span><div><h2 className="font-display text-lg font-bold">A good introduction</h2><p className="text-xs text-muted">Make it easy for someone to imagine joining your team.</p></div></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="field-label" htmlFor="name">Company name</label><input id="name" className="field-control" {...form.register("name")} /></div><div><label className="field-label" htmlFor="websiteUrl">Website</label><div className="relative"><Globe2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input id="websiteUrl" type="url" className="field-control pl-9" placeholder="https://company.com" {...form.register("websiteUrl")} /></div></div><div><label className="field-label" htmlFor="industry">Industry</label><input id="industry" className="field-control" placeholder="Technology" {...form.register("industry")} /></div><div><label className="field-label" htmlFor="companySize">Company size</label><select id="companySize" className="field-control" {...form.register("companySize")}><option value="">Choose a range</option><option>1-10</option><option>11-50</option><option>51-200</option><option>201-500</option><option>501-1000</option><option>1000+</option></select></div><div className="sm:col-span-2"><label className="field-label" htmlFor="description">About your team</label><textarea id="description" rows={7} className="field-control resize-y" placeholder="What do you care about? How do you work together? What are you building?" {...form.register("description")} /></div></div>
      {save.isError && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{save.error instanceof ApiRequestError ? save.error.message : "The company details could not be saved."}</p>}
      <div className="mt-6 flex justify-end"><button disabled={save.isPending} className="button-primary">{saved ? <Check size={16} /> : <Save size={16} />}{save.isPending ? "Saving…" : saved ? "Saved" : company ? "Save company profile" : "Create company"}</button></div>
    </form>
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-black/[.06] bg-white p-4 text-xs leading-5 text-muted"><UsersRound size={16} className="mt-0.5 shrink-0 text-brand" />The person who creates the company becomes its administrator. You can invite and manage teammates as that feature is added.</div>
  </DashboardShell>;
}
