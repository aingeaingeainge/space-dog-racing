import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyFurniture } from './lib/uiFurniture';
import './theme/tokens.css';
import './theme/app.css';

// Painted panel plates, rivets, ticket and slip paper, the signpost board and the wordmark, if
// any of them have been generated. Each one is a --art-* property app.css already prefers.
applyFurniture();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
