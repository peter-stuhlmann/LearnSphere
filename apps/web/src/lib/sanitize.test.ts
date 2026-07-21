import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./sanitize";

describe("sanitizeRichText", () => {
  it("keeps allowed formatting tags", () => {
    const html =
      "<h2>Titel</h2><p><strong>fett</strong> <em>kursiv</em> <s>durch</s> <code>code</code></p><ul><li>eins</li></ul><blockquote><p>Zitat</p></blockquote>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps mention spans but strips foreign classes/attributes", () => {
    const mention =
      '<p><span class="mention" data-type="mention" data-id="u1" data-label="Ada">@Ada</span> hi</p>';
    expect(sanitizeRichText(mention)).toBe(mention);

    const hostile = sanitizeRichText(
      '<p><span class="mention evil" onclick="x()" data-id="u1">@Ada</span></p>'
    );
    expect(hostile).not.toContain("evil");
    expect(hostile).not.toContain("onclick");
    expect(hostile).toContain('class="mention"');
  });

  it("removes script tags entirely", () => {
    expect(sanitizeRichText('<p>Hi</p><script>alert("x")</script>')).toBe(
      "<p>Hi</p>"
    );
  });

  it("strips event handler attributes", () => {
    expect(sanitizeRichText('<p onclick="alert(1)">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("strips style attributes", () => {
    expect(sanitizeRichText('<p style="color:red">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("removes javascript: links but keeps https links", () => {
    const dangerous = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(dangerous).not.toContain("javascript:");
    expect(dangerous).not.toContain("href");
    expect(
      sanitizeRichText('<a href="https://example.com">x</a>')
    ).toContain('href="https://example.com"');
  });

  it("forces safe rel on links", () => {
    const result = sanitizeRichText('<a href="https://example.com">x</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("unwraps disallowed tags but keeps their text", () => {
    expect(sanitizeRichText("<h1>Titel</h1>")).toBe("Titel");
    expect(sanitizeRichText("<iframe src='https://x'></iframe>ok")).toBe("ok");
  });

  it("keeps img out of rich text", () => {
    expect(sanitizeRichText('<img src="x.png">Text')).toBe("Text");
  });
});
