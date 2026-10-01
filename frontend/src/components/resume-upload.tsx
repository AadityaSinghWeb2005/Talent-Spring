"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, LoaderCircle, Plus } from "lucide-react";
import { apiFetch, ApiRequestError } from "@/lib/api";

type PresignResponse = { data: { uploadUrl: string; objectKey: string; headers: Record<string, string> } };

export function ResumeUpload({ hasResume }: { hasResume: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const presigned = await apiFetch<PresignResponse>("/uploads/presigned-url", { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileSizeBytes: file.size, kind: "RESUME", isPrimary: !hasResume }) });
      const response = await fetch(presigned.data.uploadUrl, { method: "PUT", headers: presigned.data.headers, body: file });
      if (!response.ok) throw new Error("The file could not be uploaded to secure storage.");
      await apiFetch("/uploads/complete", { method: "POST", body: JSON.stringify({ objectKey: presigned.data.objectKey, fileName: file.name, mimeType: file.type, fileSizeBytes: file.size, kind: "RESUME", isPrimary: !hasResume }) });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setMessage("Your resume is ready to use in applications.");
    } catch (reason) {
      setError(reason instanceof ApiRequestError ? reason.message : reason instanceof Error ? reason.message : "Resume upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="mt-4"><input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()} className="button-secondary !px-4 !py-2.5 !text-xs">{busy ? <LoaderCircle size={15} className="animate-spin" /> : hasResume ? <FileUp size={15} /> : <Plus size={15} />}{busy ? "Uploading…" : "Add a resume"}</button>
    {message && <p role="status" className="mt-2 text-xs text-brand">{message}</p>}{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </div>;
}
