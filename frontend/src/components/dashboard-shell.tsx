"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, Building2, LayoutDashboard, Search, Settings2, UserRound, UsersRound } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/lib/types";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
const candidateNav: NavItem[] = [
  { href: "/candidate/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/candidate/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/candidate/interviews", label: "Interviews", icon: Bell },
  { href: "/candidate/saved-jobs", label: "Saved jobs", icon: Search },
  { href: "/candidate/profile", label: "My profile", icon: UserRound },
];
const recruiterNav: NavItem[] = [
  { href: "/recruiter/jobs", label: "Overview", icon: LayoutDashboard },
  { href: "/recruiter/jobs", label: "Job postings", icon: BriefcaseBusiness },
  { href: "/recruiter/company", label: "Company", icon: Building2 },
];
const adminNav: NavItem[] = [{ href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/admin/dashboard", label: "Platform users", icon: UsersRound }];

export function DashboardShell({ children, audience = "candidate" }: { children: React.ReactNode; audience?: "candidate" | "recruiter" | "admin" }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const nav = audience === "candidate" ? candidateNav : audience === "admin" ? adminNav : recruiterNav;
  const roles: Role[] = audience === "candidate" ? ["CANDIDATE"] : audience === "admin" ? ["ADMIN"] : ["RECRUITER", "COMPANY_ADMIN", "ADMIN"];
  return <AuthGate roles={roles}><div className="mx-auto grid max-w-7xl gap-7 px-5 py-8 lg:grid-cols-[235px_1fr] lg:px-8 lg:py-10">
    <aside className="h-fit rounded-2xl border border-black/[.06] bg-white p-4 lg:sticky lg:top-24"><div className="px-3 pb-4 pt-2"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-brand">{audience} workspace</p><p className="mt-1 truncate font-display text-lg font-bold">{user?.firstName} {user?.lastName}</p></div><nav className="space-y-1" aria-label="Workspace navigation">{nav.map(({ href, label, icon: Icon }, index) => <Link key={`${href}-${label}`} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${pathname === href || (index === 1 && audience === "recruiter" && pathname.startsWith("/recruiter/jobs/")) ? "bg-brand-soft text-brand" : "text-muted hover:bg-canvas hover:text-ink"}`}><Icon size={17} />{label}</Link>)}</nav><div className="mt-5 border-t border-black/[.06] pt-4"><Link href="/jobs" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-canvas"><Search size={17} />Explore open roles</Link></div></aside>
    <div className="min-w-0">{children}</div>
  </div></AuthGate>;
}
