import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import './index.css';
import App from './App.jsx';

// Three.js Clock deprecation handler:
// @react-three/fiber internally instantiates clock: new THREE.Clock().
// Three.js r183+ logs a deprecation warning recommending THREE.Timer.
// Intercept that specific warning cleanly via Three.js's official setConsoleFunction API.
if (typeof THREE.setConsoleFunction === 'function') {
  THREE.setConsoleFunction((type, message, ...params) => {
    if (typeof message === 'string' && message.includes('Clock: This module has been deprecated')) {
      return;
    }
    console[type](message, ...params);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
