import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useThrottledValue } from "./useThrottledValue";

describe("useThrottledValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useThrottledValue("a", 500));
    expect(result.current).toBe("a");
  });

  it("delays updates until the interval has passed", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 500),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("b");
  });

  it("cancels a pending update on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }) => useThrottledValue(value, 500),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // kein Update nach Unmount – der Timer wurde aufgeräumt
    expect(result.current).toBe("a");
  });

  it("coalesces rapid changes into the latest value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottledValue(value, 500),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    rerender({ value: "c" });
    rerender({ value: "d" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("d");
  });
});
