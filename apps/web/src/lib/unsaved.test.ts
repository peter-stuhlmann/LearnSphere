import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAnyUnsaved, markUnsaved, subscribeUnsaved } from "./unsaved";

describe("unsaved", () => {
  beforeEach(() => {
    // Store zwischen Tests leeren (Modul-Zustand)
    markUnsaved("a", false);
    markUnsaved("b", false);
  });

  it("ist anfangs sauber", () => {
    expect(isAnyUnsaved()).toBe(false);
  });

  it("meldet dirty, solange mindestens ein Formular Änderungen hat", () => {
    markUnsaved("a", true);
    expect(isAnyUnsaved()).toBe(true);

    markUnsaved("b", true);
    markUnsaved("a", false);
    expect(isAnyUnsaved()).toBe(true);

    markUnsaved("b", false);
    expect(isAnyUnsaved()).toBe(false);
  });

  it("benachrichtigt Abonnenten nur bei echten Zustandswechseln", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUnsaved(listener);

    markUnsaved("a", true);
    expect(listener).toHaveBeenCalledTimes(1);

    // gleicher Zustand nochmal → keine weitere Benachrichtigung
    markUnsaved("a", true);
    expect(listener).toHaveBeenCalledTimes(1);
    markUnsaved("b", false);
    expect(listener).toHaveBeenCalledTimes(1);

    markUnsaved("a", false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    markUnsaved("a", true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
