# Forja — investigación previa (2026-10-07)

Documento de investigación para la reescritura de la app (Forja). Cada apartado cita sus fuentes.
Cuando algo no se ha podido verificar se indica expresamente; no se rellena con suposiciones.

---

## 1. Estilo "ICON GYM" (negro + dorado, minimalista)

### 1.1 ¿Qué app es? — no identificada con certeza

Se buscó en App Store, Google Play y web (España y fuera) sin encontrar una app de gimnasio llamada
exactamente "ICON GYM" con estética negro/dorado. Lo más parecido que existe:

| App | Qué es | Fuente |
|---|---|---|
| ICON FITNESS (Grecia, eFitness S.A.) | App de socios: gestión de cuota, pagos y reserva de clases | https://apps.apple.com/us/app/-/id6446685489 |
| ICON palestre (Italia, Managify Srl) | Composición corporal, reservas, chat con entrenador; credenciales que da el gimnasio | https://apps.apple.com/ml/app/icon-palestre/id1644665838 |
| ICON CrossFit & Training (Badalona/El Masnou) | Box de CrossFit; reservas vía Urban Sports Club, sin app propia localizada | https://urbansportsclub.com/nl/venues/icon-crossfit-training-badalona |
| Gold's Gym España | App de club (horarios, clases, reservas); marca con identidad dorada | https://apps.apple.com/app/id6748636730 |

Conclusión honesta: no puedo describir capturas ni paleta "exacta" de una app ICON GYM concreta
porque no se ha podido localizar. **Pendiente: pedir al usuario el enlace o una captura.** La guía de
abajo traduce la intención ("negro, dorado, minimalista, premium") a tokens propios, basados en
convenciones de diseño de marcas premium de fitness, no en copiar a ninguna.

### 1.2 Guía de diseño propuesta para Forja

**Principios**
- Negro casi puro y cálido como lienzo; el dorado es *señal*, no decoración: ≤ 5–8 % de la
  superficie de pantalla (CTA principal, PR, serie activa, progreso del día).
- Nada de degradados metálicos, brillos, biseles ni texturas "oro": dorado plano y desaturado
  (champán/latón), que es lo que lo separa de lo hortera.
- Jerarquía por tipografía y espacio, no por cajas: pocas tarjetas, separadores de 1 px.
- Mayúsculas solo en etiquetas cortas (secciones, unidades, nombres de ejercicio en cabecera) con
  tracking amplio; el texto corrido en minúsculas normales.
- Números grandes y tabulares (kg, reps, tiempos) como protagonistas.
- Fotografía: si se usa, monocroma/oscura con viñeta, nunca a color saturado; iconografía de línea
  1.5 px (p. ej. Lucide) en color texto apagado, dorado solo en estado activo.

**Tokens de color** (contraste aproximado sobre `--bg`)

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#0A0A0A` | Fondo app |
| `--surface-1` | `#121212` | Tarjetas / hojas |
| `--surface-2` | `#1A1A1A` | Inputs, filas activas, chips |
| `--surface-3` | `#242424` | Hover/pressed, teclado numérico |
| `--line` | `#2A2824` | Separadores 1 px (ligeramente cálido) |
| `--gold` | `#C9A55C` | Dorado principal: CTA, serie activa, PR (≈ 8.5:1) |
| `--gold-light` | `#E4C98F` | Texto dorado sobre superficies, números destacados |
| `--gold-dark` | `#8C7140` | Bordes dorados, barras de progreso en reposo, iconos inactivos-dorado |
| `--gold-tint` | `rgba(201,165,92,0.12)` | Fondo de fila/serie activa |
| `--text` | `#F3F0E8` | Texto principal (blanco cálido, no `#FFF`) |
| `--text-2` | `#A8A398` | Texto secundario (≈ 7.5:1) |
| `--text-3` | `#6E6A62` | Deshabilitado, placeholders, unidades |
| `--on-gold` | `#0A0A0A` | Texto sobre botón dorado |
| `--danger` | `#D2605A` | Errores, borrar |
| `--warn` | `#E0884A` | Avisos (naranja, para no confundir con el dorado) |
| `--ok` | `#9FB8C8` | Confirmación/completado en azul acero frío (evita verde, coherente con preferencias del usuario en otros proyectos) |

Modo claro: no recomendado como objetivo inicial; la identidad es oscura.

**Tipografía** (Google Fonts, 2 familias máximo)
- Display / etiquetas: **Barlow Condensed** 500–600 en MAYÚSCULAS, `letter-spacing: 0.08–0.12em`
  (alternativa más editorial: **Archivo** variable con eje `wdth` ~75). https://fonts.google.com/specimen/Barlow+Condensed
- Texto UI: **Inter** 400/500 (o fuente de sistema `system-ui` si se prioriza peso cero).
  https://fonts.google.com/specimen/Inter
- Numerales: Barlow Condensed 600 para cifras grandes (peso, reps, temporizador) y Inter con
  `font-variant-numeric: tabular-nums` en tablas de series para que las columnas no bailen.
- Escala: 12 (etiqueta caps) / 14 / 16 (base) / 20 / 28 / 44–64 (cifra héroe del temporizador).

**Forma y densidad**
- Radios: 4 px (chips, inputs), 8 px (tarjetas), 999 px solo para el botón flotante/temporizador.
  Radios pequeños = aspecto más "sastre" que los 16–24 px típicos de apps genéricas.
- Objetivos táctiles ≥ 48 px (se usa con manos sudadas); filas de serie de 52–56 px.
- Espaciado base 4 px; márgenes laterales 16–20 px.
- Movimiento sobrio: 150–200 ms ease-out; sin rebotes. Háptica (Vibration API en Android) al
  completar serie y al acabar el descanso.

---

## 2. Referentes UX 2025-2026 y las 10 mejores ideas para entrenamiento guiado

Fuentes por app:
- Hevy — temporizador por ejercicio que arranca al marcar serie, ±15 s, actividad en vivo/notificación;
  valores previos por serie (globales o de la misma rutina); avisos de PR en directo; tipos de serie
  (calentamiento, normal, fallo, drop); calculadora de calentamiento y de discos.
  https://www.hevyapp.com/features/workout-rest-timer/ ·
  https://help.hevyapp.com/hc/en-us/articles/33882110558743-Workout-Settings-Preferences-Timer-Warm-up-calculator-Plate-Calculator-Smart-Superset-Scrolling ·
  https://www.hevyapp.com/features/track-workouts/
- Strong — calculadora de calentamiento y de discos, 1RM estimado y gráfica de progresión,
  temporizador automático, app de Apple Watch. https://spark.mwm.ai/en/apps/strong-workout-tracker-gym-log/464254577
- Fitbod — mapa de recuperación por músculo 0–100 %, progresión según rendimiento y RIR,
  1RM estimado dinámico, preferencias "más/menos/excluir" por ejercicio, importación de Health Connect.
  https://fitbod.me/blog/muscle-recovery/ · https://fitbod.me/blog/how-fitbods-ai-knows-exactly-when-you-should-lift-heavier-and-when-to-recover/
- WHOOP — Strain = carga cardiovascular + carga muscular; la carga muscular mejora si se registran
  series/reps/kg; se interpreta contra la Recovery del día.
  https://www.whoop.com/thelocker/how-does-whoop-strain-work-101/ · https://www.whoop.com/ca/en/thelocker/how-whoop-measures-muscular-load/
- Oura — Readiness con contribuidores visibles (FC reposo vs. media, balance HRV 14 d vs. 3 meses,
  sueño, temperatura…); prioriza tendencias, 85+ óptimo. https://ouraring.com/blog/readiness-score/ ·
  https://support.ouraring.com/hc/en-us/articles/360057791533
- Future — plan semanal de un entrenador, vídeo de técnica, rendición de cuentas.
  https://athletechnews.com/future-personal-training-coaching-app-review/
- Ladder — bloques de 5–6 semanas que progresan, demostraciones en vídeo, temporizador integrado,
  "Journal" de progreso de kg/reps. https://www.garagegymreviews.com/ladder-app-review
- (Apple Fitness y JEFIT no aportaron fuentes nuevas relevantes en esta búsqueda; se omiten.)

**Top 10 ideas aplicables a Forja**
1. **Fila de serie precargada con "la vez anterior"** (kg × reps de esa misma serie en la última
   sesión del mismo ejercicio), editable con un toque y confirmable con un check grande (Hevy).
2. **Descanso que arranca solo al marcar la serie**, configurable por ejercicio (compuestos 2–3 min,
   aislamiento de brazo 60–90 s), con ±15 s y saltar; notificación/vibración al terminar (Hevy).
3. **Objetivo de la serie sugerido** (doble progresión: si se completó el tope del rango de reps en
   todas las series con RIR ≥ 1 → subir el incremento mínimo de esa máquina; si no, repetir/añadir rep)
   mostrado como "Hoy: 32,5 kg × 10–12" (Fitbod, simplificado y explicable).
4. **RIR/RPE opcional por serie** (un toque 0–3) que alimenta la siguiente sugerencia (Fitbod).
5. **PR en directo**: detectar en el momento récord de peso, de reps a un peso y de 1RM estimado
   (Epley/Brzycki) → destello dorado discreto (Hevy, Strong). Es el uso "con sentido" del dorado.
6. **Calentamiento calculado** (p. ej. 40 %×10, 60 %×6, 80 %×3 del peso de trabajo) solo en el
   primer compuesto del día, redondeado al incremento real de la máquina/discos (Hevy, Strong).
7. **Resumen de sesión**: duración, volumen total (kg·reps), series por grupo muscular — con foco en
   brazos para su especialización —, PRs y comparación con la misma sesión anterior (Hevy, Ladder).
8. **Volumen semanal por músculo frente a objetivo** (series efectivas/semana) en lugar de mapas de
   calor coloridos: barra lineal fina, coherente con KPIs lineales (Fitbod, adaptado).
9. **Readiness del día con contribuidores visibles** (sueño, FC reposo vs. base 30 d, HRV vs. base),
   que solo *matiza* (p. ej. "día flojo: mantén cargas, recorta 1 serie") y nunca bloquea (Oura, WHOOP).
10. **Bloques/mesociclos con progresión explícita** (5–6 semanas + descarga) y vista "semana X de Y"
    (Ladder), más nota de técnica/vídeo por ejercicio enlazable (Future).

---

## 3. Fitness Park (España): máquinas, app e integración

### 3.1 Marcas de equipamiento (verificado)
- La web de Fitness Park España anuncia "equipamiento de alta gama": **Technogym, Eleiko, Hammer
  Strength, Gym 80 y Nike Strength & Watson**; espacios de Cardio, Hyrox, Cross Training,
  Powerlifting, Studio Bike, Studio Athletic, abdominales/estiramientos y Musculación.
  https://www.fitnesspark.es/?p=24531 · https://www.fitnesspark.es/?p=23500
- Club La Vaguada (Madrid): Technogym, Hammer Strength y Eleiko, con "Hammer Zone", "Eleiko Zone" y
  "Skill Zone". https://www.fitnesspark.es/noticias/actualidad/fitness-park-revoluciona-madrid-con-su-quinto-club-en-la-vaguada
- Valencia: Technogym **Pure Strength** (carga de discos), Hammer Strength y Eleiko.
  https://valencialife.es/fitness-park-best-gyms-in-valencia/
- Francia (Mérignac, 2023): Technogym, Hammer y Pure Strength; zona cardio conectada con SkillRow.
  https://www.toute-la-franchise.com/news-plus-rien-n-arrete-fitness-park
- **No** se han encontrado evidencias de Matrix, Life Fitness (salvo Hammer, que es del grupo Life
  Fitness), Panatta ni eGym en Fitness Park España. El parque exacto varía por club.

### 3.2 App de Fitness Park
- App solo para socios: **QR personal de acceso** válido en los clubes de España/Francia, reserva de
  clases, cientos de programas por nivel/objetivo, planificación semanal, área de cliente
  (facturas, domiciliaciones), votar música, sincronización con Apple Health (ficha iOS).
  https://apps.apple.com/us/app/-/id1514794906 · https://apps.apple.com/es/app/id6443488443
- **No** se ha encontrado que la app de Fitness Park lea datos de las máquinas ni que haya QR en las
  máquinas para registrar series automáticamente. Hay referencias (en resultados de búsqueda sobre
  Fitness Park) a máquinas Technogym con consola **UNITY** que muestran peso/series/reps y envían
  resultados a **Mywellness**, pero no se pudo abrir la página original para confirmarlo; verificar en
  el club si sus máquinas de fuerza selectorizadas tienen pantalla/QR de Mywellness.

### 3.3 Integraciones posibles con máquinas — realidad
| Vía | Qué hace | ¿Usable por una PWA personal? | Fuente |
|---|---|---|---|
| Technogym **Mywellness** (QR/Bluetooth en máquina) | Si la máquina está conectada y el club usa Mywellness, la app Mywellness registra el entreno; sincroniza con Apple Health, Strava, Garmin, Fitbit… | Solo a través de la app oficial. La API (Enterprise/Open Platform) es para partners y operadores, sin alta abierta para particulares | https://apple.co/2UcHYhl · https://openplatformdocs.mywellness.com/api/collections/3500672/2s946o59pC · https://www.mywellness.com/en-GB/open-ecosystem |
| Life Fitness / Hammer **Connect** | Login en máquina por NFC/Bluetooth/QR para cardio Life Fitness | Solo app oficial; Hammer Strength de discos no tiene electrónica | https://www.lifefitness.com/en-gb/catalog/digital-solutions/life-fitness-connect |
| Matrix (Connect/Engage, Virtuagym, Advagym) | Cardio/fuerza conectada vía plataformas de terceros | No aplica: Matrix no consta en Fitness Park | https://business.virtuagym.com/partner/matrix/ |
| **Apple GymKit** | Tocar el Apple Watch (NFC) en cinta/elíptica/bici/escaladora compatible (Technogym entre los fabricantes) y el Watch recibe distancia, ritmo, calorías | Solo con Apple Watch; **el usuario lleva Fitbit Air**, así que no aplica. Solo cardio | https://www.techradar.com/how-to/how-to-connect-your-apple-watch-to-gym-equipment-with-apple-gymkit · https://appleinsider.com/articles/19/06/12/apples-gymkit-what-it-is-who-supports-it-and-where-you-can-find-it |
| Bluetooth FTMS (Web Bluetooth) | Algunas máquinas cardio emiten el protocolo Fitness Machine | Técnicamente posible en Chrome Android, pero las consolas de club suelen estar emparejadas con su ecosistema; no fiable | https://www.spabusiness.com/wellness-products-and-services/Technogym-opens-up-its-Mywellness-ecosystem-will-integrate-with-equipment-from-other-manufacturers/351149 |

**Conclusión honesta:** para una PWA personal **no existe una vinculación real y automática con las
máquinas de Fitness Park** (sin API abierta, sin acceso a Mywellness para particulares, fuerza de
discos sin electrónica). La mejor alternativa:
1. **Catálogo "Mi gimnasio"** dentro de Forja: cada máquina del club con marca, modelo, foto propia,
   incremento mínimo de peso, ajustes personales (altura asiento, respaldo, agarre) y ejercicios.
2. **QR propios / pegatinas NFC** (opcional, personales): un deep link `…/#/m/<machineId>` que abre
   la máquina y su ejercicio en Forja. Un QR se lee con la cámara del móvil; una etiqueta NFC NTAG213
   con URL la abre Android sin Web NFC. (Pegar cosas en máquinas del club requiere permiso del club;
   alternativa: llevar una tarjeta/llavero con los QR o simplemente buscar en el catálogo.)
3. **Cardio**: registrarlo en Forja manualmente (tiempo, distancia, nivel) o aceptar lo que capture
   la Fitbit Air (FC, calorías) cuando haya vía de importación (ver §4).

### 3.4 Catálogo inicial sugerido (modelos de catálogo de las marcas presentes — confirmar en tu club)
No hay inventario público por club; esta lista son modelos reales de las líneas de esas marcas para
precargar plantillas. **El usuario debe marcar cuáles existen en su club** (no cargar como dato real
hasta confirmarlo).
- **Technogym Pure Strength (discos):** Shoulder Press, Biceps (curl), Pullover, Low Row, Row,
  Linear Leg Press, Hack Squat, Hip Thrust, Standing Abductor.
  https://fitnesssuperstore.com/products/technogym-pure-strength-plate-loaded-shoulder-press-remanufactured ·
  https://www.athleticbusiness.com/industry-press-room/article/15159496/technogyms-pure-plate-loaded-range-glute-builder-training-and-new-iconic-pieces ·
  https://fitnesssuperstore.com/Technogym-Pure-Strength-P-L-Linear-Leg-Press-p/technogymllp.htm
- **Technogym Selection (selectorizada, línea 700/900):** Arm Extension (tríceps), Arm Curl, Leg
  Extension, Leg Curl, más los habituales de la línea (Chest Press, Lat Machine, Low Row, Shoulder
  Press, Pectoral/Rear Delt, Abductor/Adductor, Leg Press) — confirmar nombres en máquina.
  https://www.refurbed.de/en-de/p/technogym-select-900-arm-extens/ · https://www.archiexpo.com/product-manufacturer/technogym-curl-weight-training-machine-42195-14772.html
- **Hammer Strength Plate-Loaded:** Iso-Lateral Low Row, Iso-Lateral Wide Pulldown, Iso-Lateral
  Chest/Back, Iso-Lateral Decline Press, Iso-Lateral Leg Curl, Seated Biceps.
  https://www.lifefitness.com/en-eu/catalog/strength-training/plate-loaded/plate-loaded-iso-lateral-low-row ·
  https://delta-fitness.com/en/brand/25-hammer-strength?page=2
- **Hammer Strength MTS / Select (selectorizada):** MTS Iso-Lateral Biceps Curl, MTS Iso-Lateral
  Triceps Extension, Select Biceps Curl, Select Triceps Extension.
  https://shop.lifefitness.com/products/hammer-strength-mts-iso-lateral-biceps-curl ·
  https://www.lifefitness.com/es-la/equipamientos/fuerza/selectorizado/mts-iso-lateral-triceps-extension
- **Peso libre / Eleiko:** barras olímpicas, discos, plataformas de powerlifting, mancuernas (una
  página de la cadena menciona hasta 60 kg; no verificado por club), bancos, multipower, poleas.

Campos útiles por máquina: `brand`, `line`, `model`, `type` (selectorizada / discos / polea /
peso libre / cardio), `loadIncrementKg`, `stackMaxKg` o "discos", `unilateral` (iso-lateral),
`settings` (texto libre por usuario), `exercises[]`.

---

## 4. Google Fitbit Air

### 4.1 Qué es
- Pulsera **sin pantalla** ("pebble" en correa intercambiable). Anunciada el **7 mayo 2026**, venta
  general **26 mayo 2026**. **99,99 €** en España (también $99.99 / £84.99). Batería ~7 días; 5 min
  de carga ≈ 1 día. Requiere Android 11+ / iOS 16.4+ y la app **Google Health** (el antiguo app
  Fitbit renombrado). 3 meses de Google Health Premium incluidos (luego ~8,99 €/mes en España).
  https://blog.google/products-and-platforms/devices/fitbit/fitbit-air/ ·
  https://www.techadvisor.com/article/3133758/fitbit-air-fitness-tracker-price-specs-features-release-date.html ·
  https://www.xataka.com/wearables/fitbit-air-caracteristicas-precio-ficha-tecnica ·
  https://androidphoria.com/gadgets/google-fitbit-air-caracteristicas-precio

### 4.2 Sensores y métricas
| Métrica | ¿La tiene? | Notas / fuente |
|---|---|---|
| FC continua 24/7 | Sí | blog.google |
| FC en reposo | Sí | blog.google |
| HRV | Sí | blog.google |
| SpO2 | Sí (sensores rojo/IR; nocturno, sin medición puntual) | blog.google · https://www.yankodesign.com/2026/05/08/your-fitness-tracker-has-too-much-screen-the-100-fitbit-air-has-none/ |
| Sueño por fases (ligero/profundo/REM) + duración | Sí; las reseñas lo destacan como lo mejor del dispositivo | blog.google · https://androidauthority.com/google-fitbit-air-review-3671325/ |
| Temperatura cutánea (variación nocturna) | Sí, tras ~3 noches de datos | https://www.electrocity.ie/product/google-fitbit-air-screenless-activity-tracker-with-heart-rate-sleep-ai-coaching-lavender/ · https://www.thurrott.com/smart-tech/338097 |
| Pasos, distancia, calorías, minutos en zona activa | Sí | https://www.adorama.com/fitbit-air-screenless-fitness-tracker/p/fbairob |
| Alertas de FA (AFib) | Sí | blog.google |
| VO2max / "cardio fitness" | Parcial: requiere registrar carreras al aire libre con el móvil (sin GPS propio) | https://www.thurrott.com/smart-tech/338097 |
| Entrenos automáticos | Sí para actividades comunes (caminar, correr, remo); precisión irregular; **no consta detección de pesas** | https://blog.google/products-and-platforms/devices/fitbit/fitbit-air/ · https://bgr.com/2205492/google-fitbit-air-first-major-update-fixes/ |
| ECG, GPS, barómetro, pantalla | No | https://livity-app.com/en/blog/fitbit-air-review-apple-watch |
| Readiness / coach IA | Con Premium (Google Health Coach, Gemini) | https://www.droid-life.com/2026/05/07/fitbit-air-release-date-price-official/ |

### 4.3 ¿Adónde van los datos?
- **App Google Health** (antes Fitbit), en la cuenta de Google. https://www.thurrott.com/wearables/335770/google-launches-screenless-fitbit-air-and-rebrands-fitbit-app-to-google-health
- **Health Connect (Android):** fuentes secundarias indican que Google Health lee y escribe en Health
  Connect y Apple Health; no confirmado en documentación oficial de Google.
  https://pasqualepillitteri.it/en/news/2203/google-health-fitbit-air-launch-2026 ·
  https://www.digitaltrends.com/?p=5995214 — Ojo: Health Connect es una API **en el dispositivo
  Android**, no accesible desde una PWA/web.
- **Google Health API** (sustituta de la Fitbit Web API): REST `health.googleapis.com/v4`, OAuth de
  Google, tipos `sleep` (fases), `daily-resting-heart-rate`, `heart-rate-variability`,
  `daily-heart-rate-variability`, `oxygen-saturation`, `daily-vo2-max`,
  `daily-sleep-temperature-derivations`, `exercise`, `steps`, `heart-rate`. Scopes `googlehealth.*`
  **restringidos** (requieren revisión de seguridad para producción).
  https://tryterra.co/blog/everything-you-need-to-know-about-google-health-new-api
- **Bloqueo importante:** la página oficial dice que **no están admitiendo proyectos nuevos** por ahora.
  La Fitbit Web API antigua deja de tener soporte el **30-sep-2026** y se **apaga el 30-oct-2026**,
  así que tampoco es una opción para empezar ahora.
  https://developers.google.com/health · https://developers.google.com/health/migration?hl=en

**Consecuencia:** hoy una PWA en GitHub Pages + Supabase **no puede leer automáticamente** los datos
de la Fitbit Air. Opciones: (a) introducción manual rápida diaria (sueño h, FC reposo, HRV, pasos)
— 4 campos, < 20 s; (b) diseñar la capa de datos con un adaptador `healthSource` para enchufar la
Google Health API (vía Edge Function de Supabase, porque el intercambio OAuth requiere secreto de
servidor) cuando Google abra el acceso; (c) exportación manual (p. ej. Google Takeout) — no
verificado para la nueva app Google Health, no planificar sobre ello.

**Métricas a mostrar:** sueño (duración + fases), FC en reposo, HRV, pasos/minutos activos y, con
menos peso, SpO2 y variación de temperatura. **No** mostrar VO2max como métrica principal (poco
fiable sin carreras) ni depender de detección automática de entrenos de fuerza.

---

## 5. Decisiones recomendadas para Forja

- **Estilo:** adoptar los tokens de §1.2 (fondo `#0A0A0A`, dorado champán `#C9A55C` plano, texto
  `#F3F0E8`); dorado reservado a CTA, serie activa y PRs; sin verde (estado "ok" en azul acero).
  Pedir al usuario el enlace/captura de "ICON GYM" para afinar, porque no se ha podido identificar.
- **Tipografía:** Barlow Condensed (caps, tracking amplio, cifras héroe) + Inter con `tabular-nums`;
  radios 4/8 px; filas de serie ≥ 52 px.
- **Pantalla de entrenamiento:** fila precargada con la sesión anterior, check grande, descanso
  automático por ejercicio con ±15 s y vibración, RIR opcional, PR en directo, calentamiento
  calculado en el primer compuesto.
- **Progresión:** doble progresión explicable usando el incremento real de cada máquina del catálogo.
- **Resumen y semana:** resumen de sesión (volumen, series por músculo, PRs, comparación) y barras
  lineales de series semanales por músculo con objetivo extra para bíceps/tríceps.
- **Catálogo "Mi gimnasio":** entidad `Machine` (marca, línea, modelo, tipo, incremento, ajustes
  personales, ejercicios); plantillas de Technogym Pure Strength/Selection, Hammer Strength
  (Plate-Loaded/MTS/Select) y peso libre Eleiko, que el usuario confirma una a una.
- **Vinculación con máquinas:** no prometer conexión automática (no hay API abierta para
  particulares). Implementar deep links `#/m/<id>` + generador de QR imprimible por máquina; NFC
  opcional con etiquetas que contengan la misma URL.
- **Cardio:** registro manual en Forja; GymKit descartado (requiere Apple Watch).
- **Fitbit Air:** formulario diario de 4 campos (sueño, FC reposo, HRV, pasos) + readiness propio
  con contribuidores visibles comparados con la base de 30 días; dejar un adaptador `healthSource`
  preparado para la Google Health API cuando acepte proyectos nuevos (vía Edge Function).
- **No construir** sobre la Fitbit Web API (se apaga el 30-oct-2026) ni sobre Health Connect (no
  accesible desde web).
