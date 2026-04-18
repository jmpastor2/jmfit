// ════════════════════════════════════════════════
//  ATHLETES & DEFAULT_PLAN
// ════════════════════════════════════════════════
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

// Default plan (for José / muscle gain with arm specialization)
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

// ═══════════════════════════════════════════════
//  WORKOUT (user-specific or default)
// ════════════════════════════════════════════════
async function renderWorkout() {
  const now = new Date();
  document.getElementById('wo-date').textContent = fmtDate(now.toISOString());
  const todIdx = now.getDay()===0?6:now.getDay()-1;
  const plan = DEFAULT_PLAN; // TODO: load from routines table per user

  document.getElementById('today-banner').innerHTML = `
    <div class="tb-label">Hoy · ${plan[todIdx].day}</div>
    <div class="tb-title">${plan[todIdx].label}</div>
    <div class="tb-sub">${plan[todIdx].phil}</div>`;

  // Filter athletes by user's influencers if set
  const filteredAthletes = userProfile?.influencers?.length ? ATHLETES.filter(a => userProfile.influencers.some(inf => a.name.toLowerCase().includes(inf.toLowerCase().split(' ')[0]))) : ATHLETES;
  const showAthletes = filteredAthletes.length ? filteredAthletes : ATHLETES;

  document.getElementById('ath-scroll').innerHTML = showAthletes.map((a,i) => `
    <div class="ath-card" onclick="showAthlete(${ATHLETES.indexOf(a)})">
      <div class="ath-dot" style="background:${a.color}"></div>
      <div class="ath-name">${a.name}</div>
      <div class="ath-title">${a.title}</div>
      <div style="font-size:10px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${a.phil}</div>
    </div>`).join('');

  document.getElementById('wo-days').innerHTML = plan.map((day,i) => `
    <div class="day-card ${i===todIdx?'today':''}">
      <div class="day-hdr" onclick="toggleDay(this)">
        <span class="day-name">${day.day}${i===todIdx?' <span style="color:var(--acc1);font-size:10px">· HOY</span>':''}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="day-type t-${day.type}">${day.type.toUpperCase()}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${i===todIdx?'▾':'▸'}</span>
        </div>
      </div>
      <div class="day-body ${i===todIdx?'open':''}">
        ${day.ex.map((ex,j) => `
          <div class="ex-row">
            <span class="ex-n">${j+1}</span>
            <span class="ex-name">${ex.n}</span>
            ${ex.star?'<span class="ex-star">★</span>':''}
            <span class="ex-sets">${ex.s}</span>
            <a class="ex-yt" href="${ex.yt}" target="_blank">▶</a>
          </div>
          <div class="ex-cue">${ex.cue}</div>`).join('')}
      </div>
    </div>`).join('');
}

function toggleDay(hdr) { const b=hdr.nextElementSibling; b.classList.toggle('open'); hdr.querySelector('span:last-child').textContent=b.classList.contains('open')?'▾':'▸'; }

function showAthlete(i) {
  const a = ATHLETES[i];
  openModal(a.name, `
    <div style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-bottom:10px;letter-spacing:.12em;text-transform:uppercase">${a.title}</div>
    <p style="font-size:13px;line-height:1.7;margin-bottom:16px">${a.phil}</p>
    <div style="font-family:var(--mono);font-size:8px;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Principios clave</div>
    ${a.keys.map(k => `<div style="padding:8px 12px;background:var(--bg3);border-radius:8px;font-size:12px;margin-bottom:6px;border-left:2px solid ${a.color}">→ ${k}</div>`).join('')}
    <a href="${a.yt}" target="_blank" class="btn btn-ghost btn-sm" style="display:block;text-align:center;margin-top:14px;text-decoration:none">▶ Ver en YouTube</a>`);
}