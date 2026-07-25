import { db } from "@/lib/db";

/**
 * DB-Warenkorb eingeloggter Nutzer (geräteübergreifend). Der localStorage-
 * Korb der Gäste wird beim Login per mergeCart zusammengeführt; danach hält
 * CartSync beide Stände synchron. Nimmt userId als Parameter, kennt kein
 * auth() (wie progress-service).
 */

/** Kartendaten, die der Client-Store (cartStore.CartItem) erwartet. */
export interface CartCourseItem {
  courseId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  coverImage: string | null;
}

const MAX_CART_ITEMS = 50;

/**
 * Korb des Users mit frischen Kursdaten. Einträge zu gelöschten,
 * unveröffentlichten oder inzwischen gekauften Kursen werden dabei
 * aufgeräumt statt nur ausgeblendet.
 */
export async function getCartForUser(
  userId: string
): Promise<CartCourseItem[]> {
  const [rows, enrollments] = await Promise.all([
    db.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        courseId: true,
        course: {
          select: {
            slug: true,
            title: true,
            priceCents: true,
            currency: true,
            coverImage: true,
            published: true,
          },
        },
      },
    }),
    db.enrollment.findMany({ where: { userId }, select: { courseId: true } }),
  ]);
  const enrolled = new Set(enrollments.map((e) => e.courseId));

  const stale = rows.filter(
    (row) => !row.course.published || enrolled.has(row.courseId)
  );
  if (stale.length > 0) {
    await db.cartItem.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
  }

  return rows
    .filter((row) => row.course.published && !enrolled.has(row.courseId))
    .map((row) => ({
      courseId: row.courseId,
      slug: row.course.slug,
      title: row.course.title,
      priceCents: row.course.priceCents,
      currency: row.course.currency,
      coverImage: row.course.coverImage,
    }));
}

/**
 * localStorage-Korb in die DB übernehmen (Login/Seitenaufruf): nur
 * veröffentlichte, noch nicht belegte Kurse; Duplikate sind No-Ops.
 * Liefert den zusammengeführten Korb zurück.
 */
export async function mergeCart(
  userId: string,
  courseIds: string[]
): Promise<CartCourseItem[]> {
  const candidates = [...new Set(courseIds)].slice(0, MAX_CART_ITEMS);
  if (candidates.length > 0) {
    const valid = await db.course.findMany({
      where: {
        id: { in: candidates },
        published: true,
        enrollments: { none: { userId } },
      },
      select: { id: true },
    });
    if (valid.length > 0) {
      await db.cartItem.createMany({
        data: valid.map((course) => ({ userId, courseId: course.id })),
        skipDuplicates: true,
      });
    }
  }
  return getCartForUser(userId);
}

/** Kurs in den DB-Korb legen (Duplikate/ungültige Kurse sind No-Ops). */
export async function addCourseToCart(
  userId: string,
  courseId: string
): Promise<void> {
  const course = await db.course.findFirst({
    where: { id: courseId, published: true, enrollments: { none: { userId } } },
    select: { id: true },
  });
  if (!course) return;
  const count = await db.cartItem.count({ where: { userId } });
  if (count >= MAX_CART_ITEMS) return;
  await db.cartItem.createMany({
    data: [{ userId, courseId }],
    skipDuplicates: true,
  });
}

/** Kurs aus dem DB-Korb entfernen. */
export async function removeCourseFromCart(
  userId: string,
  courseId: string
): Promise<void> {
  await db.cartItem.deleteMany({ where: { userId, courseId } });
}
