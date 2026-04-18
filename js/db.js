// ══════════════════════════════════════════════
//  DB HELPERS — Supabase + LS fallback
// ══════════════════════════════════════════════
async function dbGetScans() {
  if (!currentUser) return LS.get('scans', []);
  const { data, error } = await sb.from('scans').select('*').eq('user_id', currentUser.id).order('date', { ascending: true });
  if (error) return LS.get('scans', []);
  const mapped = (data || []).map(r => ({
    date: r.date, peso: r.peso, grasa: r.grasa, grasaKg: r.grasa_kg,
    musculo: r.musculo, agua: r.agua, aguaPct: r.agua_pct,
    aguaIntra: r.agua_intra, aguaExtra: r.agua_extra,
    hueso: r.hueso, visceral: r.visceral, tmb: r.tmb,
    edadMet: r.edad_met, imc: r.imc, score: r.score,
    masaMagra: r.masa_magra, phaseAngle: r.phase_angle, legScore: r.leg_score
  }));
  LS.set('scans', mapped);
  return mapped;
}

async function dbSaveScan(scan) {
  LS.set('scans', [...(LS.get('scans', [])).filter(s => s.date !== scan.date), scan].sort((a,b) => a.date.localeCompare(b.date)));
  if (!currentUser) return true;
  const row = {
    user_id: currentUser.id, date: scan.date,
    peso: scan.peso, grasa: scan.grasa, grasa_kg: scan.grasaKg,
    musculo: scan.musculo, agua: scan.agua, agua_pct: scan.aguaPct,
    agua_intra: scan.aguaIntra, agua_extra: scan.aguaExtra,
    hueso: scan.hueso, visceral: scan.visceral, tmb: scan.tmb,
    edad_met: scan.edadMet, imc: scan.imc, score: scan.score,
    masa_magra: scan.masaMagra, phase_angle: scan.phaseAngle, leg_score: scan.legScore
  };
  const { error } = await sb.from('scans').upsert(row, { onConflict: 'user_id,date' });
  setSyncStatus(!error);
  return !error;
}

async function dbGetLogs() {
  if (!currentUser) return LS.get('logs', []);
  const { data, error } = await sb.from('workout_logs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(100);
  if (error) return LS.get('logs', []);
  const mapped = (data || []).map(r => ({
    date: r.created_at, ex: r.exercise, w: r.weight_kg, r: r.reps,
    sets: r.sets, rpe: r.rpe, rest: r.rest_sec, notes: r.notes,
    checkin: r.checkin, sleep: r.sleep_h, energy: r.energy, stress: r.stress
  }));
  LS.set('logs', mapped);
  return mapped;
}

async function dbSaveLog(log) {
  const logs = LS.get('logs', []);
  logs.unshift(log);
  LS.set('logs', logs);
  if (!currentUser) return;
  const { error } = await sb.from('workout_logs').insert({
    user_id: currentUser.id, exercise: log.ex, weight_kg: log.w,
    reps: log.r, sets: log.sets, rpe: log.rpe, rest_sec: log.rest,
    notes: log.notes, checkin: log.checkin,
    sleep_h: log.sleep, energy: log.energy, stress: log.stress
  });
  setSyncStatus(!error);
}

async function dbGetFood() {
  const td = today();
  if (!currentUser) {
    const fl = LS.get('foodlog', { date: '', items: [] });
    return fl.date === td ? fl.items : [];
  }
  const { data, error } = await sb.from('food_logs').select('*').eq('user_id', currentUser.id).eq('log_date', td);
  if (error) return [];
  return (data || []).map(r => ({ id: r.id, name: r.food_name, qty: r.quantity_g, p: r.protein_g, c: r.carbs_g, f: r.fat_g, k: r.kcal, slot: r.meal_slot }));
}

async function dbSaveFood(item) {
  const td = today();
  const fl = LS.get('foodlog', { date: td, items: [] });
  if (fl.date !== td) fl.items = [];
  fl.date = td; fl.items.push(item);
  LS.set('foodlog', fl);
  if (!currentUser) return;
  const { error } = await sb.from('food_logs').insert({
    user_id: currentUser.id, log_date: td,
    food_name: item.name, quantity_g: item.qty,
    protein_g: item.p, carbs_g: item.c, fat_g: item.f, kcal: item.k,
    meal_slot: item.slot || 'other'
  });
  setSyncStatus(!error);
}

async function dbDeleteFoodItem(id) {
  if (id && currentUser) {
    await sb.from('food_logs').delete().eq('id', id).eq('user_id', currentUser.id);
  }
}

async function loadFoodItems() {
  const { data } = await sb.from('food_items').select('*').order('name');
  foodItemsCache = data || [];
}

async function addNewFoodItem() {
  const name = document.getElementById('new-food-name').value.trim();
  if (!name) { showToast('Introduce un nombre'); return; }
  const item = {
    name,
    protein_per100: parseFloat(document.getElementById('new-food-p').value) || 0,
    carbs_per100: parseFloat(document.getElementById('new-food-c').value) || 0,
    fat_per100: parseFloat(document.getElementById('new-food-f').value) || 0,
    kcal_per100: parseInt(document.getElementById('new-food-k').value) || 0,
    added_by: currentUser.id,
    is_global: true
  };
  const { error } = await sb.from('food_items').insert(item);
  if (error) { showToast('Error: ' + error.message); return; }
  showToast('Alimento añadido ✓ (compartido)');
  ['new-food-name','new-food-p','new-food-c','new-food-f','new-food-k'].forEach(id => document.getElementById(id).value = '');
  await loadFoodItems();
}
