# Estado (2026-10-08)

Forja 1.0 sustituye a JM Fit v3 (la app vieja queda en el historial de git; su esquema en `legacy/`).

## Hecho

- Migraciones aplicadas en Supabase (`jzhltzafdqipeortwdra`): forja, workout_plan, google_health,
  manual_recovery. Las 18 series del 1 sep 2026 se copiaron al modelo nuevo; los ceros falsos de
  los escáneres pasaron a null; el perfil heredó 5 días/semana e hipertrofia.
- App completa: Hoy, Entrenar, sesión guiada, resumen, programas y editor, progreso, ejercicio,
  biblioteca, objetivos, cuerpo (Boditrax + recuperación), gimnasio con QR, ajustes, pulsera.
- 262 tests; build de producción limpio; revisado en el laboratorio con los datos reales.

- 2026-10-08: Evolución (/evolution: resumen por periodo, línea de tiempo mensual con hitos, mapa de
  constancia de 26 semanas, comparador de meses) y 31 ejercicios novedosos con `trend` (lat pull-around,
  Y-raise en polea, curl bayesiano, JM press, Kelso shrug, sentadilla péndulo, nórdico inverso…), sección
  «Novedades» en la Biblioteca; 152 ejercicios, 221 vídeos verificados; vídeos con segundo de inicio.
- Descartado por el usuario: análisis de comida por foto con IA.

- 2026-10-08 (paquete de mejoras): aviso push al acabar el descanso con el móvil bloqueado
  (tablas `push_subscriptions`/`rest_alarms`, pg_cron cada 5 s → Edge Function `rest-alarms`
  desplegada; secretos VAPID en `supabase/.env.rest.local`, git-ignorado; se activa en Ajustes →
  Descanso o desde el panel de descanso, en iPhone desde la app instalada), la serie siguiente
  queda a la vista sobre el panel, plancha y similares por tiempo con cronómetro, superserie sin
  descanso entre parejas, historial que sobrevive a ediciones del programa (`train/dayMatch.ts`),
  pasos del check-in en el día de ayer, y fuerza separada: 1RM solo en peso libre; máquinas y
  poleas con su mejor serie.

- 2026-10-13: acceso con aprobación (migración `20261013000000_access_approval.sql`, aplicada). En la
  entrada, «Solicitar acceso» crea una cuenta pendiente; la base de datos no le deja leer ni escribir
  nada (política restrictiva `approved_only` en cada tabla de `public`: una tabla nueva necesita volver a
  ejecutar la migración). Pantalla «Solicitud enviada»; Más → Accesos (solo admin) para aprobar, rechazar
  o quitar el acceso; cada solicitud avisa por ntfy.sh (secreto de Vault `access_ntfy_topic`). Admins a
  mano en `public.access.is_admin`. Solo queda la cuenta del usuario; la de prueba, sin acceso.

- 2026-10-20: **Orbe** (asistente de casa en jmpserver) lee un resumen de entrenamiento con la función
  `public.orbe_summary(p_key, p_days)` (migración `20261020000000_orbe_summary.sql`, aplicada): solo cifras
  agregadas (sesiones, volumen, mejores marcas estimadas, medias de salud y check-ins), nunca series sueltas
  ni notas. Exige la clave de Orbe; en Vault solo están su SHA-256 (`orbe_key_sha256`) y el usuario
  (`orbe_user_id`). La clave vive en `/srv/apps/orbe/.env` del servidor.

- 2026-10-18 (revisión del uso real: 5 sesiones en 8 días): los cambios de ejercicio se pueden
  guardar en el programa (aviso al cambiar y sección «Cambios respecto al programa» en el resumen);
  «Registrar las que quedan» de un toque (copia la última serie o el objetivo de cada serie); al
  terminar, «Sin registrar» con «Lo hice» por ejercicio; «¿Cómo llegas hoy?» al empezar (energía y
  sueño → preparación); peso corporal solo si se escribe (antes se arrastraba el último) y bloque de
  tendencia de peso en Cuerpo; avisos de la semana en Hoy (músculos por detrás del plan, ejercicios
  saltados, primer objetivo con cifra y fecha); corregido: al guardar la sesión se volvía a Hoy en vez
  de ir al resumen.

## Pendiente

1. Publicar: GitHub → Settings → Pages → Source: **GitHub Actions** (una vez), y push a `main`.
2. Google Health API: Google no admite proyectos nuevos (oct 2026). La función
   `supabase/functions/google-health` está escrita pero sin desplegar; seguir `docs/google-health.md`
   cuando abran el acceso (al desplegarla, que compruebe que la cuenta está aprobada en `public.access`:
   usa la service role y se salta el candado). Mientras tanto, check-in diario con los números de la app
   Google Health.
3. Probar la importación CSV con un export real de Boditrax.
4. Revisar los vídeos de canales pequeños (Sergio Tejeda, Zonapablo, Galvistrainer).
