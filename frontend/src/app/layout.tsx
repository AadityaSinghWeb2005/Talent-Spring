import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "TalentSpring — Find work that moves you forward", template: "%s | TalentSpring" },
  description: "Discover thoughtful teams and opportunities that fit your next chapter.",
  openGraph: { title: "TalentSpring", description: "Find work that moves you forward.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers><SiteHeader /><main className="min-h-[calc(100vh-76px)]">{children}</main><footer className="border-t border-black/[.06] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>© {new Date().getFullYear()} TalentSpring. Work, with possibility.</span><div className="flex gap-5"><a href="/jobs" className="hover:text-brand">Explore roles</a><a href="/register" className="hover:text-brand">For employers</a></div></div></footer></Providers></body></html>
}
