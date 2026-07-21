"use client";

import type { ReactNode } from "react";
import styled from "styled-components";
import { Container } from "@/components/ui/primitives";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const Article = styled.article`
  max-width: 720px;

  h1 {
    font-size: clamp(2rem, 6vw, 3rem);
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.35rem;
    margin: 2.25rem 0 0.75rem;
  }

  p, li {
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: 0.96rem;
  }

  p + p {
    margin-top: 0.75rem;
  }

  ul {
    padding-left: 1.25rem;
    margin-top: 0.5rem;
  }

  address {
    font-style: normal;
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.7;
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export function LegalArticle({ children }: { children: ReactNode }) {
  return (
    <Wrap id="main">
      <Container>
        <Article>{children}</Article>
      </Container>
    </Wrap>
  );
}
