"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Save, Sparkles, Trash2, UserRound, Star, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { DashboardShell } from "@/components/dashboard-shell";
import { ResumeUpload } from "@/components/resume-upload";
import { ProfilePortfolio } from "@/components/profile-portfolio";

const profileSchema = z.object({
  headline: z.string().max(150),
  bio: z.string().max(5000),
  locationCity: z.string().max(100),
  locationCountry: z.string().max(100),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
  skills: z.string(),
});
type ProfileValues = z.infer<typeof profileSchema>;
type Profile = { headline: string | null; bio: string | null; locationCity: string | null; locationCountry: string | null; yearsOfExperience: number; skills: Array<{ name: string }>; resumes: Array<{ id: string; fileName: string; isPrimary: boolean; fileSizeBytes: number }> };

export default function CandidateProfilePage() {
  const client = useQueryClient();
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: ["profile"], queryFn: () => apiFetch<{ data: Profile }>("/profiles/me") });
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: { headline: "", bio: "", locationCity: "", locationCountry: "", yearsOfExperience: 0, skills: "" } });
  useEffect(() => { if (query.data?.data) { const profile = query.data.data; form.reset({ headline: profile.headline ?? "", bio: profile.bio ?? "", locationCity: profile.locationCity ?? "", locationCountry: profile.locationCountry ?? "", yearsOfExperience: profile.yearsOfExperience, skills: profile.skills.map(({ name }) => name).join(", ") }); } }, [query.data, form]);
  const update = useMutation({
    mutationFn: (values: ProfileValues) => apiFetch("/profiles/me", { method: "PATCH", body: JSON.stringify({ ...values, skills: values.skills.split(",").map((skill) => skill.trim()).filter(Boolean) }) }),
    onSuccess: () => { setSaved(true); client.invalidateQueries({ queryKey: ["profile"] }); window.setTimeout(() => setSaved(false), 2400); },
  });
  const primary = useMutation({ mutationFn: (id: string) => apiFetch(`/uploads/resumes/${id}/primary`, { method: "PATCH" }), onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }) });
  const removeResume = useMutation({ mutationFn: (id: string) => apiFetch(`/uploads/resumes/${id}`, { method: "DELETE" }), onSuccess: () => client.invalidateQueries({ queryKey: ["profile"] }) });
  const profile = query.data?.data;
  return <DashboardShell><div><p className="eyebrow">A little more about you</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.05em]">Your profile</h1><p className="mt-2 text-sm text-muted">Give good teams a feel for the work you love and the way you think.</p></div>
    <div className="mt-7 space-y-6">
      <form onSubmit={form.handleSubmit((values) => update.mutate(values))}>
      <section className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><UserRound size={18} /></span><div><h2 className="font-display text-lg font-bold">Your introduction</h2><p className="text-xs text-muted">The details that help people find you.</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><label className="field-label" htmlFor="headline">Professional headline</label><input className="field-control" id="headline" placeholder="e.g. Product designer who loves simplifying complex things" {...form.register("headline")} /><p className="mt-1 text-[11px] text-muted">A short line that captures what you do best.</p></div><div><label className="field-label" htmlFor="city">City</label><input id="city" className="field-control" {...form.register("locationCity")} /></div><div><label className="field-label" htmlFor="country">Country</label><input id="country" className="field-control" {...form.register("locationCountry")} /></div><div><label className="field-label" htmlFor="experience">Years of experience</label><input id="experience" type="number" min="0" className="field-control" {...form.register("yearsOfExperience")} /></div><div><label className="field-label" htmlFor="skills">Skills</label><input id="skills" className="field-control" placeholder="React, Product strategy, SQL" {...form.register("skills")} /><p className="mt-1 text-[11px] text-muted">Separate each skill with a comma.</p></div><div className="sm:col-span-2"><label className="field-label" htmlFor="bio">A little about you</label><textarea id="bio" rows={5} className="field-control resize-y" placeholder="What kind of work energizes you? What have you built that you’re proud of?" {...form.register("bio")} /></div></div>
      </section>
      {update.isError && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{update.error instanceof ApiRequestError ? update.error.message : "Your profile could not be saved."}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted">Your profile is only shared with hiring teams where appropriate.</span><button disabled={update.isPending} className="button-primary">{saved ? <Check size={17} /> : <Save size={17} />}{update.isPending ? "Saving…" : saved ? "Saved" : "Save profile"}</button></div>
      </form>
      <ProfilePortfolio />
      <section className="rounded-2xl border border-black/[.06] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-brand"><FileText size={18} /></span><div><h2 className="font-display text-lg font-bold">Your resumes</h2><p className="text-xs text-muted">Choose a resume when you apply to a role.</p></div></div>
        <div className="mt-5 space-y-2">{profile?.resumes.map((resume) => <div key={resume.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[.06] p-3"><FileText size={17} className="text-brand" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{resume.fileName}</span>{resume.isPrimary && <span className="tag">Primary</span>}<span className="text-[11px] text-muted">{Math.max(1, Math.round(resume.fileSizeBytes / 1024))} KB</span>{!resume.isPrimary && <button type="button" onClick={() => primary.mutate(resume.id)} aria-label="Set as primary resume" title="Set as primary" className="rounded-lg p-2 text-muted hover:bg-accent hover:text-brand"><Star size={15} /></button>}<button type="button" onClick={async () => { const result = await apiFetch<{ data: { downloadUrl: string } }>(`/uploads/resumes/${resume.id}/download-url`); window.location.assign(result.data.downloadUrl); }} aria-label="Download resume" title="Download resume" className="rounded-lg p-2 text-muted hover:bg-brand-soft hover:text-brand"><Download size={15} /></button><button type="button" onClick={() => removeResume.mutate(resume.id)} aria-label="Delete resume" title="Delete resume" className="rounded-lg p-2 text-muted hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button></div>)}{!profile?.resumes.length && <p className="rounded-xl bg-canvas p-4 text-xs text-muted">Upload a PDF or DOCX resume to make applying easier.</p>}</div>
        <ResumeUpload hasResume={Boolean(profile?.resumes.length)} />
        <div className="mt-5 rounded-xl bg-brand-soft p-4"><p className="flex items-center gap-2 text-sm font-bold text-brand"><Sparkles size={16} /> Make your profile work harder</p><p className="mt-1 text-xs leading-5 text-brand/80">A headline, a few skills, and one resume help teams see your potential at a glance.</p></div>
      </section>
    </div>
  </DashboardShell>;
}
