// Utility helpers for applying vendor-specific CSS properties without resorting to `any`.

export type VendorStyleDeclaration = CSSStyleDeclaration & {
  webkitTextFillColor?: string;
  webkitAppearance?: string;
  mozAppearance?: string;
  msAppearance?: string;
  textFillColor?: string;
  MozTextFillColor?: string;
  webkitTextStroke?: string;
};

export function applyVendorAppearanceReset(style: CSSStyleDeclaration): void {
  const vendorStyle = style as VendorStyleDeclaration;
  vendorStyle.webkitAppearance = "none";
  vendorStyle.mozAppearance = "none";
  vendorStyle.msAppearance = "none";
}

export function applyVendorTextFillColor(
  style: CSSStyleDeclaration,
  color: string,
): void {
  const vendorStyle = style as VendorStyleDeclaration;
  vendorStyle.webkitTextFillColor = color;
  vendorStyle.textFillColor = color;
  vendorStyle.MozTextFillColor = color;
}

export function applyVendorTextStrokeReset(style: CSSStyleDeclaration): void {
  const vendorStyle = style as VendorStyleDeclaration;
  vendorStyle.webkitTextStroke = "initial";
}
