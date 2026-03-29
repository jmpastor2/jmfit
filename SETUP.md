# JM · Fit v3 — Guía de configuración

## Paso 1 — Crear proyecto en Supabase

1. Ve a **supabase.com** → "New project"
2. Nombre: `jmfit` · Region: West EU (Ireland) · Contraseña segura
3. Espera ~2 minutos a que se cree

## Paso 2 — Crear las tablas

1. En Supabase → **SQL Editor** → "New query"
2. Pega el contenido de `supabase_schema.sql`
3. Pulsa **Run** → debe decir "Success"

## Paso 3 — Obtener credenciales

1. Supabase → **Settings** → **API**
2. Copia:
   - **Project URL**: `https://xxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJ...` (la larga)

## Paso 4 — Configurar la app

Abre `index.html` y sustituye las 2 líneas:

```javascript
// Busca esto (líneas ~570):
const SUPABASE_URL  = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY  = 'YOUR_SUPABASE_ANON_KEY';

// Sustitúyelas por:
const SUPABASE_URL  = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

## Paso 5 — Subir a GitHub

1. Ve a `github.com/jmpastor2/jmfit`
2. Sube `index.html` y `manifest.json` (sobreescribe los anteriores)
3. GitHub Pages → URL: `https://jmpastor2.github.io/jmfit/`

## Paso 6 — Crear tu cuenta en la app

1. Abre la app en Safari iPhone
2. Pulsa "¿Sin cuenta? Regístrate"
3. Email: `jmpastor2@alu.ucam.edu` · Contraseña de tu elección
4. Revisa el email para confirmar (puede llegar a spam)
5. Entra → ya tienes acceso con datos en la nube

## Paso 7 — Importar histórico Boditrax

1. En la app → Progreso → "Importar CSV de Boditrax"
2. Selecciona `BoditraxAccount_*.csv`
3. Se importan tus 20 scans históricos automáticamente

## Funcionamiento offline

- Si no hay conexión → datos en localStorage
- Cuando vuelve la conexión → sync automático con Supabase
- El dot verde/rojo en el dashboard indica estado de sync

## Seguridad

- Row Level Security activo: nadie puede ver tus datos
- Las claves `anon` son seguras para el frontend
- Nunca compartas la `service_role` key
