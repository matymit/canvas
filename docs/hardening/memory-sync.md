# MCP Memory Graph Synchronization

_Last touch: 2025-10-02_

## Purpose
Create a repeatable process to keep the MCP memory graph aligned with the canonical in-repo documentation (hardening plan, refactor roadmaps, fix logs, etc.). Every active memory node should either reference a live document or be retired when the underlying work is complete.

## Workflow Checklist
1. Export the current Canvas namespace from the MCP memory graph (JSON or CSV export preferred).
2. For each node, locate the authoritative in-repo source (e.g., `docs/canvas-hardening-plan.md`, `refactoring-plans/*.md`, `docs/fixes/*.md`).
3. Decide whether to **Keep**, **Update**, or **Archive** the node:
   - **Keep**: Node mirrors the latest repo content—note the doc revision/date for traceability.
   - **Update**: Node exists but holds stale info—record the changes needed and update the graph once edits land.
   - **Archive**: Node covers deprecated work—capture rationale, then remove or mark inactive in MCP.
4. Create or update nodes for any new documents produced during the hardening push.
5. Record the outcome in this file for future audits.

### Export Procedure (Template)
- Open the MCP memory graph dashboard and filter to the Canvas namespace.
- Capture an export (JSON preferred) and save it to `docs/hardening/exports/<YYYY-MM-DD>-mcp-canvas.json`.
- Note the export filename, timestamp, and checksum (e.g., `sha256sum`) in the Change Log below.
- If the dashboard lacks export functionality, manually copy node details into the table and include a screenshot reference in the Change Log.

### Update Procedure
- For any node marked **Update** in the inventory, summarize the delta in the Change Log (see template) before making edits in MCP.
- After updating MCP, refresh the `Last Synced` column with today’s date and jot a short summary (e.g., “linked to docs/legacy/claude-agent-guide.md”).
- If a node is archived, ensure dependent tasks/docs are updated to avoid references to deleted content.

## Node Inventory Snapshot (2025-10-02)

Latest MCP read: synchronized at 2025-10-02 via `memory-read-graph` (no JSON export saved yet).

| Node ID | Node / Topic | Source Document(s) | Last Synced | Action | Notes |
|---------|--------------|--------------------|-------------|--------|-------|
| `Canvas FigJam Whiteboard Project` | Program Status | `docs/canvas-hardening-plan.md`, `docs/known-issues.md` | 2025-10-02 | Update ✅ | Added observation referencing Part 4–5 repo hygiene + MCP sync progress. |
| `Canvas Architecture` | Architecture Principles | `docs/architecture/README.md`, `docs/performance/canvas.md` | 2025-10-02 | Review ✅ | Logged new observation pointing to RafBatcher instrumentation guidance. |
| `Canvas Hardening Plan` | Hardening Roadmap | `docs/canvas-hardening-plan.md` | 2025-10-02 | Create ✅ | New MCP entity created summarizing nine workstreams and status checkpoints. |
| `Repository Hygiene Backlog` | Repo Cleanup Work | `docs/legacy/README.md`, `docs/fixes/drag-bug-fix.md`, `docs/legacy/marquee-handoff.md` | 2025-10-02 | Create ✅ | New MCP entity created capturing completed migrations and backlog status. |
| `Refactoring Plans Index` | Refactor Portfolio | `refactoring-plans/README.md`, `refactoring-plans/LARGE_FILE_REFACTORING_MASTER_PLAN.md` | 2025-10-02 | Create ✅ | New MCP entity created referencing consolidated roadmap index. |
| `Agent Guidance Docs` | Assistant Workflow | `docs/guides/agents.md`, `docs/legacy/claude-agent-guide.md` | 2025-10-02 | Update ✅ | Added observation to Consolidated Canvas Workflow and created dedicated guide entity. |
| `Performance & Memory Audit Playbook` | Perf Playbooks | `docs/performance/canvas.md` | 2025-10-02 | Create ✅ | New MCP entity created referencing performance scenarios and instrumentation. |
| `MarqueeSelectionTool Drag Architecture` | Marquee Live Drag Suite | `docs/fixes/marquee-live-drag-sync.md`, `docs/legacy/marquee-handoff.md` | 2025-10-02 | Keep ✅ | Added observation linking to live drag fix doc and legacy investigation archive. |

## Actions in this Session
- Created the hardening documentation space (`docs/hardening/`) with an index for future stabilization logs.
- Authored this synchronization playbook outlining the review workflow and current node inventory.
- Identified new documentation that requires MCP node creation or updates (refactoring plans index, relocated fix logs, agent guide consolidation).

## Follow-Up Tasks
- [ ] Export current MCP Canvas namespace and populate the `Node ID` and `Last Synced` columns.
- [ ] Push updates/archives back into the MCP graph once repo links are verified.
- [ ] Schedule recurring reviews (weekly during hardening) to keep this inventory fresh.
- [ ] Capture before/after snapshots (export hash or timestamp) in this document for auditability.

## Change Log Template

Document every sync run in reverse chronological order.

| Date | Export File | Hash / Verification | Summary |
|------|-------------|---------------------|---------|
| 2025-10-02 | `memory-read-graph` (inline) | _n/a_ | Pulled live MCP Canvas namespace; populated node inventory table with keep/update/create actions. |
| _(next)_ | _(pending)_ | _(pending)_ | _(pending)_ |
