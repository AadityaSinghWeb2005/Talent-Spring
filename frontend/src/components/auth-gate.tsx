"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import type { Role } from "@/lib/types";

export function AuthGate({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const ready = useAuthStore((state) => state.ready);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const allowed = !roles || roles.some((role) => user?.roles.includes(role));
  useEffect(() => {
    if (ready && !user) router.replace("/login");
    else if (ready && user && !allowed) router.replace("/");
  }, [ready, user, allowed, router]);
  if (!ready || !user || !allowed) return <div className="grid min-h-[60vh] place-items-center text-brand"><LoaderCircle size={28} className="animate-spin" /><span className="sr-only">Loading your workspace</span></div>;
  return children;
}
