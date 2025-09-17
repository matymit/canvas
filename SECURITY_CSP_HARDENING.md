# CSP Security Hardening

## Current Implementation Status

### ✅ Completed (Immediate Hardening)
- **Script-src hardened**: Removed `'unsafe-inline'` from script-src
- **Rationale**: Tauri uses nonces/hashes for local scripts, making blanket `'unsafe-inline'` unnecessary and unsafe
- **Impact**: Prevents execution of arbitrary inline JavaScript while preserving Tauri's hashed/nonce'd code

### 🔄 Deferred (Requires Migration)
- **Style-src remains permissive**: Kept `'unsafe-inline'` in style-src temporarily
- **Rationale**: Extensive use of inline styles throughout the React application would break if removed immediately
- **Evidence**: 50+ files use inline styles including:
  - Direct `element.style.cursor` modifications (NonReactCanvasStage, ToolManager)
  - React `style={{...}}` props (Canvas.tsx, CanvasToolbar.tsx, UI components)
  - Dynamic styling in tools (StickyNoteTool, TextEditorOverlay)
  - Cursor management utilities

## Current CSP Policy

```json
"csp": "default-src 'self'; connect-src 'self' https://api.canvas.app; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
```

### Policy Breakdown
- `default-src 'self'`: Only load resources from same origin
- `connect-src 'self' https://api.canvas.app`: Allow API connections
- `script-src 'self'`: **HARDENED** - Only hashed/nonce'd scripts, no inline JS
- `style-src 'self' 'unsafe-inline'`: **TEMPORARY** - Allow inline styles until migration
- `img-src 'self' data: blob:`: Images from same origin, data URLs, and blobs
- `font-src 'self'`: Fonts from same origin only
- `object-src 'none'`: No plugins/objects
- `frame-ancestors 'none'`: Prevent framing (clickjacking protection)

## Future Style Hardening Roadmap

### Phase 1: Audit and Categorize
- [ ] Identify all inline style usage patterns
- [ ] Categorize by type (static vs dynamic, critical vs cosmetic)
- [ ] Create replacement strategy for each category

### Phase 2: CSS-in-JS Migration
- [ ] Replace React `style` props with CSS classes
- [ ] Implement CSS-in-JS solution with nonce support (if needed)
- [ ] Convert dynamic styling to className-based approaches

### Phase 3: DOM Styling Migration  
- [ ] Replace `element.style.*` with CSS custom properties
- [ ] Use CSS classes for cursor changes
- [ ] Implement data attributes + CSS for state-based styling

### Phase 4: CSP Finalization
- [ ] Remove `'unsafe-inline'` from style-src
- [ ] Add nonces/hashes if CSS-in-JS is used
- [ ] Test thoroughly across all tools and components

### Target CSP (Post-Migration)
```json
"csp": "default-src 'self'; connect-src 'self' https://api.canvas.app; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
```

## Implementation Notes

### Files Using Inline Styles (Major)
- `src/app/pages/Canvas.tsx`: Layout and positioning styles
- `src/features/canvas/toolbar/CanvasToolbar.tsx`: Extensive UI styling
- `src/features/canvas/components/NonReactCanvasStage.tsx`: Cursor management
- `src/features/canvas/components/tools/creation/StickyNoteTool.tsx`: Dynamic textarea styling
- `src/features/canvas/components/TextEditorOverlay.tsx`: Absolute positioning
- `src/features/canvas/utils/performance/cursorManager.ts`: Cursor utilities

### Testing Strategy
- [ ] Automated tests for CSP compliance
- [ ] Visual regression tests after style migration
- [ ] Performance testing of CSS-based approaches vs inline styles
- [ ] Cross-browser compatibility validation

## Security Benefits Achieved

### ✅ Immediate Protection
- **Script injection prevention**: No arbitrary inline JavaScript execution
- **XSS mitigation**: Stricter script execution policies
- **Tauri alignment**: Follows Tauri security best practices

### 🎯 Future Protection (Post-Migration)
- **Complete CSP compliance**: No unsafe directives
- **Style injection prevention**: Prevents CSS-based attacks
- **Production-ready security**: Meets enterprise security standards

## References
- [Tauri CSP Guide](https://v2.tauri.app/security/csp/)
- [Tauri Security Best Practices](https://v2.tauri.app/security/)
- [CSP Level 3 Specification](https://www.w3.org/TR/CSP3/)
- [OWASP CSP Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)

---

*Last Updated: January 17, 2025*  
*Status: Phase 1 Complete (Script Hardening) - Phase 2 Pending (Style Migration)*