# Canvas × Tauri Integration Guide

_Last updated: 2025-10-02_

This guide captures the current best practices for embedding the Canvas web frontend inside a Tauri desktop shell. It assumes familiarity with React, TypeScript, and basic Rust. Use it as a companion to `tauri.conf.json` and the modules under `src-tauri/` when you add new desktop features or automate builds.

---

## 📦 Project Layout Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| React/Vite frontend | `src/` → bundled to `dist/` | Canvas UI, Konva rendering, application logic |
| Tauri shell | `src-tauri/` | Rust commands, window orchestration, OS integrations |
| Shared tooling | `package.json`, `Cargo.toml` | Ensures NPM + Cargo scripts stay in sync |

The current Tauri setup keeps almost all behavior in the web layer and exposes a minimal Rust surface (`greet` command, shell/dialog/fs plugins). Expand the Rust side only when browser APIs are insufficient.

---

## ✅ Prerequisites

1. **Toolchains**
   - Node.js ≥ 18 and npm (for the Vite build).
   - Rust stable with `cargo` and the Tauri CLI (`cargo install tauri-cli`).
   - Platform-specific build dependencies ([Tauri requirements](https://tauri.app/v1/guides/getting-started/prerequisites)).
2. **Environment**
   - Ensure `npm install` and `cargo check` succeed from the repo root.
   - On macOS, install Xcode Command Line Tools; on Linux, ensure `libgtk-3-dev`/`libayatana-appindicator3-dev` are present; on Windows, install the MSVC build tools.

---

## 🚀 Run Canvas inside Tauri (Development)

1. Install dependencies (one-time):
   ```bash
   npm install
   cargo fetch
   ```
2. Start the combined dev environment:
   ```bash
   npm run tauri dev
   ```
   - Tauri runs the frontend via `npm run dev` (see `tauri.conf.json > build.beforeDevCommand`).
   - The desktop window hot-reloads as Vite rebuilds; Rust changes require a restart.
3. To launch the web frontend alone, use `npm run dev`; the desktop shell expects `http://localhost:1420` to be reachable during development.

### Hot Reload Tips
- Heavy Konva scenes can stall reloads; keep the dev window narrow when profiling.
- Tauri caches the frontend build output—if you see stale assets, clear `dist/` (`npm run build` regenerates it).

---

## 🏗️ Production Build & Packaging

To produce desktop bundles:

```bash
npm run build           # Vite bundles to dist/
npm run tauri build     # Runs Cargo build + bundler targets
```

The `tauri.conf.json > build.beforeBuildCommand` already runs `npm run build`, so `npm run tauri build` is typically sufficient. Artifacts land under `src-tauri/target/{debug,release}/` and platform-specific bundle directories (`.app`, `.msi`, `.AppImage`, etc.).

**Release checklist**
- Run `npm run type-check`, `npm run lint`, `npm run test:mvp:all` beforehand.
- Update `tauri.conf.json > bundle.shortDescription/longDescription` if release notes change.
- Verify the CSP (`app.security.csp`) still matches outbound APIs; adjust when adding new domains (e.g., analytics).

---

## 🪟 Window & App Lifecycle Hooks

Tauri configures a single window (`label: "main"`) sized 1200×800 with a minimum of 800×600. Key integration points:

- **Custom startup logic**: Extend `src-tauri/src/lib.rs::run()` with `.setup(|app| { ... })`. Use it to register global state, emit events, or perform migration work. The current setup uses it to strip dev icons.
- **Frontend listeners**: In React, import `@tauri-apps/api/window` to respond to desktop events. Example:
  ```ts
  import { appWindow } from '@tauri-apps/api/window';

  useEffect(() => {
    const unlisten = appWindow.listen('focus-changed', ({ payload }) => {
      console.log('Focus changed:', payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);
  ```
- **Single-instance protection**: Add `.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| { ... }))` inside `run()` when we need to guard against duplicate launches.
- **File watching / auto-updates**: Keep watchers in the web layer. For OS-level update flows, integrate `tauri-plugin-updater` and surface progress through events.

---

## 🔄 IPC & Command Patterns

Use `tauri::command` functions to bridge from TypeScript to Rust.

### Existing Surface
- `greet(name: &str) -> String` defined in `src-tauri/src/lib.rs`:
  ```rust
  #[tauri::command]
  fn greet(name: &str) -> String {
      format!("Hello, {}! You've been greeted from Rust!", name)
  }
  ```
- The command is registered via `.invoke_handler(tauri::generate_handler![greet])`.

### Invoking from React
```ts
import { invoke } from '@tauri-apps/api/tauri';

async function greetUser(name: string) {
  const message = await invoke<string>('greet', { name });
  console.log(message);
}
```

### Guidance for New Commands
1. Prefer web APIs first. Only add Rust commands when you need native resources (filesystem, clipboard, OS dialogs, performance-critical work).
2. Keep command signatures small and serializable (strings, numbers, booleans, structs deriving `Serialize`).
3. Centralize TS wrappers (e.g., `src/app/utils/tauri.ts`) so frontend usage stays typed.
4. Validate inputs defensively; Tauri commands run with app privileges.

---

## 🧩 Plugin Inventory & Policy

We currently enable:

- `tauri_plugin_shell` – limited shell access for opening files/URLs.
- `tauri_plugin_dialog` – native dialogs (open/save file, alert).
- `tauri_plugin_fs` – filesystem read/write.

**Recommendations**
- Scope filesystem permissions using capability files under `src-tauri/capabilities/`.
- When adding plugins, document the use case and security considerations in this guide.
- Disable plugins you do not actively use; each one widens the attack surface.

---

## 🔐 Security Checklist

- **CSP**: Defined in `tauri.conf.json > app.security.csp`. Update when contacting new domains (e.g., telemetry). Always include `'self'` and restrict inline scripts/styles.
- **Window decorations**: Ensure `transparent: false` unless you harden the backdrop; transparent windows can leak background content.
- **Always-on-top / shadow**: Only enable when feature requirements justify it.
- **Plugin Capabilities**: Configure capability JSON to restrict plugin scope (e.g., limit `fs` to specific directories).
- **Invoke guardrails**: Avoid `Command` functions that execute arbitrary shell commands unless validated.
- **Secrets**: Keep API keys in the Rust side when possible; use the secure storage plugin for user tokens.

Reference the broader [Security CSP Hardening guide](../guides/security-csp-hardening.md) for webview policies.

---

## 🛠️ Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Blank window in dev | Frontend dev server not running | Ensure `npm run dev` started (Tauri spawns it automatically). Check `beforeDevCommand` output. |
| `invoke` rejects with `command not found` | Command not registered | Add to `.invoke_handler(...)` and restart Tauri. |
| `tauri-plugin-fs` reads fail | Missing capability config | Create/update capability JSON under `src-tauri/capabilities/` and restart. |
| Assets stale after rebuild | Cached `dist/` | Delete `dist/` or run `npm run clean && npm run tauri dev`. |
| macOS build fails with signing errors | Missing signing identity | Configure `bundle.macOS.signingIdentity` or distribute unsigned builds (`tauri.conf.json`). |

---

## 📚 Further Reading

- [Tauri 1.x Guides](https://tauri.app/v1/guides/)
- [Tauri Plugin Directory](https://github.com/tauri-apps/plugins-workspace)
- [Canvas Performance Playbook](../performance/canvas.md) – tips for profiling the web layer before desktop builds.
- [Troubleshooting Guide](./troubleshooting.md)

---

## 🗺️ Next Steps

- Document concrete filesystem capability scopes once we finalize export/import flows.
- Evaluate `tauri-plugin-updater` for production auto-updates and capture findings here.
- Add an example of React ↔ Rust event messaging (`app.emit_all`, `Event.listen`) after we stabilize selection analytics.

> Have additions or corrections? Update this file and cross-link changes in the Canvas Hardening Plan (Workstream 7).
