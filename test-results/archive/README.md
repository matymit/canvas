# Archived Test Artifacts

This directory holds legacy or non-MVP automated tests that are no longer executed as part of the hardening baseline. Each artifact includes an inline comment describing the reason for archival and any follow-up actions.

## Current entries

| File | Original Location | Reason Archived | Follow-up |
|------|-------------------|-----------------|-----------|
| `playwright/canvas-legacy.spec.ts` | `e2e/canvas.spec.ts` | Targeted deprecated selectors and dev server port; superseded by the MVP E2E suite under `src/test/mvp/e2e`. | Re-implement a modern smoke test once Playwright coverage stabilises. |
