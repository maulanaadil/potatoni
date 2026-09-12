import type { Metadata } from "next";
import { UserManager, type InviteView, type UserView } from "@/components/dashboard/user-manager";
import { requirePageSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listOpenInvites } from "@/lib/services/invites";

export const metadata: Metadata = { title: "Team" };

export default async function UsersPage() {
  const session = await requirePageSession("ADMIN");
  const [users, invites] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    listOpenInvites(),
  ]);
  return (
    <UserManager
      users={JSON.parse(JSON.stringify(users)) as UserView[]}
      invites={JSON.parse(JSON.stringify(invites)) as InviteView[]}
      currentUserId={session.sub}
    />
  );
}
