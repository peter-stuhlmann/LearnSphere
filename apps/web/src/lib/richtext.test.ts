import { describe, expect, it } from "vitest";
import { ensureHtml, isProbablyHtml, plainTextToHtml } from "./richtext";

describe("isProbablyHtml", () => {
  it("detects html content", () => {
    expect(isProbablyHtml("<p>Hallo</p>")).toBe(true);
    expect(isProbablyHtml("  <h2>Titel</h2>")).toBe(true);
  });

  it("treats plain text as not html", () => {
    expect(isProbablyHtml("Hallo Welt")).toBe(false);
    expect(isProbablyHtml("3 < 5 ist wahr")).toBe(false);
    expect(isProbablyHtml("")).toBe(false);
  });
});

describe("plainTextToHtml", () => {
  it("wraps text in a paragraph", () => {
    expect(plainTextToHtml("Hallo")).toBe("<p>Hallo</p>");
  });

  it("converts double newlines to paragraphs", () => {
    expect(plainTextToHtml("Absatz 1\n\nAbsatz 2")).toBe(
      "<p>Absatz 1</p><p>Absatz 2</p>"
    );
  });

  it("converts single newlines to line breaks", () => {
    expect(plainTextToHtml("Zeile 1\nZeile 2")).toBe(
      "<p>Zeile 1<br>Zeile 2</p>"
    );
  });

  it("escapes html entities", () => {
    expect(plainTextToHtml('<script>alert("x")</script> & mehr')).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; mehr</p>"
    );
  });

  it("returns empty string for empty input", () => {
    expect(plainTextToHtml("")).toBe("");
    expect(plainTextToHtml("   ")).toBe("");
  });
});

describe("ensureHtml", () => {
  it("passes html through", () => {
    expect(ensureHtml("<p>Hi</p>")).toBe("<p>Hi</p>");
  });

  it("converts plain text", () => {
    expect(ensureHtml("Hi")).toBe("<p>Hi</p>");
  });
});
