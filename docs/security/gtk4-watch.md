# GTK4 Migration Watch

_Last updated: 2025-10-02_

Canvas bundles the Tauri 2.x runtime on Linux, which currently relies on GTK3 bindings (`wry` + `tauri-runtime-wry`). Upstream has flagged GTK3 crates as unmaintained, so we track the move to GTK4 here.

## 🔗 Key References

- Tauri issue tracker: [tauri-apps/wry#1299 – GTK4 migration meta](https://github.com/tauri-apps/wry/issues/1299)
- Tauri changelog: https://github.com/tauri-apps/tauri/blob/v2/CHANGELOG.md
- RustSec advisories:
  - [RUSTSEC-2024-0411..0420](https://rustsec.org/advisories/RUSTSEC-2024-0411.html) – GTK3 binding family unmaintained
  - [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html) – `glib` unsound Variant iterator

## ✅ What to Monitor

1. **Tauri CLI / runtime releases**
   - Watch for announcements that `tauri-runtime-wry` ships with GTK4 support or deprecates GTK3.
2. **Cargo audit output**
   - After each `npm run security:baseline`, confirm whether GTK advisories remain. If the advisories disappear, verify the dependency tree upgraded to GTK4.
3. **Linux packaging notes**
   - New GTK4 requirements may change system deps (`libgtk-4-1`). Update `docs/security/canvas-security-review.md` and build docs when migrating.

## 📅 Cadence

- **Weekly**: Skim the wry issue linked above when logging `cargo audit` output.
- **Quarterly**: Deep review the GTK4 migration thread and Tauri changelog; note status in the security review changelog.

## 🧭 Migration Checklist (to execute once GTK4 is ready)

1. Upgrade `@tauri-apps/cli` and `tauri` crates to the release that bundles GTK4.
2. Run `cargo update -p wry` (or `tauri-runtime-wry`) and rebuild Linux artifacts.
3. Execute `npm run security:baseline` and confirm GTK advisories are gone.
4. Update `docs/security/canvas-security-review.md` with the removal of GTK3 warnings.
5. Document new system dependency requirements in `docs/development/canvas-tauri-integration.md`.
