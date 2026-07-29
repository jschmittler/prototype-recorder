import { describe, it, expect } from "vitest";
import { parseInspectionReport } from "../local";

const SAMPLE = `Prototype inspection report
generated for: https://acme.figma.site/
final url: https://acme.figma.site/
classification: {
  "isPublishedFigmaSite": true,
  "prototypeInIframe": false,
  "looksLikeSSOorAuth": false
}

===== MAIN FRAME =====
url: https://acme.figma.site/
title: Acme Prototype
accessible elements:
{
  "buttons": ["Sign In", "Products"],
  "links": [],
  "textboxes": ["Search"],
  "tabs": ["Overview", "Benefits"],
  "headings": ["Welcome"],
  "images": ["Acme logo"]
}
visible text (truncated):
Welcome. Sign In. Products.
`;

describe("parseInspectionReport", () => {
  it("extracts elements, title, url, and heuristics from the engine report", () => {
    const r = parseInspectionReport(SAMPLE, "https://acme.figma.site/");
    expect(r.finalUrl).toBe("https://acme.figma.site/");
    expect(r.title).toBe("Acme Prototype");
    expect(r.elements.buttons).toEqual(["Sign In", "Products"]);
    expect(r.elements.tabs).toEqual(["Overview", "Benefits"]);
    expect(r.elements.imgAlts).toEqual(["Acme logo"]);
    expect(r.requiresAuthGuess).toBe(false);
    expect(r.inIframe).toBe(false);
    expect(r.visibleText).toContain("Welcome");
  });

  it("degrades gracefully on a malformed report", () => {
    const r = parseInspectionReport("nonsense", "https://x.figma.site/");
    expect(r.finalUrl).toBe("https://x.figma.site/");
    expect(r.elements.buttons).toEqual([]);
  });
});
