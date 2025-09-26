import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEventHandler, KeyboardEventHandler } from "react";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";

function measureTextWidth(
  text: string,
  font = "400 16px Inter, system-ui, sans-serif",
): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  const m = ctx.measureText(text);
  return Math.ceil(m.width);
}

function editorStyle(
  fontSize: number,
  pos: { x: number; y: number },
): (CSSProperties & { msAppearance?: string }) {
  return {
    position: "absolute",
    left: pos.x,
    top: pos.y,
    minWidth: 4,
    padding: 4,
    // Blue border to match selection frame
    outline: "none !important",
    border: "2px solid #4F46E5 !important",
    borderStyle: "solid !important",
    borderWidth: "2px !important",
    borderColor: "#4F46E5 !important",
    outlineStyle: "none !important",
    outlineWidth: "0 !important",
    outlineColor: "transparent !important",
    background: "transparent",
    color: "#111827",
    fontFamily: "Inter, system-ui, sans-serif",
    fontWeight: 400,
    fontSize: `${fontSize}px`,
    lineHeight: `${Math.round(fontSize * 1.2)}px`,
    pointerEvents: "auto",
    whiteSpace: "nowrap",
    // Enhanced caret visibility and browser compatibility
    caretColor: "#111827",
    WebkitTextFillColor: "#111827",
    WebkitAppearance: "none",
    MozAppearance: "none",
    msAppearance: "none",
    appearance: "none",
  };
}

export default function TextEditorOverlay() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fontSize] = useState(16);

  const elementApi = useUnifiedCanvasStore((s) => s.element);
  const beginBatch = useUnifiedCanvasStore((s) => s.beginBatch);
  const endBatch = useUnifiedCanvasStore((s) => s.endBatch);

  useEffect(() => {
    const onBegin = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      setPos(detail);
      setVisible(true);
      setTimeout(() => editorRef.current?.focus(), 0);
    };
    window.addEventListener("canvas:text-begin", onBegin);
    return () => window.removeEventListener("canvas:text-begin", onBegin);
  }, []);

  // Blue border styling to match selection frame
  useEffect(() => {
    let styleElement: HTMLStyleElement | null = null;

    if (visible && editorRef.current) {
      // Create unique selector using testid
      const selector = '[data-testid="text-portal-input"]';

      // Blue border styling to match selection frame (#4F46E5)
      const blueFrameCss = `
        ${selector},
        ${selector}:focus,
        ${selector}:active,
        ${selector}:hover,
        ${selector}:focus-visible,
        ${selector}:focus-within {
          border: 2px solid #4F46E5 !important;
          outline: none !important;
          box-shadow: none !important;
          border-style: solid !important;
          border-width: 2px !important;
          border-color: #4F46E5 !important;
          outline-style: none !important;
          outline-width: 0 !important;
          outline-color: transparent !important;
          outline-offset: 0 !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
        }

        /* Additional browser-specific overrides */
        ${selector}[contenteditable]:focus {
          border: 2px solid #4F46E5 !important;
          outline: none !important;
          box-shadow: none !important;
        }
      `;

      // Create and inject stylesheet
      styleElement = document.createElement('style');
      styleElement.setAttribute('data-text-editor-fix', 'true');
      styleElement.textContent = blueFrameCss;
      document.head.appendChild(styleElement);

      // Apply additional inline style overrides as backup
      const editor = editorRef.current;
      editor.style.setProperty('border', '2px solid #4F46E5', 'important');
      editor.style.setProperty('outline', 'none', 'important');
      editor.style.setProperty('box-shadow', 'none', 'important');
      editor.style.setProperty('border-style', 'solid', 'important');
      editor.style.setProperty('border-color', '#4F46E5', 'important');
    }

    return () => {
      // Cleanup: remove dynamic stylesheet when component unmounts or becomes invisible
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [visible]);

  const commit = () => {
    const text = editorRef.current?.textContent ?? "";
    const font = `400 ${fontSize}px Inter, system-ui, sans-serif`;
    // Height fixed to line-height ≈ fontSize * 1.2 (approximation)
    const lineHeight = Math.round(fontSize * 1.2);
    const width = Math.max(4, measureTextWidth(text, font));

    beginBatch?.("Insert text");
    elementApi.upsert({
      id: crypto.randomUUID(),
      type: "text",
      x: pos.x + 2, // Account for 2px border only (padding is in Konva.Text)
      y: pos.y + 2, // Account for 2px border only
      width,
      height: lineHeight,
      text,
      style: {
        fontSize,
        fontFamily: "Inter, system-ui, sans-serif",
      },
    });
    endBatch?.();

    setVisible(false);
    if (editorRef.current) editorRef.current.textContent = "";
  };

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setVisible(false);
    }
  };

  const onInput: FormEventHandler<HTMLDivElement> = (e) => {
    const text = (e.target as HTMLDivElement).textContent ?? "";
    const font = `400 ${fontSize}px Inter, system-ui, sans-serif`;
    const width = Math.max(4, measureTextWidth(text, font));
    if (editorRef.current) {
      editorRef.current.style.width = `${width}px`;
      editorRef.current.style.height = `${Math.round(fontSize * 1.2)}px`;
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Text editor"
        data-testid="text-portal-input"
        onKeyDown={onKeyDown}
        onInput={onInput}
        style={editorStyle(fontSize, pos)}
      />
    </div>
  );
}
