/** Spanish explanation for each error the Google Health connection can report. */
const MESSAGES: Record<string, string> = {
  not_configured:
    'La conexión con Google aún no está configurada en el servidor: Google no admite proyectos nuevos de su Health API por ahora. Mientras tanto, usa el check-in diario.',
  unauthorized: 'Tu sesión de Forja ha caducado. Vuelve a entrar e inténtalo de nuevo.',
  not_connected: 'No hay ninguna cuenta de Google conectada.',
  reauth_required:
    'Google ha caducado el permiso (en modo prueba dura 7 días). Pulsa «Conectar» otra vez.',
  account_not_linked:
    'Tu cuenta de Google no tiene perfil de Google Health. Abre la app Google Health, entra con «Continuar con Google» y vuelve a intentarlo.',
  access_denied: 'Cancelaste el permiso en Google. No se ha conectado nada.',
  missing_permissions:
    'No marcaste ningún permiso de Google Health. Vuelve a conectar y acepta los tres.',
  invalid_state: 'El enlace de conexión caducó (dura 10 minutos). Vuelve a empezar.',
  no_refresh_token:
    'Google no devolvió un permiso duradero. Revoca el acceso de Forja en tu cuenta de Google y vuelve a conectar.',
  health_api_error: 'La Google Health API ha devuelto un error. Prueba más tarde.',
  db_error: 'No se pudieron guardar los datos en Forja. Prueba más tarde.',
  internal_error: 'Algo falló al hablar con el servidor. Comprueba la conexión y prueba otra vez.',
}

export function healthErrorMessage(code: string): string {
  return (
    MESSAGES[code.toLowerCase()] ?? `No se pudo completar (${code}). Prueba otra vez más tarde.`
  )
}
