import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeExecutor, type ExecutorProgress } from "../index";

describe("FakeExecutor", () => {
  it("inspects and returns deterministic elements", async () => {
    const exec = new FakeExecutor({ stepMs: 1 });
    const r = await exec.inspect({ url: "https://acme.figma.site/", viewport: { width: 1440, height: 900 } });
    expect(r.finalUrl).toBe("https://acme.figma.site/");
    expect(r.elements.buttons).toContain("Sign In");
    expect(r.requiresAuthGuess).toBe(false);
  });

  it("records a non-empty video and emits progress", async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptw-fake-"));
    const scriptPath = path.join(workDir, "script.md");
    fs.writeFileSync(scriptPath, "---\nurl: https://acme.figma.site/\nviewport: 1440x900\n---\n- hold 1s\n");

    const phases: string[] = [];
    const exec = new FakeExecutor({ stepMs: 1 });
    const res = await exec.record({
      workDir,
      scriptPath,
      url: "https://acme.figma.site/",
      viewport: { width: 1440, height: 900 },
      outputBaseName: "demo",
      includeOptimizedCopy: true,
      keepDiagnostics: false,
      onProgress: (e: ExecutorProgress) => phases.push(e.phase),
    });

    expect(fs.existsSync(res.videoPath)).toBe(true);
    expect(fs.statSync(res.videoPath).size).toBeGreaterThan(0);
    expect(res.metrics.width).toBe(1440);
    expect(res.metrics.height).toBe(900);
    expect(phases).toContain("recording");
    expect(phases).toContain("optimizing");

    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
