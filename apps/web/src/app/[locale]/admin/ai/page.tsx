import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import {
  groupUsage,
  isAiActivity,
  stackedDailySeries,
  totalsFor,
  usageCostUsd,
  type AiUsageRow,
} from "@elearning/core/ai-usage";
import { AdminAiUsageView } from "@/components/admin/AdminAiUsageView";

/**
 * /admin/ai – KI-Verbrauch: Tokens (Input System/User, Output), Kosten und
 * Aktivitäten je Zeitraum, Modell und Nutzer. Rollenschutz übernimmt das
 * Admin-Layout.
 */

const RANGES = ["7d", "30d", "90d", "365d"] as const;
type UsageRange = (typeof RANGES)[number];
const RANGE_DAYS: Record<UsageRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("aiTitle") };
}

export default async function AdminAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const range: UsageRange = (RANGES as readonly string[]).includes(
    params.range ?? ""
  )
    ? (params.range as UsageRange)
    : "30d";
  const days = RANGE_DAYS[range];
  const now = new Date();
  const from = new Date(now.getTime() - (days - 1) * 86_400_000);

  const activity =
    params.activity && isAiActivity(params.activity) ? params.activity : null;
  const model = (params.model ?? "").slice(0, 100) || null;
  const userId = (params.user ?? "").slice(0, 50) || null;

  const rows: (AiUsageRow & { userId: string | null })[] =
    await db.aiUsage.findMany({
      where: {
        createdAt: { gte: from },
        ...(activity ? { activity } : {}),
        ...(model ? { model } : {}),
        ...(userId ? { userId } : {}),
      },
      select: {
        createdAt: true,
        activity: true,
        model: true,
        inputTokens: true,
        systemTokens: true,
        userTokens: true,
        outputTokens: true,
        audioSeconds: true,
        userId: true,
      },
      orderBy: { createdAt: "asc" },
    });

  // Filter-Optionen aus dem GESAMTEN Zeitraum (nicht vom aktiven Filter
  // eingeschränkt), damit man Filter wieder wechseln kann
  const [activityGroups, modelGroups, userGroups] = await Promise.all([
    db.aiUsage.groupBy({
      by: ["activity"],
      where: { createdAt: { gte: from } },
    }),
    db.aiUsage.groupBy({ by: ["model"], where: { createdAt: { gte: from } } }),
    db.aiUsage.groupBy({ by: ["userId"], where: { createdAt: { gte: from } } }),
  ]);
  const optionUserIds = userGroups.flatMap((g) => g.userId ?? []);
  const users = optionUserIds.length
    ? await db.user.findMany({
        where: { id: { in: optionUserIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const userLabel = new Map(
    users.map((u) => [u.id, u.name || u.email] as const)
  );

  // Tagesreihen je Messgröße, gestapelt nach Aktivität
  const daily = {
    tokens: stackedDailySeries(rows, from, days, {
      keyOf: (r) => r.activity,
      valueOf: (r) => r.inputTokens + r.outputTokens,
    }),
    cost: stackedDailySeries(rows, from, days, {
      keyOf: (r) => r.activity,
      valueOf: (r) => usageCostUsd(r),
    }),
    calls: stackedDailySeries(rows, from, days, {
      keyOf: (r) => r.activity,
      valueOf: () => 1,
    }),
  };

  const byUserRaw = groupUsage(
    rows.filter((r) => r.userId),
    (r) => r.userId as string
  );

  return (
    <AdminAiUsageView
      range={range}
      filters={{ activity, model, user: userId }}
      options={{
        activities: activityGroups.map((g) => g.activity).sort(),
        models: modelGroups.map((g) => g.model).sort(),
        users: optionUserIds
          .map((id) => ({ id, label: userLabel.get(id) ?? id }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      }}
      totals={totalsFor(rows)}
      daily={daily}
      byActivity={groupUsage(rows, (r) => r.activity)}
      byModel={groupUsage(rows, (r) => r.model)}
      byUser={byUserRaw.map((group) => ({
        ...group,
        label: userLabel.get(group.key) ?? group.key,
      }))}
    />
  );
}
