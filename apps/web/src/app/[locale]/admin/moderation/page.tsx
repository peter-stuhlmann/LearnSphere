import { db } from "@/lib/db";
import { AdminModerationView } from "@/components/admin/AdminModerationView";

export default async function AdminModerationPage() {
  // Offene Fälle zuerst (FLAGGED), dann laufende (PENDING), zuletzt die
  // jüngsten Entscheidungen als Verlauf
  const entries = await db.mediaModeration.findMany({
    where: { status: { in: ["FLAGGED", "PENDING", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    take: 150,
  });
  const order = { FLAGGED: 0, PENDING: 1, REJECTED: 2, APPROVED: 3 } as const;
  entries.sort((a, b) => order[a.status] - order[b.status]);

  const owners = await db.user.findMany({
    where: { id: { in: [...new Set(entries.map((e) => e.userId))] } },
    select: { id: true, email: true, name: true },
  });
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return (
    <AdminModerationView
      entries={entries.map((entry) => ({
        id: entry.id,
        url: entry.url,
        kind: entry.kind,
        status: entry.status,
        reason: entry.reason ?? "",
        createdAt: entry.createdAt.toISOString(),
        owner:
          ownerById.get(entry.userId)?.email ??
          ownerById.get(entry.userId)?.name ??
          entry.userId,
      }))}
    />
  );
}
