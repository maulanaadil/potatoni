import type { Metadata } from "next";
import Link from "next/link";
import { Logo, Panel, Sparkles } from "@/components/ui/brand";
import { buttonVariants } from "@/components/ui/button";
import { findInviteByToken } from "@/lib/services/invites";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Join the team" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInviteByToken(token);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Sparkles className="absolute top-10 left-6 h-14 text-navy opacity-70 md:left-16" />
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Logo priority className="h-auto w-64" />
        {invite ? (
          <Panel className="w-full animate-rise p-6 motion-reduce:animate-none">
            <h1 className="font-display text-2xl font-extrabold">Join the Potatoni team</h1>
            <p className="mb-5 text-sm font-semibold text-navy-soft">
              {invite.invitedBy?.name ?? "The owner"} invited <span className="text-navy">{invite.email}</span> as{" "}
              {invite.role === "ADMIN" ? "an owner" : "a cashier"}. Pick your name and a password.
            </p>
            <AcceptInviteForm token={token} defaultName={invite.name ?? ""} email={invite.email} role={invite.role} />
          </Panel>
        ) : (
          <Panel className="w-full p-6 text-center">
            <h1 className="font-display text-2xl font-extrabold">This invite link doesn&apos;t work</h1>
            <p className="mt-1 mb-5 text-sm font-semibold text-navy-soft">
              It may have expired, been used already, or replaced by a newer invite. Ask the owner to send a new one.
            </p>
            <Link href="/login" className={buttonVariants({ intent: "outline" })}>
              Go to sign in
            </Link>
          </Panel>
        )}
      </div>
    </main>
  );
}
