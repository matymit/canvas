# Canvas Security Review

_Last updated: 2025-10-02_

This document tracks the current security posture of the Canvas project, including automated scan results, known risks, and follow-up actions. It is maintained as part of the Canvas Hardening Plan (Workstream 8).

---

## 🔎 Scan Summary (2025-10-02)

| Scan | Command | Result | Notes |
|------|---------|--------|-------|
| JavaScript dependencies | `npm audit --audit-level=moderate` | ✅ **No vulnerabilities found** | Baseline is clean after dependency updates earlier in the week. Re-run before every release candidate. |
| Rust dependencies | `cargo audit` (from `src-tauri/`) | ⚠️ **13 warnings** | Tauri pulls in unmaintained GTK3 bindings and related crates (`atk`, `gdk`, `gtk`, etc.) plus `glib` unsound iterator advisory. All issues come from the upstream `tauri-runtime-wry`/GTK stack. |
| Static analysis (Semgrep) | `semgrep ci` (Semgrep Cloud, scan_id 97410040) | ⚠️ **26 findings (0 blocking)** | One supply-chain advisory (`glib` GHSA-wrw7-89jp-8q8g) matched `cargo audit`; 25 non-blocking code findings in legacy test fixtures and developer tooling. Details below. |

---

## ⚠️ Rust Advisory Details

`cargo audit` surfaced the following upstream advisories (none currently exploitable via Canvas code, but still notable):

- **GTK3 binding family unmaintained**: `atk`, `gdk`, `gdk-sys`, `gdkwayland-sys`, `gdkx11`, `gtk`, `gtk-sys`, `gtk3-macros`, `atk-sys` (RUSTSEC-2024-0411 through RUSTSEC-2024-0420, 2024-03-04)
  - Originates from `wry` / `tauri-runtime-wry` 0.53/2.8.x, which still target GTK3 on Linux.
  - **Action**: Track upstream migration to GTK4. Monitor Tauri changelog for GTK4 support; plan an upgrade once available. Until then, document GTK3 runtime dependencies in release notes.

- **`glib` unsound Variant iterator**: RUSTSEC-2024-0429 (2024-03-30)
  - Inherited via `webkit2gtk` → `wry`. Upstream has not issued a fix yet.
  - **Action**: Follow https://github.com/tauri-apps/wry/issues for mitigation status. Low risk unless we expose `VariantStrIter` from commands (we currently do not).

- **`proc-macro-error`, `fxhash` unmaintained**: RUSTSEC-2024-0370 and RUSTSEC-2025-0057 (2024-09-01 / 2025-09-05)
  - Transitively used by GTK macros and `selectors`. Await upstream replacements.

Given these are upstream ecosystem warnings, the immediate mitigation is to:
1. Track the `tauri-runtime-wry` dependency for GTK4 adoption.
2. Note the advisories in release documentation for Linux builds.
3. Re-run `cargo audit` weekly until warnings clear; escalate if new high-severity advisories appear.

---

## 🧪 Semgrep Findings (2025-10-02)

### Supply Chain

- **`glib` GHSA-wrw7-89jp-8q8g (Moderate)**
  - Matches the `cargo audit` advisory inherited through `tauri-runtime-wry` and GTK3.
  - **Action**: Track upstream GTK4 migration (see Rust advisory actions above). No additional remediation required beyond dependency monitoring.

### Code Findings (25 non-blocking)

| Category | Files | Risk | Planned Response |
|----------|-------|------|------------------|
| Unsafe format strings in `console.log` diagnostics | `archive/test-files/debug-*.{js,cjs}`, `archive/test-files/test-*.{cjs,js}` | Low — debug utilities outside production bundles | ✅ 2025-10-02: Replaced template literal format strings with constant-first-argument logs to eliminate format-string warnings. |
| Missing SRI attributes on CDN scripts | `archive/test-files/test-circle-text-fix.html`, `test-image-resize.html` | Low — manual test pages; only used locally | ✅ 2025-10-02: Added SHA-384 integrity hashes and `crossorigin="anonymous"` to CDN script tags. |
| Plaintext HTTP links to localhost | `archive/test-files/test-pan-verification*.html`, `test-viewport-sync.html` | Low — local testing docs | ✅ 2025-10-02: Replaced clickable HTTP anchors with static code references to avoid insecure link hints while preserving instructions. |
| Dynamic `RegExp` / potential path traversal in CLI tooling | `scripts/bundle-analyzer.{cjs,js}`, `scripts/check-forbidden-packages.cjs` | Medium — developer tooling accepts user input | ✅ 2025-10-02: Added pattern sanitization, directory boundary checks, and safe path resolution to prevent traversal and dynamic regex abuse.

None of the findings impact the compiled Canvas app. Action items focus on tightening developer scripts and clarifying archived fixture usage. Recurring execution guidance lives in [`docs/security/README.md`](./README.md).

## 🛡️ Configuration Checklist (Current State)

- `tauri.conf.json`
  - ✅ Strict Content Security Policy (`default-src 'self'; connect-src` limited to Canvas API).
  - ✅ Single window with standard decorations (no transparency or always-on-top by default).
  - ⚠️ Plugins enabled: `shell`, `dialog`, `fs`. Capability JSON is not yet scoped; file-system access is broad.
- Rust side (`src-tauri/src/lib.rs`)
  - Only exposes the `greet` command today. No external shell invocations beyond plugin defaults.
  - `tauri_plugin_shell` allows `shell.open()` usage; no restrictions configured.

---

## 📝 Follow-Up Tasks

1. **Scope plugin capabilities**
  - **Done (2025-10-02)** Restrict main window capability to `shell:default` and app-data–scoped `fs` permissions only; removed broad `fs:allow-read/write` grants.

2. **Address Semgrep findings**
  - **Done (2025-10-02)** Hardened bundle analyzer and forbidden-package scripts with glob/path sanitization.
  - **Done (2025-10-02)** Added SRI hashes to legacy HTML fixtures and removed insecure anchors around localhost instructions.
  - **Done (2025-10-02)** Normalized archived console diagnostics to safe logging patterns.

3. **GTK4 migration watch**
  - Track Tauri release notes for GTK4/`wry` updates (see [`docs/security/gtk4-watch.md`](./gtk4-watch.md)). Create an issue once an upgrade path exists.

4. **Secret storage guidance**
  - **Done (2025-10-02)** Documented recommended token handling (secure storage plugin, encrypted IPC, and environment scaffolding) for future authentication work.

---

## 🔐 Secret Storage Guidance

To prepare for upcoming authentication workstreams, follow these practices when handling API tokens or other credentials inside Canvas:

1. **Prefer OS-backed secure storage**
  - Use [`tauri-plugin-secure-storage`](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/secure-storage) to write secrets into the platform keychain (Keychain, Credential Manager, libsecret). This keeps secrets off disk and automatically encrypts at rest.
  - Scope stored keys by environment (e.g., `canvas-dev`, `canvas-prod`) so multiple builds do not collide.

2. **Avoid exposing secrets to the webview**
  - Fetch or refresh tokens via Rust commands guarded by capability-scoped IPC. Return only short-lived session data to the webview.
  - Never persist bearer tokens in `localStorage`, IndexedDB, or window globals. If the frontend must hold a token temporarily, store it in memory and clear it on window blur/lock.

3. **Lock down IPC commands**
  - Gate any secret-bearing commands behind new capability files (`src-tauri/capabilities/secure.json`) so only the authenticated window can call them.
  - Validate caller intent (e.g., enforce audience/expiry on the Rust side) before handing data back.

4. **Integrate with environment management**
  - Keep API keys for bootstrap flows in `.env.*` files synced via `tauri.conf.json > build > beforeBuildCommand` scripts, never hard-coded.
  - Document required variables in `README.md` and mark them in `.env.example` without actual secrets.

5. **Plan for rotation & logout**
  - Provide a Rust-side helper to purge secure-storage entries and broadcast logout events to the frontend so stale tokens cannot be reused.

Following these steps ensures secrets stay inside OS-protected storage, IPC remains scoped, and the React layer never becomes a long-term secret cache.

---

## 📌 Changelog

- **2025-10-02**: Hardened bundle analyzer + forbidden packages scripts (input sanitization, traversal guards); updated Semgrep follow-up log.
- **2025-10-02**: Scoped Tauri main capability to `shell:default` and app-data filesystem permissions, removing unrestricted file access.
- **2025-10-02**: Normalized archived debug logs to avoid dynamic format strings flagged by Semgrep.
- **2025-10-02**: Added secret storage guidance covering secure-storage plugin usage, IPC scoping, and rotation strategy.
- **2025-10-02**: Added `npm run security:baseline` / `security:semgrep` helpers and linked them from the security runbook.
- **2025-10-02**: Authored GTK4 watch doc outlining upstream tracking and migration steps.
- **2025-10-02**: Added SRI hashes to legacy Konva fixtures and replaced localhost anchors with plain text to resolve Semgrep HTML warnings.
- **2025-10-02**: Initial Semgrep cloud scan completed (26 non-blocking findings). Documented supply-chain overlap with `cargo audit` and created remediation tasks for developer tooling + archived fixtures.
- **2025-10-02**: Initial audit completed. NPM clean; `cargo audit` highlights upstream GTK/GLib warnings; Semgrep pending due to MCP migration.
