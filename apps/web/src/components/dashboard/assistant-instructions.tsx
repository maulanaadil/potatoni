"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import {
  type AssistantInstructionsView,
  INSTRUCTION_VARIABLES,
  MAX_INSTRUCTIONS_LENGTH,
} from "@/lib/assistant-instructions";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { ConfirmButton, PageHeader } from "./common";

const INSTRUCTIONS_URL = "/api/admin/assistant/instructions";

export function AssistantInstructions({
  initial,
  rules,
}: {
  initial: AssistantInstructionsView;
  rules: string | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial.instructions);
  const [saving, setSaving] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const dirty = draft.trim() !== saved.instructions.trim();

  async function save(method: "PUT" | "DELETE") {
    setSaving(true);
    try {
      const next = await api<AssistantInstructionsView>(INSTRUCTIONS_URL, {
        method,
        body: method === "PUT" ? { instructions: draft } : undefined,
      });
      setSaved(next);
      setDraft(next.instructions);
      toast.success(method === "PUT" ? "Saved — the next answer follows these instructions" : "Back to the default");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function insertVariable(name: string) {
    const el = editor.current;
    const token = `{{${name}}}`;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <>
      <PageHeader
        title="Assistant instructions"
        description="Its role, what it knows about Potatoni and how it answers. Changes apply to the next question, for the whole team."
        actions={
          <Link href="/dashboard/assistant" className={buttonVariants({ intent: "outline", size: "sm" })}>
            ← Back to chat
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Panel className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">Insert</span>
            {INSTRUCTION_VARIABLES.map((v) => (
              <button
                key={v.name}
                type="button"
                title={v.description}
                onClick={() => insertVariable(v.name)}
                className="rounded-full border-2 border-navy/20 bg-cream px-3 py-1 font-mono text-xs font-bold outline-none transition-[border-color,transform] duration-160 ease-out-strong hover:border-navy focus-visible:ring-4 focus-visible:ring-sun/70 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                {`{{${v.name}}}`}
              </button>
            ))}
          </div>
          <Textarea
            ref={editor}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_INSTRUCTIONS_LENGTH}
            aria-label="Instructions"
            spellCheck={false}
            className="min-h-[28rem] font-mono text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-navy-soft">
              {saved.isDefault || !saved.updatedAt
                ? "Using the default instructions"
                : `Edited by ${saved.updatedBy ?? "a team member"} · ${formatDateTime(saved.updatedAt)}`}
              {" · "}
              <span className="tabular-nums">
                {draft.length.toLocaleString("id-ID")} / {MAX_INSTRUCTIONS_LENGTH.toLocaleString("id-ID")}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {dirty && (
                <Button intent="ghost" size="sm" disabled={saving} onClick={() => setDraft(saved.instructions)}>
                  Undo changes
                </Button>
              )}
              {!saved.isDefault && (
                <ConfirmButton onConfirm={() => save("DELETE")} confirmLabel="Reset?">
                  Reset to default
                </ConfirmButton>
              )}
              <Button intent="sun" size="sm" disabled={saving || !dirty || !draft.trim()} onClick={() => save("PUT")}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <p className="font-display text-lg font-extrabold">Always added</p>
          <p className="mt-1 text-sm text-navy-soft">
            Fixed rules after your instructions. They keep confirm-before-save, privacy and the chat layout working.
          </p>
          {rules ? (
            <p className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl bg-cream p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {rules}
            </p>
          ) : (
            <p className="mt-3 text-sm font-bold text-tomato">
              Couldn't load them — is the assistant service (apps/ai) running?
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
