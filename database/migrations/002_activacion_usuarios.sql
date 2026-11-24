
-- ============================================================
-- CASA LA VICTORIA
-- MIGRACIÓN 002: CONTROL DE ACTIVACIÓN DE CUENTAS
-- Ejecutar sobre la base de datos existente
-- ============================================================

BEGIN;

-- 1. Agregar la fecha de primera activación.
-- NULL significa que aún no se ha completado
-- la activación inicial del usuario.

ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS fecha_activacion TIMESTAMPTZ;


-- 2. Compatibilidad con usuarios previamente activos.
-- Si ya existen usuarios habilitados, se conserva su
-- estado y se registra la fecha de esta migración
-- como referencia de activación.

UPDATE public.usuarios
SET fecha_activacion = NOW()
WHERE activo = TRUE
  AND fecha_activacion IS NULL;


-- 3. Impedir que una cuenta esté activa sin haber
-- completado su activación inicial.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_usuario_activacion'
          AND conrelid = 'public.usuarios'::regclass
    ) THEN
        ALTER TABLE public.usuarios
        ADD CONSTRAINT chk_usuario_activacion
        CHECK (
            activo = FALSE
            OR fecha_activacion IS NOT NULL
        );
    END IF;
END;
$$;


-- 4. Documentar el propósito del atributo.

COMMENT ON COLUMN public.usuarios.fecha_activacion IS
'Fecha de primera activación de la cuenta. NULL indica que la activación inicial no ha sido completada.';


COMMIT;
