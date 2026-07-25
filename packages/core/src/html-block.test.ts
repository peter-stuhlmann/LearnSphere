import { describe, expect, it } from "vitest";
import {
  buildHtmlBlockSrcDoc,
  htmlBlockCsp,
  htmlBlockHasScript,
  htmlBlockSandbox,
  validateCss,
  validateHtml,
  validateHtmlBlock,
  validateJs,
} from "./html-block";

describe("htmlBlockHasScript", () => {
  it("erkennt vorhandenen JS-Code", () => {
    expect(htmlBlockHasScript("")).toBe(false);
    expect(htmlBlockHasScript("   ")).toBe(false);
    expect(htmlBlockHasScript(undefined as unknown as string)).toBe(false);
    expect(htmlBlockHasScript("alert(1)")).toBe(true);
  });
});

describe("htmlBlockSandbox", () => {
  it("erlaubt Skripte nur bei vorhandenem JS – nie same-origin", () => {
    expect(htmlBlockSandbox("")).toBe("");
    expect(htmlBlockSandbox("var a=1")).toBe("allow-scripts");
    expect(htmlBlockSandbox("var a=1")).not.toContain("allow-same-origin");
  });
});

describe("htmlBlockCsp", () => {
  it("blockt Skripte ohne Code und immer das Netz", () => {
    const off = htmlBlockCsp(false);
    expect(off).toContain("script-src 'none'");
    expect(off).toContain("connect-src 'none'");
    const on = htmlBlockCsp(true);
    expect(on).toContain("script-src 'unsafe-inline'");
    expect(on).toContain("connect-src 'none'");
  });
});

describe("buildHtmlBlockSrcDoc", () => {
  it("bettet CSP, dunklen Hintergrund, CSS und HTML ein", () => {
    const doc = buildHtmlBlockSrcDoc({
      html: "<p>Hi</p>",
      css: "p{color:red}",
      script: "",
    });
    expect(doc).toContain("Content-Security-Policy");
    expect(doc).toContain("script-src 'none'");
    expect(doc).toContain("background:#0B0C15");
    expect(doc).toContain("p{color:red}");
    expect(doc).toContain("<p>Hi</p>");
    expect(doc).not.toContain("<script>");
  });

  it("injiziert das Skript nur bei Code und escaped </script>", () => {
    const doc = buildHtmlBlockSrcDoc({
      html: "<div></div>",
      css: "",
      script: "document.write('</script>')",
    });
    expect(doc).toContain("script-src 'unsafe-inline'");
    expect(doc).toContain("<script>");
    // das End-Tag im Code darf den Skriptblock nicht vorzeitig schließen
    expect(doc).toContain("<\\/script");
  });

  it("verträgt fehlendes html/css ohne 'undefined' auszugeben", () => {
    const doc = buildHtmlBlockSrcDoc({
      html: undefined as unknown as string,
      css: undefined as unknown as string,
      script: "",
    });
    expect(doc).not.toContain("undefined");
  });
});

describe("validateCss", () => {
  it("akzeptiert leeres und gültiges CSS", () => {
    expect(validateCss(undefined as unknown as string)).toEqual([]);
    expect(validateCss("")).toEqual([]);
    expect(validateCss("  ")).toEqual([]);
    expect(validateCss(".a{color:red} .b{margin:calc(1px + 2px)}")).toEqual([]);
  });

  it("ignoriert Klammern in Kommentaren und Strings", () => {
    expect(validateCss("/* } { */ .a{content:'}'}")).toEqual([]);
    expect(validateCss(".a{content:'\\'}'}")).toEqual([]);
    expect(validateCss("/* offen")).toEqual([]);
  });

  it("meldet unausgeglichene Klammern", () => {
    expect(validateCss(".a{color:red")).toHaveLength(1);
    expect(validateCss(".a{}}")[0].message).toContain("schließende");
    expect(validateCss(".a{width:calc(1px}")[0].message).toContain("runde");
  });
});

describe("validateHtml", () => {
  it("akzeptiert leeres und ausgeglichenes HTML", () => {
    expect(validateHtml(undefined as unknown as string)).toEqual([]);
    expect(validateHtml("")).toEqual([]);
    expect(validateHtml("<div><p>Hallo</p></div>")).toEqual([]);
  });

  it("überspringt Void-Elemente, self-closing, Kommentare, Doctype", () => {
    expect(
      validateHtml("<!doctype html><!-- x --><br><img src='a'><hr/>")
    ).toEqual([]);
    expect(validateHtml("<div/><span/>")).toEqual([]);
  });

  it("behandelt script/style als Rohtext", () => {
    expect(validateHtml("<style>.a{}</style>")).toEqual([]);
    expect(validateHtml("<script>if(a<b){}</script>")).toEqual([]);
    expect(validateHtml('<script>var s = "</div>";</script>')).toEqual([]);
    expect(validateHtml("<script>x</script><div>")).toHaveLength(1);
  });

  it("meldet nicht geschlossene Tags", () => {
    expect(validateHtml("<div><p>Hi</div>")[0].message).toContain(
      "verschachtelt"
    );
    expect(validateHtml("<div>offen")[0].message).toContain("Nicht geschlossen");
  });

  it("meldet schließende ohne Öffnen", () => {
    expect(validateHtml("</div>")[0].message).toContain("ohne passendes");
  });
});

describe("validateJs", () => {
  it("akzeptiert leeren und gültigen Code", () => {
    expect(validateJs(undefined as unknown as string)).toEqual([]);
    expect(validateJs("")).toEqual([]);
    expect(validateJs("const a = 1; document.title = a;")).toEqual([]);
  });

  it("meldet Syntaxfehler ohne Ausführung", () => {
    expect(validateJs("const = ;")).toHaveLength(1);
    // würde bei Ausführung werfen, ist aber syntaktisch gültig
    expect(validateJs("throw new Error('x')")).toEqual([]);
  });
});

describe("validateHtmlBlock", () => {
  it("prüft HTML, CSS und das JS-Feld", () => {
    const ok = validateHtmlBlock({
      html: "<p>ok</p>",
      css: ".a{}",
      script: "const a = 1;",
    });
    expect(ok.ok).toBe(true);

    const badJs = validateHtmlBlock({
      html: "<p>ok</p>",
      css: "",
      script: "const = ;",
    });
    expect(badJs.js).toHaveLength(1);
    expect(badJs.ok).toBe(false);
  });

  it("ok=false sobald HTML oder CSS Fehler haben", () => {
    expect(
      validateHtmlBlock({ html: "<div>", css: "", script: "" }).ok
    ).toBe(false);
    expect(
      validateHtmlBlock({ html: "", css: ".a{", script: "" }).ok
    ).toBe(false);
  });
});
