import { db } from "@/lib/db";
import {
  AdminUsersView,
  type UserSortDir,
  type UserSortKey,
} from "@/components/admin/AdminUsersView";

const PAGE_SIZES = [20, 50, 100];
const SORT_KEYS: UserSortKey[] = [
  "email",
  "name",
  "role",
  "courses",
  "enrollments",
  "createdAt",
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const per = PAGE_SIZES.includes(Number(params.per))
    ? Number(params.per)
    : PAGE_SIZES[0];
  const sort: UserSortKey = SORT_KEYS.includes(params.sort as UserSortKey)
    ? (params.sort as UserSortKey)
    : "createdAt";
  const dir: UserSortDir = params.dir === "asc" ? "asc" : "desc";

  const where = q
    ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
    : {};

  const orderBy =
    sort === "courses"
      ? { courses: { _count: dir } }
      : sort === "enrollments"
        ? { enrollments: { _count: dir } }
        : { [sort]: dir };

  const total = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(Math.max(1, Number(params.page) || 1), pages);

  const users = await db.user.findMany({
    where,
    orderBy,
    skip: (page - 1) * per,
    take: per,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      totpEnabled: true,
      _count: { select: { courses: true, enrollments: true } },
    },
  });

  return (
    <AdminUsersView
      filters={{ q, page, per, sort, dir }}
      pagination={{ total, pages, pageSizes: PAGE_SIZES }}
      users={users.map((user) => ({
        id: user.id,
        email: user.email ?? "–",
        name: user.name ?? "–",
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        totpEnabled: user.totpEnabled,
        courses: user._count.courses,
        enrollments: user._count.enrollments,
      }))}
    />
  );
}
