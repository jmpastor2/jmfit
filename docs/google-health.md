# Google Health API (Fitbit Air) en Forja

Forja lee los datos de la pulsera **Google Fitbit Air** a través de la **Google Health API v4**,
la sustituta de la Fitbit Web API (soporte terminado el 30-09-2026, apagado el 30-10-2026).
Documentación oficial: <https://developers.google.com/health>.

> **Aviso importante (verificado en la documentación el 07-10-2026):** Google indica en todas
> las páginas de la API que *"no está incorporando proyectos nuevos por ahora"* y que ampliará
> el acceso más adelante. Es posible que, aunque sigas los pasos, la API no se pueda habilitar
> o que las llamadas fallen en un proyecto nuevo. Si te pasa, no es un fallo de Forja: hay que
> esperar a que Google abra el acceso (o pedirlo en <https://developers.google.com/health/support>).

## Cómo funciona

- El navegador nunca ve el *client secret* ni el *refresh token*. Todo pasa por la Edge
  Function `google-health` de Supabase.
- Ajustes → Salud → «Conectar Google Health» pide a la función la URL de consentimiento de
  Google; tras aceptar, Google vuelve a la función (`?action=callback`), que guarda los tokens,
  descarga los últimos 30 días y te devuelve a `#/settings/health?connected=1`.
- Después se sincronizan los últimos 7 días al pulsar «Sincronizar» o cada 6 h por cron.
- Datos que se guardan por día (`health_daily`): sueño total y fases (profundo, REM, ligero,
  despierto), FC en reposo, HRV (RMSSD), pasos, calorías activas, VO2 máx, peso y % de grasa
  (estos dos solo si tienes báscula Aria o los registras en la app). Sesiones de ejercicio en
  `health_workouts` (tipo, inicio, duración activa, FC media, kcal y distancia).
- Permisos que se piden (solo lectura):
  - `googlehealth.activity_and_fitness.readonly` → pasos, calorías activas, VO2 máx, ejercicios
  - `googlehealth.health_metrics_and_measurements.readonly` → FC en reposo, HRV, peso, grasa
  - `googlehealth.sleep.readonly` → sueño

## Requisito previo en el móvil

Tu cuenta de Google tiene que estar **vinculada a Google Health**: abre la app Google Health
(antes Fitbit) e inicia sesión con «Continuar con Google». Si aún usas una cuenta Fitbit
antigua, migra la cuenta a Google primero
(<https://support.google.com/fitbit/answer/14237024>). Si no, la conexión fallará con
`error=account_not_linked`.

## Pasos (los haces tú)

### 1. Proyecto en Google Cloud

1. Entra en <https://console.cloud.google.com/> con tu cuenta de Google.
2. Arriba, selector de proyectos → **Nuevo proyecto** → nombre `forja-health` → **Crear**.
   Asegúrate de que queda seleccionado.

### 2. Habilitar la API

1. **APIs y servicios → Biblioteca**.
2. Busca **Google Health API** (`health.googleapis.com`) → **Habilitar**.

### 3. Pantalla de consentimiento (Google Auth Platform)

1. **APIs y servicios → Pantalla de consentimiento de OAuth** (o «Google Auth Platform»).
   Si te lo pide, **Comenzar**: nombre de la app `Forja`, correo de asistencia = tu correo.
2. **Público (Audience)**: tipo de usuario **Externo**; estado de publicación **Prueba (Testing)**.
3. En **Usuarios de prueba** → **+ Añadir usuarios** → tu correo de Google (el de la app Google
   Health) → **Guardar**.
4. **Acceso a datos (Data Access)** → **Añadir o quitar permisos** → busca «Google Health API»
   y marca exactamente estos tres:
   - `.../auth/googlehealth.activity_and_fitness.readonly`
   - `.../auth/googlehealth.health_metrics_and_measurements.readonly`
   - `.../auth/googlehealth.sleep.readonly`

   → **Actualizar** → **Guardar**.

### 4. Cliente OAuth (aplicación web)

1. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**. Nombre: `Forja Supabase`.
3. **URIs de redireccionamiento autorizados** → añade exactamente (sin barra final, con la
   query incluida):

   ```
   https://jzhltzafdqipeortwdra.supabase.co/functions/v1/google-health?action=callback
   ```

4. **Crear**. Copia el **ID de cliente** y el **Secreto de cliente**.

### 5. Secretos de la Edge Function

Genera dos secretos aleatorios (por ejemplo con
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, uno para
`STATE_SECRET` y otro para `CRON_SECRET`) y ejecuta en la carpeta del proyecto:

```bash
npx supabase secrets set --project-ref jzhltzafdqipeortwdra \
  GOOGLE_CLIENT_ID="<id de cliente>.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="<secreto de cliente>" \
  STATE_SECRET="<aleatorio 1>" \
  CRON_SECRET="<aleatorio 2>" \
  APP_URL="https://jmpastor2.github.io/jmfit/"
```

Opcionales: `HEALTH_TZ` (zona horaria para decidir qué es «hoy», por defecto `Europe/Madrid`)
y `GOOGLE_REDIRECT_URI` (solo si cambias la URI del paso 4). `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` ya los inyecta Supabase.

Para probar en local (`http://localhost:5173`), pon temporalmente
`APP_URL="http://localhost:5173/"`: la redirección final irá a tu Vite local.

### 6. Tablas

Ejecuta `supabase/sql/google_health.sql` (SQL Editor del panel o integrado en una migración).

### 7. Desplegar la función

```bash
npx supabase functions deploy google-health --project-ref jzhltzafdqipeortwdra --no-verify-jwt
```

`--no-verify-jwt` es necesario porque la vuelta desde Google no lleva JWT de Supabase; la
función comprueba ella misma el JWT en `start`, `sync` y `disconnect`, y el `CRON_SECRET` en el
cron.

### 8. Sincronización automática (opcional)

Activa las extensiones **pg_cron** y **pg_net**, guarda el `CRON_SECRET` en Vault y programa el
job comentado al final de `supabase/sql/google_health.sql` (cada 6 h).

### 9. Conectar

En Forja: Ajustes → Salud → **Conectar Google Health** → elige tu cuenta → acepta los tres
permisos. Google mostrará el aviso de «app no verificada»: es normal para un proyecto propio
en modo prueba; pulsa «Continuar».

## Limitaciones (según la documentación oficial)

- **Acceso a la API restringido**: Google no está dando de alta proyectos nuevos de momento
  (ver aviso al principio).
- **Tokens en modo prueba caducan a los 7 días.** Con la pantalla de consentimiento en
  «Testing», el refresh token es temporal y expira a los 7 días
  (<https://developers.google.com/health/setup>, sección «Token behavior during testing»).
  Cuando caduque, Forja marcará la conexión como `reauth_required` y tendrás que volver a pulsar
  «Conectar». En «In production» los refresh tokens no caducan salvo revocación o 6 meses sin uso.
- **Verificación**: casi todos los permisos de Google Health son *restringidos*. Sin
  verificación la app queda limitada a 100 usuarios (suficiente para uso personal). Publicarla
  para más usuarios exige la verificación OAuth de Google y una auditoría de seguridad anual
  CASA de un tercero (2–6 semanas, 500–4.500 USD según la doc)
  (<https://developers.google.com/health/app-verification>).
  *Sin confirmar en la doc:* si un proyecto personal puede pasar a «In production» sin
  verificación para evitar la caducidad de 7 días con permisos restringidos. La doc solo dice
  que los clientes sin verificar tienen tope de 100 usuarios «tanto en prueba como en
  producción».
- **Frecuencia de datos**: la pulsera sincroniza con la app Google Health (cada ~15 min con la
  app abierta o en segundo plano con Bluetooth). Lo que no haya llegado a la app no está en la
  API.
- **Límites de uso**: 300 peticiones/minuto por usuario; una sincronización usa ~10.
- **Sin FC máxima por sesión**: el resumen de ejercicio de la API (`metricsSummary`) no trae FC
  máxima; `max_hr` queda vacío. Se podría calcular leyendo `heart-rate` en el intervalo de cada
  sesión (no implementado).
- **Calorías activas** = `active-energy-burned` (sin metabolismo basal), no las calorías totales.
- **Sueño**: se guarda la sesión principal de cada noche (la marcada como principal, o la más
  larga), asignada al día en que te despiertas. Las siestas no se suman.
- **Peso y % grasa** solo aparecen si hay báscula Aria o registros manuales en Google Health.

## Errores que puede devolver la conexión (`#/settings/health?error=…`)

| Código | Significado |
| --- | --- |
| `access_denied` | Cancelaste el consentimiento en Google. |
| `account_not_linked` | Tu cuenta de Google no tiene perfil de Google Health (ver requisito previo). |
| `missing_permissions` | No marcaste ningún permiso de Google Health. |
| `invalid_state` | El enlace caducó (10 min) o fue manipulado. Vuelve a empezar. |
| `no_refresh_token` | Google no devolvió refresh token. Revoca el acceso y reconecta. |
| `not_configured` | Faltan los secretos de Google en la función. |
| `connected=1&sync=failed` | Conectado, pero la primera descarga falló; pulsa «Sincronizar». |
