"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { ConfirmButton, PageHeader } from "./common";

export type UserView = { id: string; name: string; email: string; role: "ADMIN" | "CASHIER"; createdAt: string };
type Draft = { id?: string; name: string; email: string; role: "ADMIN" | "CASHIER"; password: string };

export function UserManager({ users: initial, currentUserId }: { users: UserView[]; currentUserId: string }) {
  const { data, mutate } = useSWR<{ users: UserView[] }>("/api/admin/users", { fallbackData: { users: initial } });
  const users = data?.users ?? initial;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api(draft.id ? `/api/admin/users/${draft.id}` : "/api/admin/users", {
        method: draft.id ? "PATCH" : "POST",
        body: { name: draft.name, email: draft.email, role: draft.role, password: draft.password || undefined },
      });
      toast.success(draft.id ? "Account updated" : "Account created");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      toast.success("Account deleted");
      setDraft(null);
      await mutate();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Cashiers can use the register. Owners can also open this dashboard."
        actions={
          <Button intent="sun" onClick={() => setDraft({ name: "", email: "", role: "CASHIER", password: "" })}>
            + New account
          </Button>
        }
      />
      <Panel className="divide-y-2 divide-navy/10 overflow-hidden">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setDraft({ id: u.id, name: u.name, email: u.email, role: u.role, password: "" })}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-cream"
          >
            <div className="min-w-0">
              <p className="font-bold">
                {u.name} {u.id === currentUserId && <span className="text-navy/50">(you)</span>}
              </p>
              <p className="truncate text-xs font-semibold text-navy/55">
                {u.email} · since {formatDateTime(u.createdAt)}
              </p>
            </div>
            <span
              className={
                u.role === "ADMIN"
                  ? "rounded-full bg-navy px-2.5 py-0.5 text-xs font-extrabold text-cream uppercase"
                  : "rounded-full bg-sun px-2.5 py-0.5 text-xs font-extrabold uppercase"
              }
            >
              {u.role === "ADMIN" ? "Owner" : "Cashier"}
            </span>
          </button>
        ))}
      </Panel>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? "Edit account" : "New account"}
        footer={
          <div className="flex justify-between gap-2">
            {draft?.id && draft.id !== currentUserId ? (
              <ConfirmButton onConfirm={() => remove(draft.id!)}>Delete</ConfirmButton>
            ) : (
              <span />
            )}
            <Button intent="sun" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
            </Field>
            <Field label="Role">
              <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Draft["role"] })}>
                <option value="CASHIER">Cashier</option>
                <option value="ADMIN">Owner (admin)</option>
              </Select>
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field
              label={draft.id ? "New password" : "Password"}
              hint={draft.id ? "Leave empty to keep the current password." : "At least 8 characters."}
              className="sm:col-span-2"
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
