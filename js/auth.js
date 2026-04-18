// ══════════════════════════════════════════════
//  ATHLETES & DEFAULT_PLAN
// ══════════════════════════════════════════════
const ATHLETES = [
  {name:'Chris Bumstead',title:'CBum · Mr. Olympia Classic x6',color:'var(--acc4)',
   phil:'Estética y simetría. Volumen moderado, alta intensidad. Pump work tras compuestos pesados.',
   keys:['Series al fallo en accesorios','Pump post-compuestos','Alta frecuencia brazos','Conexión mente-músculo'],
   yt:'https://www.youtube.com/results?search_query=cbum+workout+routine'},
  {name:'Jeff Nippard',title:'Natural BB · Evidence-Based',color:'var(--acc5)',
   phil:'Ciencia aplicada. Progresión sistemática. RIR. Alta frecuencia por grupo muscular.',
   keys:['Progresión de sobrecarga','RIR 2–3 en accesorios','Frecuencia 2x/semana','Técnica > peso'],
   yt:'https://www.youtube.com/results?search_query=jeff+nippard+program'},
  {name:'Mike Israetel',title:'RP Strength · Dr. Fisiología',color:'var(--acc2b)',
   phil:'Periodización del volumen. MEV → MAV → MRV. Deload programado.',
   keys:['MEV → MAV → MRV','Deload cada 6–8 semanas','Volumen por rango','Recuperación = entreno'],
   yt:'https://www.youtube.com/results?search_query=mike+israetel+hypertrophy'},
];

const DEFAULT_PLAN = [
  {day:'Lunes',type:'push',label:'Pecho · Tríceps · Hombro frontal',phil:'CBum: fuerza base + pump estético',
   ex:[{n:'Press banca con barra',s:'4×6–8',star:false,cue:'Escápulas retraídas. Barra baja al pecho.',yt:'https://www.youtube.com/results?search_query=bench+press+technique'},
       {n:'Press inclinado mancuernas',s:'3×8–10',star:false,cue:'30–45° inclinación. Máximo estiramiento abajo.',yt:'https://www.youtube.com/results?search_query=incline+dumbbell+press'},
       {n:'Aperturas polea baja',s:'3×10–12',star:false,cue:'Pecho grande, brazos semiflexionados.',yt:'https://www.youtube.com/results?search_query=cable+crossover+chest'},
       {n:'Press militar barra',s:'3×8–10',star:false,cue:'Core braced. Empuja vertical.',yt:'https://www.youtube.com/results?search_query=overhead+press+technique'},
       {n:'Fondos paralelas lastrados',s:'3×8–10',star:false,cue:'Torso inclinado. Profundidad 90°.',yt:'https://www.youtube.com/results?search_query=weighted+dips'}]},
  {day:'Martes',type:'pull',label:'Espalda · Bíceps',phil:'Pendlay row Nippard + volumen bíceps CBum',
   ex:[{n:'Peso muerto convencional',s:'4×5–6',star:false,cue:'Hip hinge. Barra rozando espinillas.',yt:'https://www.youtube.com/results?search_query=deadlift+technique'},
       {n:'Remo con barra Pendlay',s:'4×8',star:false,cue:'Torso paralelo al suelo. Barra al ombligo.',yt:'https://www.youtube.com/results?search_query=pendlay+row'},
       {n:'Dominadas con lastre',s:'3×6–8',star:false,cue:'Deprime escápulas antes de tirar.',yt:'https://www.youtube.com/results?search_query=weighted+pull+ups'},
       {n:'Remo en polea sentado',s:'3×10–12',star:false,cue:'Estiramiento completo. Squeeze 1s.',yt:'https://www.youtube.com/results?search_query=seated+cable+row'},
       {n:'Curl barra recta',s:'3×8–10',star:true,cue:'Codos fijos al costado. Excéntrico lento.',yt:'https://www.youtube.com/results?search_query=barbell+curl'},
       {n:'Curl martillo mancuernas',s:'3×10–12',star:true,cue:'Agarre neutro. Braquial y braquiorradial.',yt:'https://www.youtube.com/results?search_query=hammer+curl'}]},
  {day:'Miércoles',type:'legs',label:'Piernas completo',phil:'Squat base RP + aislamiento CBum',
   ex:[{n:'Sentadilla con barra',s:'4×6–8',star:false,cue:'Bar path vertical. Cadera bajo rodilla.',yt:'https://www.youtube.com/results?search_query=squat+technique'},
       {n:'Prensa inclinada 45°',s:'3×10–12',star:false,cue:'Pies altos/separados para glúteo.',yt:'https://www.youtube.com/results?search_query=leg+press'},
       {n:'Extensión cuádriceps',s:'3×12–15',star:false,cue:'Contracción máxima arriba. Excéntrico 3s.',yt:'https://www.youtube.com/results?search_query=leg+extension'},
       {n:'Curl femoral tumbado',s:'3×10–12',star:false,cue:'Pelvis neutra. Talones a glúteos.',yt:'https://www.youtube.com/results?search_query=lying+leg+curl'},
       {n:'Peso muerto rumano',s:'3×10',star:false,cue:'Espalda neutra. Cadera atrás.',yt:'https://www.youtube.com/results?search_query=romanian+deadlift'},
       {n:'Gemelos',s:'4×12–15',star:false,cue:'Rango completo. 2s arriba, 2s abajo.',yt:'https://www.youtube.com/results?search_query=calf+raise'}]},
  {day:'Jueves',type:'arms',label:'Hombros · Brazos ★',phil:'Sesión CBum: especialización brazos',
   ex:[{n:'Press Arnold',s:'4×8–10',star:false,cue:'Rotación completa. Los 3 deltoides.',yt:'https://www.youtube.com/results?search_query=arnold+press'},
       {n:'Elevaciones laterales cable',s:'4×12–15',star:false,cue:'Tensión constante. No trapecio.',yt:'https://www.youtube.com/results?search_query=cable+lateral+raise'},
       {n:'Curl predicador EZ',s:'3×8–10',star:true,cue:'Codo en pad. Excéntrico 3s.',yt:'https://www.youtube.com/results?search_query=preacher+curl'},
       {n:'Curl concentrado',s:'2×10–12',star:true,cue:'Supinación máxima arriba.',yt:'https://www.youtube.com/results?search_query=concentration+curl'},
       {n:'Press francés EZ',s:'3×10',star:true,cue:'Codos fijos. Long head tríceps.',yt:'https://www.youtube.com/results?search_query=skull+crusher'},
       {n:'Extensión polea alta',s:'3×12',star:true,cue:'Extensión completa. Lateral head.',yt:'https://www.youtube.com/results?search_query=triceps+pushdown'}]},
  {day:'Viernes',type:'upper',label:'Full Upper · Consolidación',phil:'Técnica fina + 3ª frecuencia brazos',
   ex:[{n:'Press banca agarre cerrado',s:'4×6–8',star:false,cue:'Manos anchura hombros. Tríceps + pecho.',yt:'https://www.youtube.com/results?search_query=close+grip+bench'},
       {n:'Remo mancuerna un brazo',s:'4×8–10',star:false,cue:'Rango completo. Codo al cielo.',yt:'https://www.youtube.com/results?search_query=dumbbell+row'},
       {n:'Aperturas pec-deck',s:'3×12',star:false,cue:'Estiramiento profundo. Squeeze.',yt:'https://www.youtube.com/results?search_query=pec+deck'},
       {n:'Superserie: Curl inclinado + Ext. overhead',s:'3×10+10',star:true,cue:'Máxima tensión en estiramiento.',yt:'https://www.youtube.com/results?search_query=superset+bicep+tricep'},
       {n:'Plancha + Rueda abdominal',s:'3×45s+3×12',star:false,cue:'Core braced. Sin hiperextender.',yt:'https://www.youtube.com/results?search_query=ab+wheel'}]},
  {day:'Sábado',type:'rest',label:'Descanso activo',phil:'Recuperación → Adaptación',
   ex:[{n:'Movilidad articular',s:'15–20 min',star:false,cue:'Cadera, hombros, cadena posterior.',yt:'https://www.youtube.com/results?search_query=mobility+routine'},
       {n:'Caminata zona 2',s:'30–45 min',star:false,cue:'FC 55–65% máx.',yt:'https://www.youtube.com/results?search_query=zone+2+cardio'}]},
  {day:'Domingo',type:'rest',label:'Descanso total',phil:'El músculo crece fuera del gym',
   ex:[{n:'Sueño 7.5–9 horas',s:'Obligatorio',star:false,cue:'GH peak durante sueño profundo.',yt:'https://www.youtube.com/results?search_query=sleep+recovery'}]},
];

// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════
async function initAuth() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      await loadProfile();
    }
  } catch(e) { console.error('Auth init error:', e); }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user;
      await loadProfile();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      userProfile = null;
      showLoginScreen();
    }
  });
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  userProfile = data;
  if (!userProfile || !userProfile.onboarded) {
    showOnboarding();
  } else {
    showApp();
  }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('onboard-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('main-nav').style.display = 'flex';
  document.getElementById('user-display').textContent = userProfile?.display_name || currentUser.email;
  loadFoodItems();
  renderHome();
  renderWorkout();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('onboard-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
}

function showOnboarding() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('onboard-screen').style.display = 'block';
  document.getElementById('app').style.display = 'none';
  document.getElementById('main-nav').style.display = 'none';
  if (userProfile?.display_name) document.getElementById('ob-name').value = userProfile.display_name;
}

async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  if (!email || !pass) { showLoginErr('Rellena email y contraseña'); return; }
  const btn = document.getElementById('btn-login');
  btn.textContent = 'Entrando...'; btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Entrar'; btn.disabled = false;
  if (error) showLoginErr(error.message);
}

async function doRegister() {
  const name = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass = document.getElementById('r-pass').value;
  if (!email || !pass) { showToast('Rellena todos los campos'); return; }
  if (pass.length < 6) { showToast('Mínimo 6 caracteres'); return; }
  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { display_name: name || email.split('@')[0] } }
  });
  if (error) showToast(error.message);
  else { showToast('Cuenta creada ✓ Revisa tu email para confirmar'); showLogin(); }
}

async function doLogout() { await sb.auth.signOut(); }

function showLoginErr(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg;
  el.style.display = 'block';
}

function showRegister() {
  document.getElementById('register-card').style.display = 'block';
  document.getElementById('login-err').style.display = 'none';
}

function showLogin() {
  document.getElementById('register-card').style.display = 'none';
}

// ══════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════
function obSelect(el, groupId) {
  document.querySelectorAll(`#${groupId} .chip`).forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function obToggle(el) {
  el.classList.toggle('selected');
}

function obNext(step) {
  document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
  document.getElementById('ob-step-' + step).classList.add('active');
  document.getElementById('ob-fill').style.width = (step * 25) + '%';
}

async function finishOnboard() {
  const goalMap = { 'Ganar músculo':'muscle_gain', 'Glúteos y tren inferior':'glute_focus', 'Fuerza':'strength', 'Recomposición':'recomp', 'Definición / corte':'cut', 'Fitness general':'general' };
  const splitMap = { 'Push/Pull/Legs':'push_pull_legs', 'Upper/Lower':'upper_lower', 'Full Body':'full_body', 'Bro Split':'bro_split' };
  const sexMap = { 'Hombre':'M', 'Mujer':'F', 'Otro':'O' };

  const selectedGoal = document.querySelector('#ob-goal .chip.selected')?.textContent || 'Ganar músculo';
  const selectedSplit = document.querySelector('#ob-split .chip.selected')?.textContent || 'Push/Pull/Legs';
  const selectedSex = document.querySelector('#ob-sex .chip.selected')?.textContent || 'M';
  const selectedDays = document.querySelector('#ob-days .chip.selected')?.textContent || '5';
  const influencers = Array.from(document.querySelectorAll('#ob-influencers .chip.selected')).map(c => c.textContent);

  const profile = {
    id: currentUser.id,
    display_name: document.getElementById('ob-name').value.trim() || currentUser.email.split('@')[0],
    height_cm: parseInt(document.getElementById('ob-height').value) || null,
    birth_date: document.getElementById('ob-dob').value || null,
    sex: sexMap[selectedSex] || 'M',
    goal: goalMap[selectedGoal] || 'muscle_gain',
    goal_detail: document.getElementById('ob-goal-detail').value.trim(),
    training_days: parseInt(selectedDays) || 5,
    training_split: splitMap[selectedSplit] || 'push_pull_legs',
    influencers,
    target_kcal: parseInt(document.getElementById('ob-kcal').value) || 2500,
    target_protein: parseInt(document.getElementById('ob-p').value) || 160,
    target_carbs: parseInt(document.getElementById('ob-c').value) || 300,
    target_fat: parseInt(document.getElementById('ob-f').value) || 70,
    onboarded: true,
    updated_at: new Date().toISOString()
  };

  const { error } = await sb.from('profiles').upsert(profile);
  if (error) { showToast('Error: ' + error.message); return; }
  userProfile = profile;
  showApp();
  showToast('¡Perfil configurado! 🎉');
}
