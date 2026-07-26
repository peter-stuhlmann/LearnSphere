import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";
import { MobileMenu } from "./MobileMenu";

function renderMenu(props: Partial<Parameters<typeof MobileMenu>[0]> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <ThemeProvider theme={theme}>
      <MobileMenu
        open
        onClose={onClose}
        title="Menü"
        closeLabel="Menü schließen"
        accentColor="#C8FF4D"
        {...props}
      >
        <a href="#kurse">Kurse</a>
        <a href="#preise">Preise</a>
      </MobileMenu>
    </ThemeProvider>
  );
  return { onClose, ...utils };
}

afterEach(() => {
  // Scroll-Lock nach jedem Test zurücksetzen
  document.body.style.overflow = "";
});

describe("MobileMenu", () => {
  it("rendert nichts, solange es geschlossen ist", () => {
    renderMenu({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ist ein modaler Dialog mit Beschriftung, wenn offen", () => {
    renderMenu();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Menü");
  });

  it("zeigt die übergebenen Links", () => {
    renderMenu();
    expect(screen.getByRole("link", { name: "Kurse" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Preise" })).toBeInTheDocument();
  });

  it("fokussiert den Schließen-Button beim Öffnen", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Menü schließen" })).toHaveFocus();
  });

  it("schließt per Klick auf den Schließen-Button", () => {
    const { onClose } = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Menü schließen" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("schließt per Escape-Taste", () => {
    const { onClose } = renderMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sperrt das Body-Scrolling, solange es offen ist", () => {
    const { rerender, onClose } = renderMenu();
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <ThemeProvider theme={theme}>
        <MobileMenu
          open={false}
          onClose={onClose}
          title="Menü"
          closeLabel="Menü schließen"
          accentColor="#C8FF4D"
        >
          <a href="#kurse">Kurse</a>
        </MobileMenu>
      </ThemeProvider>
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("hält den Fokus in der Falle (Tab am Ende springt zum Anfang)", () => {
    renderMenu();
    const links = screen.getAllByRole("link");
    const last = links[links.length - 1];
    const closeBtn = screen.getByRole("button", { name: "Menü schließen" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeBtn).toHaveFocus();
  });
});
