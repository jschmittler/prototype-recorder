# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-28

### Added
- Script-driven walkthrough engine: journeys are defined in a `script.md`
  (front-matter + step DSL) and executed by a generic runner — no code changes
  needed to record a new prototype.
- `prototype-recorder-cli` CLI (`record`, `inspect`, `auth`, `setup`, `list`,
  `help`, `version`) plus the original `npm run walkthrough:*` scripts.
- Visible, eased in-page cursor overlay; smooth window/overlay scrolling;
  human-like clicking and typing.
- Prototype inspection (page classification + accessible-element dump).
- Resilient selector resolution (role/name → label → placeholder → alt/testid →
  text → CSS) with `closeOverlay`, `clickEach`, and row-scoped `clickInRow`.
- High-quality WebM export with `ffprobe` verification and an optional VP9
  optimized copy; failure artifacts (screenshot, page text, trace) on error.
- Reusable Figma storage-state auth flow (never stores/prints credentials).
- Reference scripts: `scripts/autodesk-post-purchase-onboarding.md`,
  `scripts/trajectory-click-through.md`.
- Docs: `README.md`, `PLAYBOOK.md`, `DISTRIBUTION.md`, `script.template.md`.
