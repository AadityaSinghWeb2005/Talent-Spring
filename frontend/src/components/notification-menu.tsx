"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

type Notice = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
export function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => apiFetch<{ data: Notice[]; unreadCount: number }>("/notifications/me"), staleTime: 15_000 });
  const read = useMutation({ mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: "PATCH" }), onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  const markAll = useMutation({ mutationFn: () => apiFetch("/notifications/read-all", { method: "PATCH" }), onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  const unread = query.data?.unreadCount ?? 0;
  return <div className="relative"><button onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-canvas hover:text-brand"><Bell size={19} />{unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}</button>
    {open && <div className="absolute right-0 z-50 mt-2 w-[min(90vw,360px)] overflow-hidden rounded-2xl border border-black/[.06] bg-white shadow-card"><div className="flex items-center justify-between border-b border-black/[.06] p-4"><div><p className="font-display font-bold">Notifications</p><p className="mt-0.5 text-[11px] text-muted">{unread ? `${unread} unread` : "You’re all caught up"}</p></div>{unread > 0 && <button onClick={() => markAll.mutate()} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><CheckCheck size={14} />Mark all read</button>}</div><div className="max-h-96 overflow-y-auto">{query.data?.data.map((notice) => <button key={notice.id} onClick={() => { if (!notice.readAt) read.mutate(notice.id); }} className={`block w-full border-b border-black/[.04] p-4 text-left hover:bg-canvas ${notice.readAt ? "" : "bg-brand-soft/40"}`}><span className="flex items-start gap-2"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${notice.readAt ? "bg-transparent" : "bg-brand"}`} /><span><span className="block text-sm font-semibold">{notice.title}</span><span className="mt-1 block text-xs leading-5 text-muted">{notice.body}</span><time className="mt-2 block text-[10px] text-muted">{new Date(notice.createdAt).toLocaleString()}</time></span></span></button>)}{!query.data?.data.length && !query.isLoading && <p className="p-8 text-center text-xs text-muted">Nothing new yet. Updates will show here.</p>}</div></div>}
  </div>;
}
