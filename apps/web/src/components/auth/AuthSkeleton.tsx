"use client";

import styled from "styled-components";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Ladeskelett für die Auth-Seiten: bewusst NUR die zentrierte Form-Box (keine
 * einzelnen Balken). Trägt denselben view-transition-name wie die AuthShell-
 * Karte, damit der Wechsel Anmelden ↔ Registrieren sauber durchmorpht.
 */
const Wrap = styled.main`
  /* füllt als Flex-Child des Seiten-Faders den Raum zwischen Header und Footer */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 20px;
`;

const Box = styled(Skeleton)`
  max-width: 420px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.lg};
  view-transition-name: auth-card;
`;

export function AuthSkeleton() {
  return (
    <Wrap aria-busy="true">
      <Box $w="100%" $h="min(72vh, 520px)" />
    </Wrap>
  );
}
