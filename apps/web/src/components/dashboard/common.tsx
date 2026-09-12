"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageEditor } from "@/components/ui/image-editor";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { mediaUrl } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-none font-extrabold md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm font-semibold text-navy-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Destructive actions need two taps; the armed state resets after 3s. */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Tap again to confirm",
  size = "sm",
}: {
  onConfirm: () => Promise<void> | void;
  children: ReactNode;
  confirmLabel?: string;
  size?: "sm" | "md";
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function click() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
      return;
    }
    clearTimeout(timer.current);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <Button intent="danger" size={size} onClick={click} disabled={busy}>
      {armed ? confirmLabel : children}
    </Button>
  );
}

export function ImageUpload({
  value,
  onChange,
  folder,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  folder: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function closeEditor() {
    if (editing?.startsWith("blob:")) URL.revokeObjectURL(editing);
    setEditing(null);
    if (input.current) input.current.value = "";
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", folder);
      const { key } = await api<{ key: string }>("/api/admin/uploads", { body });
      onChange(key);
      closeEditor();
      toast.success("Image uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-navy/30 bg-cream",
          uploading && "animate-pulse motion-reduce:animate-none",
        )}
      >
        {value ? (
          <Image src={mediaUrl(value)!} alt="" fill sizes="80px" className="object-contain mix-blend-multiply" />
        ) : (
          <span className="text-2xl opacity-40">🖼️</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button intent="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value && (
          <Button intent="outline" size="sm" disabled={uploading} onClick={() => setEditing(mediaUrl(value))}>
            Edit
          </Button>
        )}
        {value && (
          <Button intent="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setEditing(URL.createObjectURL(file));
        }}
      />
      <ImageEditor src={editing} onCancel={closeEditor} onDone={upload} />
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-extrabold uppercase",
        active ? "bg-leaf/15 text-leaf" : "bg-navy/10 text-navy-soft",
      )}
    >
      {active ? "On menu" : "Hidden"}
    </span>
  );
}
