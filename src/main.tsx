import React from 'react';
import ReactDOM from 'react-dom/client';
import Canvas from './app/pages/Canvas';
import { installStoreBridge } from './app/bootstrap/storeBridge';
import './index.css';
import './styles/figjam-theme.css';

// Install store bridge for non-React modules
installStoreBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Canvas />
  </React.StrictMode>
);