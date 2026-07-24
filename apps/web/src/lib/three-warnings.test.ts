import { describe, expect, it, vi } from "vitest";
import { installThreeClockWarningFilter } from "./three-warnings";

function fakeConsole() {
  return { warn: vi.fn() };
}

describe("installThreeClockWarningFilter", () => {
  it("schluckt genau die Clock-Deprecation von three", () => {
    const target = fakeConsole();
    const original = target.warn;
    installThreeClockWarningFilter(target);
    target.warn(
      "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."
    );
    expect(original).not.toHaveBeenCalled();
  });

  it("lässt alle anderen Warnungen durch", () => {
    const target = fakeConsole();
    const original = target.warn;
    installThreeClockWarningFilter(target);
    target.warn("THREE.WebGLRenderer: something else");
    target.warn(42, { detail: true });
    expect(original).toHaveBeenCalledTimes(2);
    expect(original).toHaveBeenCalledWith("THREE.WebGLRenderer: something else");
    expect(original).toHaveBeenCalledWith(42, { detail: true });
  });

  it("wrappt dasselbe Ziel nur einmal", () => {
    const target = fakeConsole();
    installThreeClockWarningFilter(target);
    const wrapped = target.warn;
    installThreeClockWarningFilter(target);
    expect(target.warn).toBe(wrapped);
  });
});
