
import { useState } from 'react';

import { Button } from './components/ui/Button/Button';
import { InputField } from './components/ui/InputField/InputField';

import './App.css';

function App() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarError, setMostrarError] = useState(false);

  function manejarPrueba() {
    if (!correo || !contrasena) {
      setMostrarError(true);
      return;
    }

    setMostrarError(false);

    alert('¡Componentes funcionando correctamente!');
  }

  return (
    <main className="demo-page">
      <section className="demo-card">
        <div className="demo-heading">
          <p className="demo-eyebrow">
            Sistema de diseño
          </p>

          <h1>Casa La Victoria</h1>

          <p>
            Primera prueba de componentes reutilizables
            con React y TypeScript.
          </p>
        </div>

        <div className="demo-form">
          <InputField
            id="correo"
            name="correo"
            label="Correo electrónico"
            type="email"
            placeholder="usuario@correo.com"
            autoComplete="email"
            value={correo}
            onChange={(event) =>
              setCorreo(event.target.value)
            }
            error={
              mostrarError && !correo
                ? 'Ingresa tu correo electrónico.'
                : undefined
            }
          />

          <InputField
            id="contrasena"
            name="contrasena"
            label="Contraseña"
            type="password"
            placeholder="Ingresa tu contraseña"
            autoComplete="current-password"
            value={contrasena}
            onChange={(event) =>
              setContrasena(event.target.value)
            }
            error={
              mostrarError && !contrasena
                ? 'Ingresa tu contraseña.'
                : undefined
            }
          />

          <Button
            fullWidth
            onClick={manejarPrueba}
          >
            Probar componentes
          </Button>
        </div>

        <div className="demo-actions">
          <h2>Variantes de botones</h2>

          <div className="demo-buttons">
            <Button variant="primary">
              Guardar usuario
            </Button>

            <Button variant="secondary">
              Confirmar
            </Button>

            <Button variant="outline">
              Cancelar
            </Button>

            <Button variant="danger">
              Desactivar cuenta
            </Button>

            <Button disabled>
              Deshabilitado
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
