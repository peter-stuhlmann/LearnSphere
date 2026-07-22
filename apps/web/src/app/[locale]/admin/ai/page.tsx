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
import { resolveUsageRange, toIsoDay } from "@/lib/usage-range";

/**
 * /admin/ai – KI-Verbrauch: Tokens (Input System/User, Output), Kosten und
 * Aktivitäten je Zeitraum, Modell und Nutzer. Rollenschutz übernimmt das
 * Admin-Layout.
 */

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

  const now = new Date();
  const range = resolveUsageRange({
    range: params.range,
    from: params.from,
    to: params.to,
    now,
  });
  const { from, toExclusive, days } = range;
  // Zeitfenster fuer jede Abfrage: seit dem Umstieg auf freie Zeitraeume
  // braucht es auch eine obere Grenze (gestern endet nicht heute)
  const timeWindow = { gte: from, lt: toExclusive };

  const activity =
    params.activity && isAiActivity(params.activity) ? params.activity : null;
  const model = (params.model ?? "").slice(0, 100) || null;
  const userId = (params.user ?? "").slice(0, 50) || null;

  const rows: (AiUsageRow & { userId: string | null })[] =
    await db.aiUsage.findMany({
      where: {
        createdAt: timeWindow,
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
      where: { createdAt: timeWindow },
    }),
    db.aiUsage.groupBy({ by: ["model"], where: { createdAt: timeWindow } }),
    db.aiUsage.groupBy({ by: ["userId"], where: { createdAt: timeWindow } }),
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
      range={range.preset}
      customRange={{ from: toIsoDay(range.from), to: toIsoDay(range.to) }}
      today={toIsoDay(now)}
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
