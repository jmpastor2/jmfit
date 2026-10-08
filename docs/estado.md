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

## Pendiente

1. Publicar: GitHub → Settings → Pages → Source: **GitHub Actions** (una vez), y push a `main`.
2. Google Health API: Google no admite proyectos nuevos (oct 2026). La función
   `supabase/functions/google-health` está escrita pero sin desplegar; seguir `docs/google-health.md`
   cuando abran el acceso. Mientras tanto, check-in diario con los números de la app Google Health.
3. Probar la importación CSV con un export real de Boditrax.
4. Revisar los vídeos de canales pequeños (Sergio Tejeda, Zonapablo, Galvistrainer).
5. Cuentas de Andrés y julian: el usuario decide borrarlas (SQL en el mensaje de entrega).
