import type { CanvasElement } from '../../../../types';

export interface TextElement extends CanvasElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
}

export default TextElement;