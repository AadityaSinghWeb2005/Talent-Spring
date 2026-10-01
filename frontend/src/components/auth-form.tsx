"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type { AuthUser } from "@/lib/types";

const formSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Enter your password").max(128),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["CANDIDATE", "RECRUITER"]).optional(),
}).superRefine((data, context) => {
  if (data.role) {
    if (data.password.length < 12) context.addIssue({ code: "custom", path: ["password"], message: "Use at least 12 characters" });
    if (!data.firstName || data.firstName.trim().length < 1) context.addIssue({ code: "custom", path: ["firstName"], message: "Enter your first name" });
    if (!data.lastName || data.lastName.trim().length < 1) context.addIssue({ code: "custom", path: ["lastName"], message: "Enter your last name" });
  }
});
type FormValues = z.infer<typeof formSchema>;
type AuthResponse = { data: { accessToken: string; user: AuthUser } };

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [accountRole, setAccountRole] = useState<"CANDIDATE" | "RECRUITER">("CANDIDATE");
  const [submitError, setSubmitError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { role: mode === "register" ? accountRole : undefined },
  });

  async function submit(values: FormValues) {
    setSubmitError("");
    try {
      const result = await apiFetch<AuthResponse>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(mode === "register"
          ? { email: values.email, password: values.password, firstName: values.firstName?.trim(), lastName: values.lastName?.trim(), role: accountRole }
          : { email: values.email, password: values.password }),
      }, false);
      setSession(result.data.accessToken, result.data.user);
      const roles = result.data.user.roles;
      router.push(roles.includes("ADMIN") ? "/admin/dashboard" : roles.some((role) => role === "RECRUITER" || role === "COMPANY_ADMIN") ? "/recruiter/jobs" : "/candidate/dashboard");
    } catch (error) {
      setSubmitError(error instanceof ApiRequestError ? error.message : "We couldn’t connect. Check your connection and try again.");
    }
  }

  return <div className="mx-auto grid min-h-[calc(100vh-160px)] max-w-6xl items-center gap-12 px-5 py-12 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
    <div className="hidden rounded-[2rem] bg-brand p-10 text-white lg:block"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-accent"><Leaf size={24} /></div><p className="mt-10 text-xs font-bold uppercase tracking-[.18em] text-accent">{mode === "register" ? "A fresh start" : "Welcome back"}</p><h1 className="mt-4 max-w-md font-display text-5xl font-bold leading-[1.04] tracking-[-.06em]">{mode === "register" ? "Make room for what’s next." : "Good things grow from here."}</h1><p className="mt-5 max-w-sm text-sm leading-7 text-white/70">{mode === "register" ? "Build a profile, discover teams, and find a role that fits the life you want." : "Pick up where you left off and take the next step in your search."}</p><div className="mt-12 flex items-center gap-2 text-sm font-semibold text-white/80"><span className="h-2 w-2 rounded-full bg-accent" /> A more human way to find work</div></div>
    <div className="mx-auto w-full max-w-md">
      <p className="eyebrow">{mode === "register" ? "Start your journey" : "Your next step"}</p><h2 className="mt-3 font-display text-3xl font-bold tracking-[-.05em]">{mode === "register" ? "Create your account" : "Welcome back"}</h2><p className="mt-2 text-sm text-muted">{mode === "register" ? "It only takes a moment to get started." : "Sign in to continue your journey."}</p>
      {mode === "register" && <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl bg-[#ebeee7] p-1.5">{(["CANDIDATE", "RECRUITER"] as const).map((role) => <button key={role} type="button" onClick={() => { setAccountRole(role); }} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${accountRole === role ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}>{role === "CANDIDATE" ? "I’m looking" : "I’m hiring"}</button>)}</div>}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {mode === "register" && <div className="grid grid-cols-2 gap-3"><div><label className="field-label" htmlFor="firstName">First name</label><input id="firstName" autoComplete="given-name" className="field-control" placeholder="Jordan" {...register("firstName")} />{errors.firstName && <p className="mt-1 text-xs text-rose-700">{errors.firstName.message}</p>}</div><div><label className="field-label" htmlFor="lastName">Last name</label><input id="lastName" autoComplete="family-name" className="field-control" placeholder="Lee" {...register("lastName")} />{errors.lastName && <p className="mt-1 text-xs text-rose-700">{errors.lastName.message}</p>}</div></div>}
        <div><label className="field-label" htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" className="field-control" placeholder="you@example.com" {...register("email")} />{errors.email && <p className="mt-1 text-xs text-rose-700">{errors.email.message}</p>}</div>
        <div><div className="flex items-center justify-between"><label className="field-label" htmlFor="password">Password</label>{mode === "login" && <span className="text-[11px] text-muted">Secure sign in</span>}</div><div className="relative"><input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} className="field-control pr-12" placeholder={mode === "register" ? "At least 12 characters" : "Your password"} {...register("password")} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p className="mt-1 text-xs text-rose-700">{errors.password.message}</p>}</div>
        {submitError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</p>}
        <button disabled={isSubmitting} className="button-primary mt-2 w-full">{isSubmitting ? <LoaderCircle size={17} className="animate-spin" /> : null}{mode === "register" ? "Create account" : "Sign in"}<ArrowRight size={16} /></button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{mode === "register" ? "Already have an account?" : "New to TalentSpring?"} <Link href={mode === "register" ? "/login" : "/register"} className="font-bold text-brand hover:underline">{mode === "register" ? "Sign in" : "Create an account"}</Link></p>
      <p className="mt-5 text-center text-[11px] leading-5 text-muted">By continuing, you agree to use TalentSpring respectfully and keep your account information secure.</p>
    </div>
  </div>;
}
