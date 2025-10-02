# Canvas Security Runbook

_Last updated: 2025-10-02_

This runbook centralizes the operational security tasks for Canvas. Use it as the starting point when validating a release, responding to a report, or onboarding a new maintainer.

---

## 🔁 Recurring Checks

| Cadence | Task | Command / Link | Notes |
|---------|------|----------------|-------|
| Weekly | Dependency audit (JS) | `npm run security:baseline` | Runs NPM + Cargo audits; log results in [`docs/security/canvas-security-review.md`](./canvas-security-review.md). |
| Weekly | Dependency audit (Rust) | `npm run security:baseline` | Uses `cargo audit --manifest-path src-tauri/Cargo.toml`; monitor GTK/GLib advisories. |
| Monthly | Semgrep static analysis | `npm run security:semgrep` | Uses the Semgrep Cloud project (`mtmitchel-personal-org`). Attach findings to the security review. |
| Quarterly | Capability review | Inspect [`src-tauri/capabilities/`](../../src-tauri/capabilities) | Confirm minimal permissions (`shell:default`, `fs:allow-appdata-*`, etc.) remain accurate. |
| Quarterly | Secret storage rotation dry run | [`docs/security/canvas-security-review.md`](./canvas-security-review.md#-secret-storage-guidance) | Verify secure-storage plugin usage and logout flow purge secrets correctly. |

---

## 🛠️ One-Off Playbooks

- **Run the full security baseline**: follow the checklist in [`docs/canvas-hardening-plan.md`](../canvas-hardening-plan.md) Workstream 8.
- **Execute scripted baseline**: `npm run security:baseline` (will fail if either audit surfaces new issues).
- **Scope a new window/plugin**: clone [`src-tauri/capabilities/main.json`](../../src-tauri/capabilities/main.json) and grant only the required permissions; update this runbook once live.
- **Handle reported vulnerability**: capture details in the security review, create a GitHub issue with severity/impact, and coordinate fixes through the hardening plan.

---

## 📚 Reference Docs

- [Canvas Security Review](./canvas-security-review.md)
- [Hardening & Launch Readiness Plan](../canvas-hardening-plan.md)
- [Secret Storage Guidance](./canvas-security-review.md#-secret-storage-guidance)
- [Tauri Capability Schema](../../src-tauri/gen/schemas/desktop-schema.json)

Keep this file updated whenever new recurring checks or playbooks are introduced.
