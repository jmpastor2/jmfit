# Estado (2026-10-30)

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

- 2026-10-22 (escrituras fiables): todas las escrituras van por una sola cola (`scope` común, una a
  una y en orden, también al reanudar tras cerrar la app); un fallo de red se reintenta con espera
  creciente durante mucho tiempo y un error real de la base de datos (con `code`) para al momento,
  avisa y vuelve a leer del servidor, así que nada se muestra como guardado sin estarlo. La sesión
  no espera a la red para seguir (serie, cambio de ejercicio, quitar); al terminar sin conexión
  avisa de que se guardará al volver y, si el servidor la rechaza, ofrece «Reintentar». Borrar
  escáner y archivar objetivo ya pasan por la cola. Días por fecha local (no UTC) en peso corporal
  y objetivos; zoom permitido y campos a 16 px (iOS no amplía al escribir); Inter solo latin y
  latin-ext; el manifiesto admite horizontal.

- 2026-10-30 (fluidez en la sesión): la serie marcada ya no «vuelve atrás». Una lectura del servidor
  que llegaba con una escritura aún en cola pisaba la serie recién hecha, y en el entreno libre del
  28 oct quedaron series duplicadas. Ahora las lecturas de series, sesiones, programas y check-ins
  aplican encima las escrituras pendientes (`readWithPending`). El desplazamiento tras cada serie
  solo baja lo justo, y suave. Al abrir otra tarjeta, la tocada no se mueve (iOS no tiene scroll
  anchoring). En el entreno libre la tarjeta no se cierra al acabar sus series. Un doble toque en
  «Serie hecha» ya no marca dos. El descanso solo repinta su panel, una vez por segundo (antes
  repintaba la sesión entera cuatro veces por segundo). Al salir de la app y volver (también desde
  la notificación) vuelve el ejercicio abierto con los valores escritos (`session/sessionUi.ts`).
  La notificación ya no reinicia la pantalla si ya estás en ella, y una actualización pendiente no
  recarga la app en segundo plano durante la sesión. Miniaturas del vídeo en el buscador de
  ejercicios y en la Biblioteca: al tocarlas se abre una vista previa en la propia lista (vídeo y
  claves) sin elegir ni entrar. Las miniaturas quedan en caché para el gimnasio sin señal. En
  Técnica, el selector de vídeo es Español/Inglés.

- 2026-10-30 (paneles): Hoy solo pinta barra para los músculos que aún se pueden recuperar esta
  semana; los que ya no, en una línea. Sin check-in, «Preparación» es una línea con el botón. Las
  sesiones que faltan dicen cuántos días quedan. En Progreso, con menos de 8 semanas de historial,
  la comparación es con la primera sesión («desde 12 oct») en vez de «sin dato de hace 8 sem». En
  Cuerpo se quita la media de 7 días cuando no hay pesos esa semana. En Entrenar, el día que toca
  lleva la marca «Toca» y el botón en dorado. Datos: borradas 3 series duplicadas por el fallo de
  la serie que volvía atrás (press banca 35×5, press de pecho en máquina 60×6 y elevación lateral
  por detrás 5×10); se dejó la de más peso o, a igual peso, la escrita a mano.

- 2026-10-30 (KPIs): resumen de sesión con «Ejercicio a ejercicio» (mejor serie de hoy frente a la
  última vez que se hizo cada ejercicio, peso × reps sin recámara; «X de Y han subido»). Cuerpo:
  «Calidad del cambio» (de qué está hecho el cambio de peso entre escáneres: grasa o masa magra,
  % de cada kilo perdido que era grasa, consejo con la proteína en gramos y aviso del agua). Las
  etiquetas «3 meses» de los escáneres dicen el periodo real (con huecos entre escáneres podía
  ser mucho más). Progreso: cuántos ejercicios suben, se mantienen o bajan. Descartadas las
  animaciones de free-exercise-db: las fotos vienen de una web comercial, origen dudoso.

- 2026-11-10 (la app se ajusta a cómo se entrena de verdad; uso real: 2 sesiones/semana con un
  programa de 5 días de calendario fijo, Pierna sin hacer desde el 15 oct): el día que toca sigue el
  calendario solo mientras se cumple; fuera de él es el siguiente al último hecho, en orden
  (`train/rotation.ts`, sustituye a `dayForDate`), en Hoy, Entrenar y los avisos de la semana. Aviso
  de ritmo en Hoy (sesiones/semana reales, cada cuántos días vuelve cada sesión) con la plantilla que
  encaja, y Programas recomienda por el ritmo real. Plantilla nueva `jm-full-arms-3` (cuerpo completo
  + brazos, 3 días sin día fijo). La descarga solo se aplica con 8 sesiones en las 3 semanas previas
  (`mesoWeek(…, workouts)` → `postponed`). `scripts/snapshot.mjs` usa `--read-only` (la CLI nueva lo
  exige).

- 2026-11-10 (movimiento y Orbe): `orbe_plan` sigue la rotación de la app (migración
  `20261110000000_orbe_plan_rotation.sql`, aplicada): fuera del calendario responde modo `rotation`,
  con `next`, `last_done` y `pending_this_week` en orden desde el siguiente al último hecho.
  Animaciones que no mueven la maquetación (solo opacidad, escala y recorte; respetan «reducir
  movimiento»): la serie marcada destella en dorado y su check salta, con borde dorado si es récord
  y vibración corta; el contenido de la tarjeta y cada pantalla entran con un fundido; barras que
  se llenan y gráficas que se dibujan al aparecer; cifras del resumen que cuentan hasta su valor
  (`kpi/CountUp`); el reloj del descanso late al llegar a cero.

- 2026-11-10 (sesión exprés y botón fijo): en Hoy, «Completa / 45 min / 30 min» recorta el día al
  tiempo que hay (`train/express.ts`: primero series de más, luego ejercicios cuyo músculo principal
  ya trabaja otro, desde el final; nunca parte una superserie; los huecos conservan id y orden, así
  que la sesión sigue contando como ese día). En la sesión, «Serie hecha» se queda en el mismo
  sitio de la pantalla al registrar (`data-log-set`), para apuntar varias seguidas sin mover el dedo.

- 2026-11-11 (músculos, sesión a medida, racha): en Hoy, «Hace cuánto entrenas cada músculo» (días
  desde la última serie efectiva como músculo principal, naranja desde 10) y «Sesión a medida», que
  arma una sesión libre con los grupos que más esperan y los ejercicios que más usa la persona
  (`train/freshness.ts`; `useStartWorkout` admite `plan`). «N semanas seguidas entrenando» y un
  botón para bajar el objetivo semanal al ritmo real cuando sobra por más de una sesión.

- 2026-11-11: activado en producción el programa «Cuerpo completo + brazos · 3 días» (a petición
  del usuario; PPL + Brazos sigue en Programas para volver con «Activar»). Con la pulsera conectada, el fútbol y otras actividades llegan solos
  (`health_workouts`), por eso no se ha hecho un registro manual de actividades.

- 2026-11-11 (pulsera unificada): Google Health conectado y sincronizando a diario a las 08:00 Madrid
  (cron `google-health-sync`, migración `20261111000000`), comida del día (permiso `nutrition`,
  columnas `kcal_in/protein_g/carbs_g/fat_g`, migración `20261111010000`) y envío a Titra tras cada
  sincronización (`health_ingest` en Titra; secretos `TITRA_INGEST_URL/KEY`, `TITRA_ANON_KEY`).
  En la app: bloque «Comida» en Hoy (hoy, ayer, media semanal contra objetivos; «Actualizar»
  sincroniza al momento), actividades de la pulsera (fútbol, natación…) en Entrenar, en la semana
  (días a medias en las marcas, «Además: …») y en la racha; el fútbol cansa piernas en «Hace
  cuánto entrenas cada músculo» y la sesión a medida no las propone al día siguiente
  (`train/activities.ts`). Aviso en Hoy si la pulsera deja de sincronizar.

- 2026-11-12 (Estado, estilo WHOOP): pantalla `/estado` y franja al principio de Hoy con
  recuperación (0–100 %, necesita dos señales: VFC o pulso con una semana de historial, noche
  completa o check-in; las noches registradas a medias, < 4 h, no cuentan), carga del día (0–21:
  TRIMP de Banister de cada sesión de la pulsera con FCmáx 208 − 0,7·edad, + 2,5 por serie
  efectiva de Forja, + pasos sobre 3.000; curva saturante, `domain/training/strain.ts`) con
  objetivo según la recuperación, y sueño frente a lo necesario (7:30 h + hasta 1 h tras un día
  duro). Gráfica de cuatro semanas carga/recuperación, VFC y pulso en reposo, fases del sueño.

- 2026-11-12 (Estado completo): la recuperación de Estado es la «preparación» de toda la app
  (`useReadiness`: alta → apretar, media → normal, baja → suave; con recuperación baja Hoy abre la
  versión de 30 min). Sueño: hora de acostarse esta noche (necesidad tras la carga del día + la mitad
  de la deuda de las 3 últimas noches, hasta 1 h; despertar habitual o elegido, guardado en el
  dispositivo), regularidad 0–100 % y horario habitual de las noches completas (`state/sleep.ts`;
  inicio y fin de la noche desde `raw.sleep`). «Tu semana»: 7 días frente a los 7 anteriores y hasta
  3 consejos (`state/week.ts`). En Hoy, por la tarde, la hora de acostarse.

- 2026-11-12 (Cuerpo = la pulsera): la pestaña Cuerpo abre en «Estado» (la parte de la pulsera, al
  lado de Entrenar) y conserva «Composición» (Boditrax); sin pulsera muestra la recuperación del
  check-in. `/estado` redirige a `/body`. Zonas de pulso de Google Health (`time-in-heart-rate-zone`):
  por sesión (rollUp del intervalo) y por día, columnas `zones` en `health_workouts` y `health_daily`
  (migración `20261112000000`, aplicada); la carga usa los minutos por zona (Edwards) cuando los hay.
  «Forma»: minutos activos de 7 días frente a los 150 de la OMS, equilibrio de carga 7/28 días
  (0,8–1,3) y VO₂ máx con su nivel ACSM por edad y sexo. «Diario»: hábitos de ayer (tabla `journal`
  con RLS propia + `approved_only`) y su efecto en la recuperación de la mañana siguiente cuando hay
  3 días con y 3 sin.

## Pendiente

1. Publicar: GitHub → Settings → Pages → Source: **GitHub Actions** (una vez), y push a `main`.
2. Google Health API: Google no admite proyectos nuevos (oct 2026). La función
   `supabase/functions/google-health` está escrita pero sin desplegar; seguir `docs/google-health.md`
   cuando abran el acceso (al desplegarla, que compruebe que la cuenta está aprobada en `public.access`:
   usa la service role y se salta el candado). Mientras tanto, check-in diario con los números de la app
   Google Health.
3. Probar la importación CSV con un export real de Boditrax.
4. Revisar los vídeos de canales pequeños (Sergio Tejeda, Zonapablo, Galvistrainer).
