
import type { ReactNode } from 'react';

import { useAuth } from '../context/useAuth';

// ============================================================
// MOSTRAR CARGA MIENTRAS SE RESTAURA LA SESIÓN
// ============================================================

export function InicioConCarga({
  children,
}: {
  children: ReactNode;
}) {
  const { inicializando } = useAuth();

  if (inicializando) {
    return (
      <main
        role="status"
        aria-live="polite"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        Verificando sesión...
      </main>
    );
  }

  return <>{children}</>;
}