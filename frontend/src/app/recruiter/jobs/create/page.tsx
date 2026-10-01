"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";

const roleSchema = z.object({
  companyId: z.string().uuid("Choose your company"),
  title: z.string().trim().min(3, "Add a clear role title").max(255),
  description: z.string().trim().min(20, "Tell candidates more about the role").max(30000),
  requirements: z.string().trim().min(10, "List the key requirements").max(15000),
  locationCity: z.string().max(100),
  locationCountry: z.string().max(100),
  workplaceType: z.enum(["ON_SITE", "HYBRID", "REMOTE"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]),
  experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "EXECUTIVE"]),
  minSalary: z.coerce.number().nonnegative().optional(),
  maxSalary: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3),
  skills: z.string(),
});
type RoleValues = z.infer<typeof roleSchema>;
type Company = { id: string; name: string };

export default function CreateJobPage() {
  const router = useRouter();
  const client = useQueryClient();
  const companies = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch<{ data: Company[] }>("/companies/me") });
  const form = useForm<RoleValues>({ resolver: zodResolver(roleSchema), defaultValues: { companyId: "", locationCity: "", locationCountry: "India", workplaceType: "HYBRID", employmentType: "FULL_TIME", experienceLevel: "MID", currency: "INR", skills: "" } });
  const create = useMutation({
    mutationFn: (values: RoleValues) => apiFetch<{ data: { id: string } }>("/jobs", { method: "POST", body: JSON.stringify({ ...values, minSalary: values.minSalary || undefined, maxSalary: values.maxSalary || undefined, skills: values.skills.split(",").map((skill) => skill.trim()).filter(Boolean) }) }),
    onSuccess: async ({ data }) => { await client.invalidateQueries({ queryKey: ["recruiter-jobs"] }); router.push(`/recruiter/applicants/${data.id}`); },
  });
  return <DashboardShell audience="recruiter"><Link href="/recruiter/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-brand"><ArrowLeft size={15} /> Back to roles</Link><p className="eyebrow mt-6">Make a thoughtful introduction</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Create a job posting</h1><p className="mt-2 text-sm text-muted">The best descriptions help a candidate picture their day with your team.</p>
    {companies.data?.data.length === 0 && <div className="mt-6 rounded-2xl bg-accent p-5"><p className="font-semibold">Set up your company first.</p><p className="mt-1 text-sm text-muted">Add your company details, then come back to publish a role.</p><Link href="/recruiter/company" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand">Set up company <ArrowRight size={15} /></Link></div>}
    <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="mt-7 space-y-6">
      <section className="card p-5 sm:p-7"><h2 className="font-display text-lg font-bold">The essentials</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="field-label" htmlFor="companyId">Company</label><select id="companyId" className="field-control" {...form.register("companyId")}><option value="">Choose a company</option>{companies.data?.data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><FieldError message={form.formState.errors.companyId?.message} /></div><div className="sm:col-span-2"><label className="field-label" htmlFor="title">Job title</label><input id="title" className="field-control" placeholder="e.g. Senior Product Designer" {...form.register("title")} /><FieldError message={form.formState.errors.title?.message} /></div><div><label className="field-label" htmlFor="city">City</label><input id="city" className="field-control" placeholder="Bengaluru" {...form.register("locationCity")} /></div><div><label className="field-label" htmlFor="country">Country</label><input id="country" className="field-control" {...form.register("locationCountry")} /></div><SelectField id="workplaceType" label="Work style" register={form.register("workplaceType")} choices={[["ON_SITE", "On-site"], ["HYBRID", "Hybrid"], ["REMOTE", "Remote"]]} /><SelectField id="employmentType" label="Employment type" register={form.register("employmentType")} choices={[["FULL_TIME", "Full time"], ["PART_TIME", "Part time"], ["CONTRACT", "Contract"], ["INTERNSHIP", "Internship"]]} /><SelectField id="experienceLevel" label="Experience level" register={form.register("experienceLevel")} choices={[["ENTRY", "Entry"], ["MID", "Mid"], ["SENIOR", "Senior"], ["EXECUTIVE", "Executive"]]} /><div><label className="field-label" htmlFor="skills">Skills</label><input id="skills" className="field-control" placeholder="Research, Figma, Product strategy" {...form.register("skills")} /><p className="mt-1 text-[11px] text-muted">Separate skills with commas.</p></div></div></section>
      <section className="card p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><BriefcaseBusiness size={18} /></span><div><h2 className="font-display text-lg font-bold">Help people picture the work</h2><p className="text-xs text-muted">Be clear, specific, and welcoming.</p></div></div><div className="mt-5"><label className="field-label" htmlFor="description">About the role</label><textarea id="description" rows={7} className="field-control resize-y" placeholder="What will this person work on? Who will they work with? What makes the opportunity meaningful?" {...form.register("description")} /><FieldError message={form.formState.errors.description?.message} /></div><div className="mt-4"><label className="field-label" htmlFor="requirements">What you’ll bring</label><textarea id="requirements" rows={5} className="field-control resize-y" placeholder="Share the skills and experience that matter most. Focus on what someone needs to do the work well." {...form.register("requirements")} /><FieldError message={form.formState.errors.requirements?.message} /></div></section>
      <section className="card p-5 sm:p-7"><h2 className="font-display text-lg font-bold">Compensation</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><label className="field-label" htmlFor="currency">Currency</label><select id="currency" className="field-control" {...form.register("currency")}><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></div><div><label className="field-label" htmlFor="minSalary">Minimum annual salary</label><input id="minSalary" type="number" className="field-control" {...form.register("minSalary")} /></div><div><label className="field-label" htmlFor="maxSalary">Maximum annual salary</label><input id="maxSalary" type="number" className="field-control" {...form.register("maxSalary")} /></div></div></section>
      {create.isError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{create.error instanceof ApiRequestError ? create.error.message : "We couldn’t create this job."}</p>}
      <div className="flex justify-end"><button disabled={create.isPending || companies.data?.data.length === 0} className="button-primary">{create.isPending && <LoaderCircle size={16} className="animate-spin" />} Save as draft <ArrowRight size={16} /></button></div>
    </form>
  </DashboardShell>;
}

function FieldError({ message }: { message?: string }) { return message ? <p className="mt-1 text-xs text-rose-700">{message}</p> : null; }
function SelectField({ id, label, register, choices }: { id: string; label: string; register: ReturnType<ReturnType<typeof useForm<RoleValues>>["register"]>; choices: Array<[string, string]> }) {
  return <div><label htmlFor={id} className="field-label">{label}</label><select id={id} className="field-control" {...register}>{choices.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div>;
}
