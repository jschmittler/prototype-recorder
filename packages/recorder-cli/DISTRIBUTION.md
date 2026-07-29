# Sharing this with your team

Two supported distribution paths (they compose — publish from the same repo):

1. **Standalone Git repo** — teammates clone and run.
2. **Installable CLI (npm / npx)** — teammates run `prototype-recorder-cli …` from anywhere.

---

## 0. One-time prep (rename the package)

Edit `package.json` and set the real scoped name + repo URL:

```jsonc
{
  "name": "prototype-recorder-cli",   // ← your npm scope / name
  "version": "1.0.0",
  "repository": { "type": "git", "url": "https://github.com/jschmittler/prototype-recorder.git" },
  "publishConfig": { "access": "restricted" }   // "public" for public npm; omit for a private registry
}
```

Also set the copyright holder in `LICENSE`.

---

## 1. Standalone Git repo

This folder is already self-contained (no dependency on the surrounding Next.js
project) and has a git repo initialized with an initial commit. To share it:

```bash
# from this directory:
git remote add origin git@github.com:jschmittler/prototype-recorder-cli.git
git branch -M main
git push -u origin main
```

Teammates then:

```bash
git clone git@github.com:jschmittler/prototype-recorder-cli.git
cd prototype-recorder-cli
npm install                       # postinstall downloads Chromium (skippable)
npx playwright install chromium   # only if the postinstall was skipped
# record a journey:
npm run walkthrough:record -- scripts/autodesk-post-purchase-onboarding.md
# author a new one from the template:
cp script.template.md scripts/my-journey.md
npm run walkthrough:record -- scripts/my-journey.md --url https://my.figma.site
```

Requirements to document for the team: **Node ≥ 18** and **FFmpeg** (`ffprobe`
for duration checks; `ffmpeg` for the optional VP9 copy). WebM still records
without FFmpeg — you just lose the duration report and the optimized copy.

## 2. Installable CLI (npm / npx)

### Public npm
```bash
npm login
npm publish --access public
```
Teammates:
```bash
npm i -g prototype-recorder-cli      # or use npx with no install
prototype-recorder-cli record my-journey.md --url https://my.figma.site
npx prototype-recorder-cli record my-journey.md
```

### Private / internal registry (GitHub Packages, Artifactory, Verdaccio, …)
Add an `.npmrc` (do **not** commit tokens):
```
@jschmittler:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```
```bash
npm publish            # publishConfig.access = "restricted"
```
Teammates set the same `@jschmittler:registry` line and `npm i -g prototype-recorder-cli`.

### Notes
- Outputs are written to the **caller's current directory** (`./output`,
  `./test-results`), so the global CLI drops videos in whatever folder you run it
  from — not inside the installed package.
- The package ships TypeScript sources and runs them via `tsx` (a runtime dep),
  so there is **no build step**. If you prefer shipping compiled JS, add a `tsc`
  build + `prepublishOnly` and point `bin` at `dist/`.
- `postinstall` best-effort-downloads Chromium. Skip it with
  `PROTOTYPE_RECORDER_CLI_SKIP_BROWSER=1` (it is skipped automatically when `CI=true`);
  users can run `prototype-recorder-cli setup` later.

## Releasing new versions

```bash
npm version patch|minor|major   # bumps package.json + tags the commit
git push --follow-tags
npm publish
```
Record notable changes in `CHANGELOG.md`.

## Optional next steps
- **Docker image** (Chromium + ffmpeg baked in) for zero-setup / CI use.
- **GitHub Actions** so committing a `scripts/*.md` records headless and uploads
  the WebM as a downloadable artifact.

Both are sketched in the project README's roadmap; say the word and they can be
added.
