import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "./html-text";

describe("htmlToPlainText", () => {
  it("entfernt Tags und erhält Absätze", () => {
    expect(htmlToPlainText("<p>Hallo <strong>Welt</strong>!</p>")).toBe(
      "Hallo Welt!"
    );
    expect(
      htmlToPlainText("<p>Erster Absatz.</p><p>Zweiter Absatz.</p>")
    ).toBe("Erster Absatz.\n\nZweiter Absatz.");
    expect(htmlToPlainText("Zeile 1<br>Zeile 2")).toBe("Zeile 1\n\nZeile 2");
    expect(
      htmlToPlainText("<ul><li>Eins</li><li>Zwei</li></ul>")
    ).toBe("Eins\n\nZwei");
  });

  it("dekodiert gängige Entities", () => {
    expect(htmlToPlainText("Fish &amp; Chips &lt;3&nbsp;&quot;lecker&quot;")).toBe(
      'Fish & Chips <3 "lecker"'
    );
    expect(htmlToPlainText("na&#39;klar")).toBe("na'klar");
  });

  it("kollabiert Whitespace innerhalb von Absätzen", () => {
    expect(htmlToPlainText("<p>viel   \n  Luft</p>")).toBe("viel Luft");
  });

  it("verwirft Script- und Style-Inhalte", () => {
    expect(
      htmlToPlainText("<style>p{color:red}</style><p>Text</p><script>x()</script>")
    ).toBe("Text");
  });

  it("liefert leeren String für leeren Input", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("<p>   </p>")).toBe("");
  });
});
