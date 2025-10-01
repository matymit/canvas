// Image element type definition for serializable canvas elements
export type ElementId = string;

export interface ImageElement {
  id: ElementId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src?: string; // data URL (recommended for portability) or a trusted file path
  naturalWidth: number;
  naturalHeight: number;
  keepAspectRatio?: boolean; // default true for images
  rotation?: number;
  opacity?: number;
  name?: string;
  idbKey?: string; // IndexedDB key for locally cached assets
}

export default ImageElement;