"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, BriefcaseBusiness, FolderKanban, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiFetch, ApiRequestError } from "@/lib/api";

const educationSchema = z.object({ institution: z.string().trim().min(1, "Add a school or institution").max(255), degree: z.string().max(150), fieldOfStudy: z.string().max(150), startedAt: z.string(), endedAt: z.string(), description: z.string().max(5000) });
const experienceSchema = z.object({ companyName: z.string().trim().min(1, "Add a company").max(255), title: z.string().trim().min(1, "Add a role title").max(255), location: z.string().max(255), startedAt: z.string().min(1, "Choose a start date"), endedAt: z.string(), description: z.string().max(5000) });
const certificationSchema = z.object({ name: z.string().trim().min(1, "Add a certification name").max(255), issuer: z.string().max(255), credentialUrl: z.string().url("Enter a valid URL").or(z.literal("")), issuedAt: z.string(), expiresAt: z.string() });
const projectSchema = z.object({ name: z.string().trim().min(1, "Add a project name").max(255), description: z.string().max(5000), projectUrl: z.string().url("Enter a valid URL").or(z.literal("")), startedAt: z.string(), endedAt: z.string() });
type EducationValues = z.infer<typeof educationSchema>;
type ExperienceValues = z.infer<typeof experienceSchema>;
type CertificationValues = z.infer<typeof certificationSchema>;
type ProjectValues = z.infer<typeof projectSchema>;
type Entry = { id: string; [key: string]: string | null | undefined };
type ProfilePortfolioData = { educations: Entry[]; experiences: Entry[]; certifications: Entry[]; projects: Entry[] };
type Kind = keyof ProfilePortfolioData;

export function ProfilePortfolio() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["profile"], queryFn: () => apiFetch<{ data: ProfilePortfolioData }>("/profiles/me") });
  const educationForm = useForm<EducationValues>({ resolver: zodResolver(educationSchema), defaultValues: { institution: "", degree: "", fieldOfStudy: "", startedAt: "", endedAt: "", description: "" } });
  const experienceForm = useForm<ExperienceValues>({ resolver: zodResolver(experienceSchema), defaultValues: { companyName: "", title: "", location: "", startedAt: "", endedAt: "", description: "" } });
  const certificationForm = useForm<CertificationValues>({ resolver: zodResolver(certificationSchema), defaultValues: { name: "", issuer: "", credentialUrl: "", issuedAt: "", expiresAt: "" } });
  const projectForm = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues: { name: "", description: "", projectUrl: "", startedAt: "", endedAt: "" } });
  const add = useMutation({
    mutationFn: ({ kind, values }: { kind: Kind; values: Record<string, string | undefined> }) => apiFetch(`/profiles/me/${kind}`, { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }),
  });
  const remove = useMutation({
    mutationFn: ({ kind, id }: { kind: Kind; id: string }) => apiFetch(`/profiles/me/${kind}/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }),
  });
  const entries = query.data?.data;
  const error = add.error ?? remove.error;
  const saveDates = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || undefined]));

  return <section className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-7">
    <div><p className="eyebrow">Your experience, in your words</p><h2 className="mt-2 font-display text-xl font-bold">Career and learning</h2><p className="mt-1 text-xs text-muted">Add the milestones and work that help teams understand your path.</p></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error instanceof ApiRequestError ? error.message : "This profile change could not be saved."}</p>}
    <div className="mt-6 space-y-7">
      <PortfolioGroup title="Education" icon={GraduationCap}>
        <EntryList items={entries?.educations ?? []} kind="educations" remove={remove.mutate} summary={(entry) => [entry.degree, entry.fieldOfStudy, entry.institution].filter(Boolean).join(" · ")} />
        <form className="mt-3 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2" onSubmit={educationForm.handleSubmit((values) => add.mutate({ kind: "educations", values: saveDates(values) }, { onSuccess: () => educationForm.reset() }))}>
          <label className="field-label sm:col-span-2">Institution<input className="field-control mt-1" {...educationForm.register("institution")} />{educationForm.formState.errors.institution && <FieldError>{educationForm.formState.errors.institution.message}</FieldError>}</label>
          <label className="field-label">Degree<input className="field-control mt-1" {...educationForm.register("degree")} /></label><label className="field-label">Field of study<input className="field-control mt-1" {...educationForm.register("fieldOfStudy")} /></label>
          <label className="field-label">Started<input type="date" className="field-control mt-1" {...educationForm.register("startedAt")} /></label><label className="field-label">Ended<input type="date" className="field-control mt-1" {...educationForm.register("endedAt")} /></label>
          <button className="button-secondary sm:col-span-2" disabled={add.isPending}><Plus size={15} /> Add education</button>
        </form>
      </PortfolioGroup>
      <PortfolioGroup title="Experience" icon={BriefcaseBusiness}>
        <EntryList items={entries?.experiences ?? []} kind="experiences" remove={remove.mutate} summary={(entry) => [entry.title, entry.companyName, entry.location].filter(Boolean).join(" · ")} />
        <form className="mt-3 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2" onSubmit={experienceForm.handleSubmit((values) => add.mutate({ kind: "experiences", values: saveDates(values) }, { onSuccess: () => experienceForm.reset() }))}>
          <label className="field-label">Role title<input className="field-control mt-1" {...experienceForm.register("title")} />{experienceForm.formState.errors.title && <FieldError>{experienceForm.formState.errors.title.message}</FieldError>}</label><label className="field-label">Company<input className="field-control mt-1" {...experienceForm.register("companyName")} /></label>
          <label className="field-label">Location<input className="field-control mt-1" {...experienceForm.register("location")} /></label><label className="field-label">Started<input required type="date" className="field-control mt-1" {...experienceForm.register("startedAt")} /></label><label className="field-label">Ended<input type="date" className="field-control mt-1" {...experienceForm.register("endedAt")} /></label>
          <button className="button-secondary sm:col-span-2" disabled={add.isPending}><Plus size={15} /> Add experience</button>
        </form>
      </PortfolioGroup>
      <PortfolioGroup title="Certifications" icon={Award}>
        <EntryList items={entries?.certifications ?? []} kind="certifications" remove={remove.mutate} summary={(entry) => [entry.name, entry.issuer].filter(Boolean).join(" · ")} />
        <form className="mt-3 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2" onSubmit={certificationForm.handleSubmit((values) => add.mutate({ kind: "certifications", values: saveDates(values) }, { onSuccess: () => certificationForm.reset() }))}>
          <label className="field-label">Certification<input className="field-control mt-1" {...certificationForm.register("name")} /></label><label className="field-label">Issuer<input className="field-control mt-1" {...certificationForm.register("issuer")} /></label>
          <label className="field-label sm:col-span-2">Credential URL<input type="url" className="field-control mt-1" {...certificationForm.register("credentialUrl")} /></label><label className="field-label">Issued<input type="date" className="field-control mt-1" {...certificationForm.register("issuedAt")} /></label><label className="field-label">Expires<input type="date" className="field-control mt-1" {...certificationForm.register("expiresAt")} /></label>
          <button className="button-secondary sm:col-span-2" disabled={add.isPending}><Plus size={15} /> Add certification</button>
        </form>
      </PortfolioGroup>
      <PortfolioGroup title="Projects" icon={FolderKanban}>
        <EntryList items={entries?.projects ?? []} kind="projects" remove={remove.mutate} summary={(entry) => entry.name ?? "Project"} />
        <form className="mt-3 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2" onSubmit={projectForm.handleSubmit((values) => add.mutate({ kind: "projects", values: saveDates(values) }, { onSuccess: () => projectForm.reset() }))}>
          <label className="field-label">Project name<input className="field-control mt-1" {...projectForm.register("name")} /></label><label className="field-label">Project URL<input type="url" className="field-control mt-1" {...projectForm.register("projectUrl")} /></label>
          <label className="field-label">Started<input type="date" className="field-control mt-1" {...projectForm.register("startedAt")} /></label><label className="field-label">Ended<input type="date" className="field-control mt-1" {...projectForm.register("endedAt")} /></label>
          <label className="field-label sm:col-span-2">Description<textarea rows={3} className="field-control mt-1 resize-y" {...projectForm.register("description")} /></label><button className="button-secondary sm:col-span-2" disabled={add.isPending}><Plus size={15} /> Add project</button>
        </form>
      </PortfolioGroup>
    </div>
  </section>;
}

function PortfolioGroup({ title, icon: Icon, children }: { title: string; icon: typeof GraduationCap; children: React.ReactNode }) {
  return <div><h3 className="flex items-center gap-2 font-display font-bold"><Icon size={17} className="text-brand" />{title}</h3>{children}</div>;
}

function EntryList({ items, kind, remove, summary }: { items: Entry[]; kind: Kind; remove: (variables: { kind: Kind; id: string }) => void; summary: (entry: Entry) => string }) {
  if (!items.length) return <p className="mt-2 text-xs text-muted">Nothing added yet.</p>;
  return <ul className="mt-2 space-y-2">{items.map((entry) => <li key={entry.id} className="flex items-center gap-2 rounded-lg border border-black/[.06] px-3 py-2"><p className="min-w-0 flex-1 text-xs font-medium">{summary(entry)}</p><button type="button" aria-label={`Remove ${summary(entry)}`} onClick={() => remove({ kind, id: entry.id })} className="rounded-md p-2 text-muted hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14} /></button></li>)}</ul>;
}

function FieldError({ children }: { children?: string }) { return children ? <span className="mt-1 block text-xs text-rose-700">{children}</span> : null; }
