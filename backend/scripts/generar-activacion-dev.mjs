import { createClient } from '@supabase/supabase-js';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Este script no debe ejecutarse en producción.',
  );
}

const correo = process.argv[2]?.trim().toLowerCase();

if (!correo) {
  throw new Error(
    'Debes proporcionar el correo de una cuenta de prueba.',
  );
}

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error(
    'Faltan las variables de Supabase en el entorno.',
  );
}

const supabase = createClient(url, secret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Generar un token de acceso para una cuenta ya registrada.
// generateLink no envía correos.
const { data, error } =
  await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: correo,
  });

if (error || !data?.user) {
  throw new Error(
    `No se pudo generar el enlace: ${error?.message ?? 'Usuario no encontrado'}`,
  );
}

// Comprobar que sea una cuenta pendiente.
const { data: perfil, error: errorPerfil } =
  await supabase
    .from('usuarios')
    .select('activo, fecha_activacion, id_rol, id_sucursal')
    .eq('id_usuario', data.user.id)
    .maybeSingle();

if (errorPerfil) {
  throw new Error('No se pudo verificar el perfil.');
}

if (
  !perfil ||
  perfil.activo ||
  perfil.fecha_activacion ||
  !perfil.id_rol ||
  !perfil.id_sucursal
) {
  throw new Error(
    'La cuenta no está pendiente de activación o su perfil está incompleto.',
  );
}

const tokenHash = data.properties?.hashed_token;

if (!tokenHash) {
  throw new Error(
    'Supabase no devolvió el código de verificación.',
  );
}

console.log('\nCódigo de activación de desarrollo:');
console.log(tokenHash);
console.log('\nTipo de verificación: magiclink');
console.log(
  '\nEste código es confidencial y de un solo uso.',
);
