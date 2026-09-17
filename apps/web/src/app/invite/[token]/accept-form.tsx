"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api } from "@/lib/client";

export function AcceptInviteForm({
  token,
  defaultName,
  email,
  role,
}: {
  token: string;
  defaultName: string;
  email: string;
  role: "ADMIN" | "CASHIER" | "KITCHEN";
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("The passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/invites/${encodeURIComponent(token)}/accept`, { body: { name, password } });
      toast.success(`Welcome to Potatoni, ${name.split(" ")[0]}!`);
      router.replace(role === "ADMIN" ? "/dashboard" : "/");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Lets password managers save the login under the right email */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <Field label="Your name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      <Field label="Repeat password">
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" intent="sun" size="lg" disabled={loading}>
        {loading ? "Setting up…" : "Join the team"}
      </Button>
    </form>
  );
}
