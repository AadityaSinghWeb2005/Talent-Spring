"use client";

import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, LogOut, Menu, Search, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { NotificationMenu } from "@/components/notification-menu";

export function SiteHeader() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const isRecruiter = user?.roles.some((role) => role === "RECRUITER" || role === "COMPANY_ADMIN" || role === "ADMIN");

  async function signOut() {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch { /* Local session still ends if the API is offline. */ }
    clearSession();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="TalentSpring home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white"><BriefcaseBusiness size={20} /></span>
          <span className="font-display text-xl font-bold tracking-tight">talentspring<span className="text-brand">.</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex" aria-label="Main navigation">
          <Link className="hover:text-brand" href="/jobs">Find jobs</Link>
          <Link className="hover:text-brand" href="/companies">Companies</Link>
          {user && !isRecruiter && <Link className="hover:text-brand" href="/candidate/applications">My applications</Link>}
          {user && isRecruiter && <Link className="hover:text-brand" href="/recruiter/jobs">Recruiter workspace</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {user && <NotificationMenu />}
          {!user ? <>
            <Link href="/login" className="hidden rounded-lg px-4 py-2.5 text-sm font-semibold text-ink hover:bg-canvas sm:inline-flex">Sign in</Link>
            <Link href="/register" className="button-primary !px-4 !py-2.5 !text-sm">Get started</Link>
          </> : <div className="relative">
            <button onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1.5 pr-3 text-sm font-semibold text-ink" aria-expanded={menuOpen}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand"><UserRound size={16} /></span>
              <span className="hidden sm:inline">{user.firstName}</span><ChevronDown size={15} />
            </button>
            {menuOpen && <div className="absolute right-0 mt-3 w-56 rounded-xl border border-black/5 bg-white p-2 shadow-card">
              <Link onClick={() => setMenuOpen(false)} className="menu-link" href={isRecruiter ? "/recruiter/jobs" : "/candidate/profile"}><UserRound size={16} /> Workspace</Link>
              <button onClick={() => void signOut()} className="menu-link w-full text-left text-rose-700"><LogOut size={16} /> Sign out</button>
            </div>}
          </div>}
          <button onClick={() => setMobileOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-lg text-ink md:hidden" aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={21} /></button>
          <Link href="/jobs" className="hidden rounded-full bg-accent p-2.5 text-ink lg:grid" aria-label="Search jobs"><Search size={17} /></Link>
        </div>
      </div>
      {mobileOpen && <nav className="border-t border-black/[.06] bg-white px-5 py-3 md:hidden" aria-label="Mobile navigation"><div className="mx-auto flex max-w-7xl flex-col gap-1">{[["/jobs", "Find jobs"], ["/companies", "Companies"], ...(user ? [[isRecruiter ? "/recruiter/jobs" : "/candidate/applications", isRecruiter ? "Recruiter workspace" : "My applications"]] : [["/login", "Sign in"]])].map(([href, title]) => <Link key={href} onClick={() => setMobileOpen(false)} href={href} className="rounded-lg px-3 py-3 text-sm font-semibold text-ink hover:bg-canvas">{title}</Link>)}</div></nav>}
    </header>
  );
}
