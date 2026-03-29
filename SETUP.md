# JM · Fit v3 Multiusuario — Guía de Setup

## ⚠️ IMPORTANTE: Nuevo schema de base de datos

La V3 usa un schema **completamente nuevo** con tablas adicionales.
Si ya tenías tablas de V2, el SQL las dropea primero. Haz backup antes.

## Paso 1 — Ejecutar nuevo Schema en Supabase

1. Ve a **Supabase → SQL Editor → New query**
2. Pega el contenido de `supabase_schema_v3.sql`
3. Pulsa **Run** → debe decir "Success. No rows returned"

Esto crea:
- `profiles` — perfil de cada usuario (auto-creado al registrarse)
- `scans` — datos Boditrax por usuario
- `workout_logs` — registro de entrenos por usuario
- `food_items` — base de datos de alimentos **compartida** entre usuarios
- `food_logs` — registro de comidas por usuario
- `routines` — plantillas de rutina por usuario

Incluye:
- Row Level Security en todas las tablas
- Trigger que crea perfil automáticamente al registrarse
- Seed de 46 alimentos base (compartidos)
- Índices para rendimiento

## Paso 2 — Configurar Auth en Supabase

1. Ve a **Authentication → Providers**
2. Asegúrate de que **Email** está habilitado
3. En **Authentication → URL Configuration**:
   - Site URL: `https://jmpastor2.github.io/jmfit/`
   - Redirect URLs: `https://jmpastor2.github.io/jmfit/`

## Paso 3 — Subir archivos a GitHub

Sube estos 3 archivos a `github.com/jmpastor2/jmfit`:
- `index.html` (sobreescribe el anterior)
- `manifest.json` (sobreescribe el anterior)

Los iconos (`icon-192.png`, `icon-512.png`) se mantienen si ya los tienes.

## Paso 4 — Probar

1. Abre `https://jmpastor2.github.io/jmfit/`
2. Crea tu cuenta con tu email
3. Confirma el email (revisa spam)
4. Completa el wizard de onboarding (4 pasos)
5. ¡Listo!

## Paso 5 — Añadir usuarios

Cada usuario simplemente:
1. Abre la URL de la app
2. Pulsa "¿Sin cuenta? Regístrate"
3. Completa el onboarding con su configuración personal
4. Sus datos son independientes y privados (RLS)

## Funcionalidades nuevas en V3

- **Registro multiusuario** con email/contraseña
- **Onboarding wizard** de 4 pasos (datos, objetivo, influencers, macros)
- **Perfil personalizado** por usuario (objetivo, split, macros, influencers)
- **Base de datos de alimentos compartida** — cualquier usuario puede añadir platos
- **Macros personalizados** por usuario (no hardcoded)
- **Diseño nuevo** — Plasma Dark theme (emerald-mint + violet + coral)
- **Settings** — ver y reconfigurar perfil
