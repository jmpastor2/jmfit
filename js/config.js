// ══════════════════════════════════════════════
//  SUPABASE CONFIG
// ══════════════════════════════════════════════
const SUPABASE_URL = 'https://jzhltzafdqipeortwdra.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6aGx0emFmZHFpcGVvcnR3ZHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDgwNjIsImV4cCI6MjA5MDM4NDA2Mn0.Ei0QpQdG8DSV4dCZT5uihAZ7r69ZDxpv8M3miwZh3QM';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let currentUser = null;
let userProfile = null;
let foodItemsCache = [];
let _ci = null;
let _selFood = null;

// Strength exercises (default, customizable later)
const DEFAULT_STR = ['Press banca con barra','Peso muerto convencional','Sentadilla con barra','Press militar barra','Dominadas con lastre'];

// ── LOCAL STORAGE FALLBACK ──
const LS = {
  get: (k, d=null) => { try { const v = localStorage.getItem('jmv3_'+k); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('jmv3_'+k, JSON.stringify(v)) } catch {} }
};
