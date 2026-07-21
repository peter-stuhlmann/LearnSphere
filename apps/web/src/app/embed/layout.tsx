import type { ReactNode } from "react";

export const metadata = {
  robots: { index: false },
};

/** Minimales Root-Layout für einbettbare Widgets – kein App-Chrome. */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: "transparent" }}>{children}</body>
    </html>
  );
}
