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

===== EXPLORED SCREENS =====
[
  {
    "label": "Products",
    "url": "https://acme.figma.site/products",
    "buttons": ["Manage", "Compare"],
    "links": [],
    "textboxes": [],
    "tabs": ["Usage"],
    "headings": ["All products"],
    "imgAlts": []
  },
  {
    "label": "Learn",
    "url": "https://acme.figma.site/learn",
    "buttons": [],
    "links": ["Guides"],
    "textboxes": [],
    "tabs": [],
    "headings": ["Learning"],
    "imgAlts": []
  }
]
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

  it("extracts the screens explored past the landing page", () => {
    const r = parseInspectionReport(SAMPLE, "https://acme.figma.site/");
    expect(r.screens.map((s) => s.label)).toEqual(["Products", "Learn"]);
    expect(r.screens[0].buttons).toEqual(["Manage", "Compare"]);
    expect(r.screens[1].headings).toEqual(["Learning"]);
  });

  it("does not confuse the landing-page element dump with the screens block", () => {
    const r = parseInspectionReport(SAMPLE, "https://acme.figma.site/");
    expect(r.elements.buttons).toEqual(["Sign In", "Products"]);
  });

  it("degrades gracefully on a malformed report", () => {
    const r = parseInspectionReport("nonsense", "https://x.figma.site/");
    expect(r.finalUrl).toBe("https://x.figma.site/");
    expect(r.elements.buttons).toEqual([]);
    expect(r.screens).toEqual([]);
  });

  it("ignores a screens block that is not valid JSON", () => {
    const r = parseInspectionReport(SAMPLE.replace('"label": "Products"', '"label": '), "https://acme.figma.site/");
    expect(r.screens).toEqual([]);
  });
});
