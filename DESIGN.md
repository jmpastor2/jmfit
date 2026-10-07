# Forja · negro y dorado

Forja es el entrenador de bolsillo de Jose Manuel: qué toca hoy, con qué peso, cuánto descansar,
cuándo bate un récord y cómo cambia su cuerpo. Estética de gimnasio premium: negro casi puro,
blanco cálido y un dorado champán plano que solo marca lo que importa.

## Principios

- **El dorado es señal, no decoración.** Ocupa como mucho un 5–8 % de la pantalla: el botón
  principal, la serie activa, los récords, el progreso. Dorado plano (`--gold`), nunca degradados
  metálicos, brillos ni biseles.
- **Una cifra protagonista por bloque.** Kg, reps, tiempos y porcentajes en Barlow Condensed
  grande (`.readout`), con la unidad pequeña en gris al lado.
- **Jerarquía por tipografía y espacio.** Pocas tarjetas, separadores de 1 px (`border-line`,
  `divide-line`). Nunca una caja dentro de otra caja.
- **Mayúsculas solo en etiquetas cortas y títulos**: `.spec` (etiqueta condensada con tracking),
  títulos de página y nombres de ejercicio en cabecera. El texto corrido va en frase normal.
- **Sin verde.** Bien = dorado; completado/neutral = acero (`--ok`); atención = naranja
  (`--warn`); error = rojo apagado (`--danger`).
- **Hecho para el gimnasio:** objetivos táctiles ≥ 44 px (48 en la sesión), cifras legibles a un
  brazo de distancia, una acción principal por pantalla, todo funciona sin conexión.
- **Datos honestos.** Nada inventado: si falta un dato se dice («sin datos todavía») y se explica
  cómo conseguirlo. Ningún número sin su fecha o su base de cálculo a mano.
- **Texto entero.** 320 px de ancho funcionan; los nombres se parten en dos líneas.

## Tokens (`src/styles/globals.css`)

| Token / clase Tailwind                   | Valor                             | Uso                             |
| ---------------------------------------- | --------------------------------- | ------------------------------- |
| `bg-canvas` (`--bg`)                     | `#0a0a0a`                         | Fondo                           |
| `bg-panel` / `bg-panel-2` / `-3`         | `#121212` / `#1a1a1a` / `#242424` | Tarjetas, controles, pulsado    |
| `border-line` / `border-line-strong`     | `#24221f` / `#3a3732`             | Filetes de 1 px                 |
| `text-ink` / `text-ink-2` / `text-muted` | `#f3f0e8` / `#c9c3b6` / `#8f8a80` | Texto                           |
| `text-gold` `bg-gold` (= `signal`)       | `#c9a55c`                         | Señal dorada                    |
| `text-gold-light` / `gold-dark`          | `#e4c98f` / `#8c7140`             | Cifra destacada / filete dorado |
| `bg-signal-soft`                         | dorado 12 %                       | Fondo de la fila activa         |
| `text-ok` / `text-warn` / `text-danger`  | acero / naranja / rojo            | Estados                         |

Radios pequeños: 6 px controles, 8 px botones y bloques, 10 px tarjetas (`.card`).

## Tipografía

- Títulos, etiquetas y cifras: **Barlow Condensed** 500–700 (`font-display`, `.readout`, `.spec`).
- Texto: **Inter** variable (`font-sans`). Campos a 16 px en móvil (iOS no hace zoom).

## Piezas

- `components/ui`: `Button` (primary = dorado), `Card`, `Sheet` (hoja inferior), `Field`/`Input`/
  `Select`/`Textarea`, `Toast` (`useToast`), `primitives` (`Badge`, `Segmented`, `Chip`, `Row`,
  `EmptyState`, `Skeleton`, `SectionTitle`, `Divider`, `Switch`, `ToggleRow`).
- `components/kpi`: `Kpi` + `Delta`, `Meter` (barra fina con objetivo y franja), `Ticks` (un trazo
  por día), `Steps`, `Spark`.
- `components/charts/LineChart`: serie temporal con lectura al tocar, objetivo discontinuo y serie
  de comparación.
- `components/layout`: `PageHeader` (título grande en mayúsculas), `AppShell`, `TabBar`.

## Patrones

- Cabecera de página: `PageHeader large` con una etiqueta `.spec` dorada encima cuando ayuda.
- Bloque de datos: `.spec` arriba, cifra `.readout` grande, una línea gris que explica, y si ayuda
  un `Meter`/`Spark`/`LineChart`.
- Listas: filas de 52 px separadas por `divide-line`, sin tarjeta por fila.
- Hoja inferior para crear y editar; botón principal dorado en el pie (`footer`).
