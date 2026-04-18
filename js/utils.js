// ════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(iso) {
  const d = new Date(iso);
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const mos = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${mos[d.getMonth()]} ${d.getFullYear()}`;
}
function calcAge(dob) { if (!dob) return null; const d = new Date(dob); const a = new Date().getFullYear() - d.getFullYear(); return a; }
function showToast(m) { const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); }
function closeModal(e) { if (e.target === document.getElementById('modal')) document.getElementById('modal').classList.remove('open'); }
function openModal(title, html) { document.getElementById('modal-title').textContent = title; document.getElementById('modal-body').innerHTML = html; document.getElementById('modal').classList.add('open'); }
function setSyncStatus(ok) { const d = document.getElementById('sync-dot'); const t = document.getElementById('sync-txt'); if (!d) return; d.className = 'sync-dot '+(ok?'sync-ok':'sync-err'); t.textContent = ok?'sync':'error'; }
function setCi(v, btn) { _ci = v; document.querySelectorAll('#ci-opts .ci-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }