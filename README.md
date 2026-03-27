# JM · Fit v2 — Panel élite personal

App PWA de alto rendimiento. Todo en local, cero coste, instalable en iPhone como app nativa.

## Nuevo en v2

- **Dieta personalizada** con plan completo día entrenamiento + día descanso
- **Base de datos de 45+ alimentos** con calculadora de macros por gramos
- **Log de macros diario** con tracking en tiempo real vs objetivo
- **KPI strip** en dashboard: peso, grasa, músculo, 1RM estimado, ratio M/G
- **Atletas de referencia**: CBum, Jeff Nippard, Mike Israetel con sus principios
- **Links a YouTube** por ejercicio (técnica + vídeos de referencia)
- **Cues técnicos** por ejercicio debajo de cada uno
- **Check-in pre-sesión**: estado, sueño, energía, estrés
- **KPIs de fuerza**: máximos registrados + 1RM estimado (fórmula Epley)
- **3 gráficas de progreso**: peso, composición, récords de fuerza
- **Exportación JSON** completa con scans + logs + comidas

## Deploy en GitHub Pages (5 min)

### 1. Crea el repo

Ve a github.com/jmpastor2 → New repository → Nombre: `jmfit` → Public → Create

### 2. Sube los archivos

Opción rápida desde la web de GitHub:
- Entra al repo → "Add file" → "Upload files"
- Arrastra `index.html` y `manifest.json`
- Commit: "Initial JM Fit v2"

### 3. Activa GitHub Pages

Settings → Pages → Source: Deploy from branch → main → / (root) → Save

URL resultante: `https://jmpastor2.github.io/jmfit/`

### 4. Instala en iPhone

1. Safari → `https://jmpastor2.github.io/jmfit/`
2. Botón compartir (cuadrado con flecha hacia arriba)
3. "Añadir a pantalla de inicio"
4. ✓ Ya tienes tu app

## Estructura de datos (localStorage)

```
jmv2_scans   → array de scans Boditrax
jmv2_logs    → array de sets registrados
jmv2_foodlog → { date, items[] } — reset diario automático
```

## Próxima fase

- Notificaciones push de recordatorio de entreno
- Import de PDF/CSV de Boditrax
- SwiftUI nativa cuando tengas Mac
