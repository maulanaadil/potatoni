import type { Metadata } from "next";
import { UserManager, type UserView } from "@/components/dashboard/user-manager";
import { requirePageSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Team" };

export default async function UsersPage() {
  const session = await requirePageSession("ADMIN");
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return <UserManager users={JSON.parse(JSON.stringify(users)) as UserView[]} currentUserId={session.sub} />;
}
