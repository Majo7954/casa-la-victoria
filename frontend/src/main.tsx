
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AuthProvider } from './context/AuthProvider';
import { InicioConCarga } from './routes/InicioConCarga';

import App from './App';

import './index.css';

// ============================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================

createRoot(
  document.getElementById('root')!,
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <InicioConCarga>
          <App />
        </InicioConCarga>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);