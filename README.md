# Forja

Entrenamiento guiado para el gimnasio: qué toca hoy, con qué peso, cuánto descansar, cuándo bates
un récord y cómo cambia tu cuerpo. PWA instalable (GitHub Pages) sobre Supabase.

- **Sesión guiada:** peso y reps recomendados por serie (doble progresión con RIR), ajuste de la
  serie siguiente según cómo fue la anterior, calentamientos, discos por lado, descanso automático
  con aviso, récords en directo y superseries. Funciona sin conexión.
- **Programas:** 8 plantillas (incluida la tuya PPL + Brazos) y editor con el volumen semanal por
  músculo frente a los rangos de Renaissance Periodization; mesociclos con semana de descarga.
- **Progreso:** 1RM estimado, nivel de fuerza relativo a tu peso, series efectivas por músculo,
  tonelaje, frecuencia y tabla de récords.
- **Cuerpo:** escáneres Boditrax (alta manual o CSV), evolución, comparador; recuperación
  (sueño, FC en reposo, HRV, pasos) y preparación diaria.
- **Técnica:** 121 ejercicios con claves y errores, 147 vídeos verificados.
- **Mi gimnasio:** tus máquinas de Fitness Park con sus ajustes y un QR imprimible por máquina.
- **Objetivos** con proyección de fecha.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173 (pide iniciar sesión)
npm run check        # tipos, lint y tests
```

Laboratorio con una copia local de la cuenta real (las escrituras se quedan en memoria):
`node scripts/snapshot.mjs <uuid>` y abrir `/lab.html`.

Base de datos: `supabase/migrations` (aplicadas con `npx supabase db query --linked=false
--project-ref jzhltzafdqipeortwdra -f <archivo>`). Pulsera: `docs/google-health.md`.
Diseño: `DESIGN.md`. Investigación: `docs/research.md`. Estado: `docs/estado.md`.
