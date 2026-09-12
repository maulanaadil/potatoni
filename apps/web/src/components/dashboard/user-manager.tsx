"use client";

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { EmptyState, Panel } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { ConfirmButton, PageHeader } from "./common";

export type UserView = { id: string; name: string; email: string; role: "ADMIN" | "CASHIER"; createdAt: string };
export type InviteView = {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "CASHIER";
  expiresAt: string;
  lastSentAt: string;
  invitedBy: { name: string } | null;
};
type EditDraft = { id: string; name: string; email: string; role: "ADMIN" | "CASHIER"; password: string };
type InviteDraft = { email: string; name: string; role: "ADMIN" | "CASHIER" };

const roleBadge = (role: "ADMIN" | "CASHIER") =>
  role === "ADMIN"
    ? "rounded-full bg-navy px-2.5 py-0.5 text-xs font-extrabold text-cream uppercase"
    : "rounded-full bg-sun px-2.5 py-0.5 text-xs font-extrabold uppercase";

export function UserManager({
  users: initialUsers,
  invites: initialInvites,
  currentUserId,
}: {
  users: UserView[];
  invites: InviteView[];
  currentUserId: string;
}) {
  const { data: userData, mutate: mutateUsers } = useSWR<{ users: UserView[] }>("/api/admin/users", {
    fallbackData: { users: initialUsers },
  });
  const { data: inviteData, mutate: mutateInvites } = useSWR<{ invites: InviteView[] }>("/api/admin/invites", {
    fallbackData: { invites: initialInvites },
  });
  const users = userData?.users ?? initialUsers;
  const invites = inviteData?.invites ?? initialInvites;

  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [invite, setInvite] = useState<InviteDraft | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      await api(`/api/admin/users/${edit.id}`, {
        method: "PATCH",
        body: { name: edit.name, email: edit.email, role: edit.role, password: edit.password || undefined },
      });
      toast.success("Account updated");
      setEdit(null);
      await mutateUsers();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite() {
    if (!invite) return;
    setSaving(true);
    try {
      const res = await api<{ delivered: boolean; devLink?: string }>("/api/admin/invites", { body: invite });
      toast.success(res.delivered ? `Invite sent to ${invite.email}` : "Invite created (dev mode: email not sent)");
      setDevLink(res.devLink ?? null);
      setInvite(null);
      await mutateInvites();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function resend(i: InviteView) {
    try {
      const res = await api<{ delivered: boolean; devLink?: string }>(`/api/admin/invites/${i.id}/resend`, {
        method: "POST",
      });
      toast.success(`Invite sent again to ${i.email}`);
      setDevLink(res.devLink ?? null);
      await mutateInvites();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function revoke(i: InviteView) {
    try {
      await api(`/api/admin/invites/${i.id}`, { method: "DELETE" });
      toast.success(`Invite for ${i.email} cancelled`);
      await mutateInvites();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/admin/users/${id}`, { method: "DELETE" });
      toast.success("Account deleted");
      setEdit(null);
      await mutateUsers();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite people by email. They confirm the address by opening the link and choosing their own password."
        actions={
          <Button intent="sun" onClick={() => setInvite({ email: "", name: "", role: "CASHIER" })}>
            ✉️ Invite person
          </Button>
        }
      />

      {devLink && (
        <Panel className="mb-4 flex flex-col gap-2 border-dashed bg-sun/30 p-4 text-sm">
          <p className="font-bold">Dev mode: no SMTP set up, so the email wasn&apos;t sent. The invite link:</p>
          <code className="rounded-lg bg-paper px-2 py-1 break-all">{devLink}</code>
          <div className="flex gap-2">
            <Button
              size="sm"
              intent="outline"
              onClick={() => navigator.clipboard.writeText(devLink).then(() => toast.success("Link copied"))}
            >
              Copy link
            </Button>
            <Button size="sm" intent="ghost" onClick={() => setDevLink(null)}>
              Dismiss
            </Button>
          </div>
        </Panel>
      )}

      <Panel className="divide-y-2 divide-navy/10 overflow-hidden">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => setEdit({ id: u.id, name: u.name, email: u.email, role: u.role, password: "" })}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-cream focus-visible:bg-cream"
          >
            <div className="min-w-0">
              <p className="font-bold">
                {u.name} {u.id === currentUserId && <span className="text-navy-soft">(you)</span>}
              </p>
              <p className="truncate text-xs font-semibold text-navy-soft">
                {u.email} · since {formatDateTime(u.createdAt)}
              </p>
            </div>
            <span className={roleBadge(u.role)}>{u.role === "ADMIN" ? "Owner" : "Cashier"}</span>
          </button>
        ))}
      </Panel>

      <h2 className="mt-8 mb-3 font-display text-2xl font-extrabold">Waiting to join</h2>
      {invites.length === 0 ? (
        <EmptyState title="No pending invites">People you invite show up here until they accept.</EmptyState>
      ) : (
        <Panel className="divide-y-2 divide-navy/10 overflow-hidden">
          {invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold">
                  {i.name ? `${i.name} · ` : ""}
                  {i.email}
                </p>
                <p className="text-xs font-semibold text-navy-soft">
                  Invited by {i.invitedBy?.name ?? "—"} · sent {formatDateTime(i.lastSentAt)} · expires{" "}
                  {formatDateTime(i.expiresAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={roleBadge(i.role)}>{i.role === "ADMIN" ? "Owner" : "Cashier"}</span>
                <Button size="sm" intent="outline" onClick={() => resend(i)}>
                  Resend
                </Button>
                <ConfirmButton onConfirm={() => revoke(i)} confirmLabel="Tap again">
                  Cancel
                </ConfirmButton>
              </div>
            </div>
          ))}
        </Panel>
      )}

      <Dialog
        open={invite !== null}
        onOpenChange={(o) => !o && setInvite(null)}
        title="Invite someone"
        description="They get an email with a link to join. The link works for 7 days."
        footer={
          <div className="flex justify-end">
            <Button intent="sun" onClick={sendInvite} disabled={saving || !invite?.email}>
              {saving ? "Sending…" : "Send invite"}
            </Button>
          </div>
        }
      >
        {invite && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" className="sm:col-span-2">
              <Input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                placeholder="cashier@email.com"
                autoFocus
              />
            </Field>
            <Field label="Name (optional)">
              <Input
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                maxLength={60}
              />
            </Field>
            <Field label="Role">
              <Select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value as InviteDraft["role"] })}
              >
                <option value="CASHIER">Cashier (register only)</option>
                <option value="ADMIN">Owner (register + dashboard)</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog
        open={edit !== null}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit account"
        footer={
          <div className="flex justify-between gap-2">
            {edit && edit.id !== currentUserId ? (
              <ConfirmButton onConfirm={() => remove(edit.id)}>Delete</ConfirmButton>
            ) : (
              <span />
            )}
            <Button intent="sun" onClick={saveEdit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={60} />
            </Field>
            <Field label="Role">
              <Select
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value as EditDraft["role"] })}
              >
                <option value="CASHIER">Cashier</option>
                <option value="ADMIN">Owner (admin)</option>
              </Select>
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </Field>
            <Field label="New password" hint="Leave empty to keep the current password." className="sm:col-span-2">
              <Input
                type="password"
                autoComplete="new-password"
                value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Dialog>
    </>
  );
}
