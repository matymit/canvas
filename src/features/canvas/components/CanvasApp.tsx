import React from 'react';
import CanvasToolbar from '../toolbar/CanvasToolbar';
import CanvasStage from './CanvasStage';
import TextEditorOverlay from './TextEditorOverlay';

export default function CanvasApp() {
  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CanvasToolbar />
      <div style={{ position: 'relative', flex: 1 }}>
        <CanvasStage />
        <TextEditorOverlay />
      </div>
    </div>
  );
}