import React from 'react';
import ReactDOM from 'react-dom/client';
import Canvas from './app/pages/Canvas';
import './index.css';
import './styles/figjam-theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Canvas />
  </React.StrictMode>
);