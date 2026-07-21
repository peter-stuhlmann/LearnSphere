"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@elearning/core/format";
import { startCartCheckout } from "@/app/actions/billing-actions";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import {
  Card,
  Container,
  GhostButton,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import {
  clearCart,
  getCartItems,
  getCartServerSnapshot,
  removeFromCart,
  subscribeCart,
} from "./cartStore";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
  min-height: 55vh;
`;

const List = styled.ul`
  list-style: none;
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const Row = styled(Card)`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.8rem 1rem;

  img,
  .cover {
    width: 96px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: ${({ theme }) => theme.radii.sm};
    flex-shrink: 0;
    overflow: hidden;
  }
`;

const RowTitle = styled.div`
  flex: 1;
  min-width: 0;

  a {
    color: inherit;
    font-weight: 600;
    text-underline-offset: 3px;
  }
`;

const Price = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  color: ${({ theme }) => theme.colors.accent};
  white-space: nowrap;
`;

const TotalBar = styled(Card)`
  margin-top: 1.25rem;
  padding: 1.1rem 1.3rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  strong {
    font-size: 1.25rem;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export function CartView({
  loggedIn,
  enrolledCourseIds,
  purchased,
}: {
  loggedIn: boolean;
  enrolledCourseIds: string[];
  purchased: boolean;
}) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const items = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartServerSnapshot
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nach erfolgreichem Kauf (oder Demo-Kauf) den Warenkorb leeren
  useEffect(() => {
    if (purchased) clearCart();
  }, [purchased]);

  // Bereits gekaufte Kurse fliegen automatisch raus
  useEffect(() => {
    const enrolled = new Set(enrolledCourseIds);
    for (const item of getCartItems()) {
      if (enrolled.has(item.courseId)) removeFromCart(item.courseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmalig beim Laden abgleichen
  }, []);

  const total = items.reduce((sum, item) => sum + item.priceCents, 0);
  const currency = items[0]?.currency ?? "EUR";

  async function checkout() {
    setPending(true);
    setError(null);
    const result = await startCartCheckout({
      courseIds: items.map((item) => item.courseId),
      locale,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "generic");
      return;
    }
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    // Demo-Modus: direkt freigeschaltet
    clearCart();
    router.push("/my-learning");
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>{t("kicker")}</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>

        {purchased ? (
          <Card
            style={{ marginTop: "1.5rem", padding: "1.2rem 1.4rem" }}
            role="status"
          >
            ✅ {t("purchased")}{" "}
            <Link href="/my-learning">{t("toMyLearning")}</Link>
          </Card>
        ) : null}

        {items.length === 0 && !purchased ? (
          <>
            <Muted style={{ marginTop: "1.5rem" }}>{t("empty")}</Muted>
            <div style={{ marginTop: "1rem" }}>
              <GhostButton as={Link} href="/courses">
                {t("browseCourses")}
              </GhostButton>
            </div>
          </>
        ) : null}

        {items.length > 0 ? (
          <>
            <List>
              {items.map((item) => (
                <Row key={item.courseId} as="li">
                  {/* nur validierte Upload-Pfade – manipulierter localStorage
                      fällt auf den Platzhalter zurück */}
                  {item.coverImage?.startsWith("/uploads/") ? (
                    <Image
                      src={item.coverImage}
                      alt=""
                      width={96}
                      height={54}
                    />
                  ) : (
                    <span className="cover" aria-hidden="true">
                      <CoverPlaceholder />
                    </span>
                  )}
                  <RowTitle>
                    <Link
                      href={{
                        pathname: "/courses/[slug]",
                        params: { slug: item.slug },
                      }}
                    >
                      {item.title}
                    </Link>
                  </RowTitle>
                  <Price>
                    {formatPrice(item.priceCents, item.currency, locale)}
                  </Price>
                  <GhostButton
                    type="button"
                    aria-label={`${t("remove")}: ${item.title}`}
                    onClick={() => removeFromCart(item.courseId)}
                  >
                    ✕
                  </GhostButton>
                </Row>
              ))}
            </List>

            <TotalBar>
              <span>
                {t("total", { count: items.length })}{" "}
                <strong>{formatPrice(total, currency, locale)}</strong>
              </span>
              {loggedIn ? (
                <PrimaryButton
                  type="button"
                  disabled={pending}
                  onClick={() => void checkout()}
                >
                  {pending ? t("checkingOut") : t("checkout")}
                </PrimaryButton>
              ) : (
                <PrimaryButton as={Link} href="/login">
                  {t("loginToCheckout")}
                </PrimaryButton>
              )}
            </TotalBar>
            {error ? (
              <Muted role="alert" style={{ marginTop: "0.6rem", color: "#FF7A7A" }}>
                {t(`errors.${error}` as never)}
              </Muted>
            ) : null}
          </>
        ) : null}
      </Container>
    </Wrap>
  );
}
