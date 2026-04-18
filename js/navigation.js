// ════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════
function showScreen(name, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  const fns = { home: renderHome, workout: renderWorkout, diet: renderDiet, log: renderLog, progress: renderProgress };
  if (fns[name]) fns[name]();
}

// ════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════
function showSettings() {
  if (!userProfile) return;
  const age = calcAge(userProfile.birth_date);
  openModal('Configuración', `
    <div class="setting-row"><span class="setting-lbl">Nombre</span><span class="setting-val">${userProfile.display_name}</span></div>
    <div class="setting-row"><span class="setting-lbl">Email</span><span class="setting-val">${userProfile.email || currentUser.email}</span></div>
    <div class="setting-row"><span class="setting-lbl">Altura</span><span class="setting-val">${userProfile.height_cm || '—'} cm</span></div>
    <div class="setting-row"><span class="setting-lbl">Edad</span><span class="setting-val">${age || '—'} años</span></div>
    <div class="setting-row"><span class="setting-lbl">Objetivo</span><span class="setting-val">${userProfile.goal?.replace(/_/g,' ') || '—'}</span></div>
    <div class="setting-row"><span class="setting-lbl">Días entreno</span><span class="setting-val">${userProfile.training_days || '—'}</span></div>
    <div class="setting-row"><span class="setting-lbl">Split</span><span class="setting-val">${userProfile.training_split?.replace(/_/g,' ') || '—'}</span></div>
    <div class="setting-row"><span class="setting-lbl">Referentes</span><span class="setting-val">${userProfile.influencers?.join(', ') || '—'}</span></div>
    <div class="setting-row"><span class="setting-lbl">Kcal objetivo</span><span class="setting-val">${userProfile.target_kcal || '—'}</span></div>
    <div class="setting-row"><span class="setting-lbl">P / C / F</span><span class="setting-val">${userProfile.target_protein||'—'}g / ${userProfile.target_carbs||'—'}g / ${userProfile.target_fat||'—'}g</span></div>
    <button class="btn btn-ghost btn-sm" onclick="resetOnboard()" style="margin-top:16px">Reconfigurar perfil</button>
  `);
}

async function resetOnboard() {
  document.getElementById('modal').classList.remove('open');
  await sb.from('profiles').update({ onboarded: false }).eq('id', currentUser.id);
  userProfile.onboarded = false;
  showOnboarding();
}