import React from 'react';
import ReactDOM from 'react-dom/client';
import Canvas from './app/pages/Canvas';
import { installStoreBridge } from './app/bootstrap/storeBridge';
import './index.css';
import './styles/figjam-theme.css';

// Install store bridge for non-React modules
installStoreBridge();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Canvas />
  </React.StrictMode>
);