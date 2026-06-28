import { OFFICIAL_MATCHES } from "./schedule.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCjydf-EE6Z_ZUZ0B48oQFha262sz9KJms",
  authDomain: "la-polla-del-loquito-2026.firebaseapp.com",
  projectId: "la-polla-del-loquito-2026",
  storageBucket: "la-polla-del-loquito-2026.firebasestorage.app",
  messagingSenderId: "891495833735",
  appId: "1:891495833735:web:cc94c249318be9e2851822",
  measurementId: "G-26Z5TPY2HD"
};
const ADMIN_EMAIL = "damaryfonsecaayala@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const C = {
  participants:"ko_participants",
  matches:"ko_matches",
  predictions:"ko_predictions",
  settings:"ko_settings"
};

let participants = [];
let matches = [];
let predictions = [];
let settings = {entryFee:5000, manualPool:"", firstPct:70, secondPct:20, thirdPct:10};
let isAdmin = false;
let showUpcomingOnly = false;
let drafts = {};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));

function flagImg(code,name){
  if(!code) return `<span class="flagFallback">${esc((name||"").slice(0,2).toUpperCase())}</span>`;
  return `<img class="flagImg" src="https://flagcdn.com/w40/${code}.png" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;flagFallback&quot;>${esc((name||'').slice(0,2).toUpperCase())}</span>'">`;
}
function matchLabel(m){
  return `${flagImg(m.flagCodeA,m.teamA)}<span>${esc(m.teamA)}</span><span class="vs">vs</span>${flagImg(m.flagCodeB,m.teamB)}<span>${esc(m.teamB)}</span>`;
}
function localDate(utc){
  return utc ? new Date(utc).toLocaleString("es-CL",{timeZone:"America/Santiago",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",", " ·") : "";
}
function closeDate(utc){
  return utc ? new Date(new Date(utc).getTime()-15*60000).toLocaleString("es-CL",{timeZone:"America/Santiago",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",", " ·") : "";
}
function isBetOpen(m){
  if(!m?.utc) return true;
  return new Date() < new Date(new Date(m.utc).getTime() - 15*60000);
}
function countdownText(utc){
  if(!utc) return "";
  const diff = new Date(utc) - new Date();
  if(diff <= 0) return "en juego o finalizado";
  const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), mm = Math.floor((diff%3600000)/60000);
  return d > 0 ? `${d} días · ${h} h · ${mm} min` : `${h} h · ${mm} min`;
}
function money(v){
  return Number(v||0).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0});
}
function effectivePool(){
  const manual = Number(settings.manualPool||0);
  return manual > 0 ? manual : participants.length * Number(settings.entryFee||0);
}
function pointsFor(pred,m){
  if(!m || m.realA==="" || m.realB==="" || m.realA==null || m.realB==null) return 0;
  return Number(pred.goalsA) === Number(m.realA) && Number(pred.goalsB) === Number(m.realB) ? 3 : 0;
}
function participantStats(pid){
  const ps = predictions.filter(p=>p.participantId===pid);
  let points=0, exact=0;
  ps.forEach(p=>{
    const m = matches.find(x=>x.id===p.matchId);
    const pts = pointsFor(p,m);
    points += pts;
    if(pts===3) exact++;
  });
  return {points, exact, count:ps.length, missing:Math.max(0,matches.length-ps.length)};
}
function sortedMatches(){
  return matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
}
function nextMatch(){
  const now = new Date();
  return matches.filter(m=>m.utc && new Date(m.utc)>=now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))[0];
}
function rememberDrafts(){
  const pid = $("bulkParticipant")?.value;
  if(!pid) return;
  document.querySelectorAll("[data-bulk-a]").forEach(i=>drafts[`${pid}_${i.dataset.bulkA}_A`]=i.value);
  document.querySelectorAll("[data-bulk-b]").forEach(i=>drafts[`${pid}_${i.dataset.bulkB}_B`]=i.value);
}

function renderAll(){
  rememberDrafts();
  fillSelects();
  renderRanking();
  renderParticipants();
  renderMatches();
  renderBulkPredictions();
  renderPredictions();
  renderPrize();
  renderNext();
}

function renderRanking(){
  const rows = participants.map(p=>({...p,...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name));
  $("rankingBody").innerHTML = rows.map((p,i)=>`
    <tr><td>${i+1}</td><td>${esc(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.exact}</td><td>${p.count}</td><td>${p.missing}</td></tr>
  `).join("") || `<tr><td colspan="6" class="muted">Aún no hay participantes.</td></tr>`;
  $("podium").innerHTML = rows.slice(0,3).map((p,i)=>`
    <div class="podiumCard">
      <div class="muted">${["🥇 1° lugar","🥈 2° lugar","🥉 3° lugar"][i]}</div>
      <strong>${esc(p.name)}</strong>
      <div>${p.points} puntos · ${p.exact} exactos</div>
    </div>
  `).join("");
}
function renderPrize(){
  const pool = effectivePool();
  const rows = participants.map(p=>({...p,...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name));
  const prizes = [
    ["🥇 1° lugar", settings.firstPct, rows[0]?.name || "Por definir"],
    ["🥈 2° lugar", settings.secondPct, rows[1]?.name || "Por definir"],
    ["🥉 3° lugar", settings.thirdPct, rows[2]?.name || "Por definir"]
  ];
  $("prizeBox").innerHTML = `<h3>💰 Premios / Pozo Segunda Fase</h3>
    <p><strong>Pozo actual:</strong> ${money(pool)} <span class="muted">· Participantes: ${participants.length} · Cuota: ${money(settings.entryFee)}</span></p>
    <div class="prizeGrid">${prizes.map(p=>`<div class="prizeCard"><div class="muted">${p[0]} · ${p[1]}%</div><strong>${esc(p[2])}</strong><div class="amount">${money(pool*Number(p[1]||0)/100)}</div></div>`).join("")}</div>`;
}
function renderNext(){
  const n = nextMatch();
  $("nextMatchHero").innerHTML = n ? `
    <h3>⏳ Próximo partido</h3>
    <div class="nextTeams"><div>${flagImg(n.flagCodeA,n.teamA)} ${esc(n.teamA)}</div><div class="nextVs">VS</div><div>${flagImg(n.flagCodeB,n.teamB)} ${esc(n.teamB)}</div></div>
    <div class="countdown">${countdownText(n.utc)}</div>
    <div><span class="metaPill">🇨🇱 ${localDate(n.utc)}</span><span class="metaPill">🔒 Cierre: ${closeDate(n.utc)}</span><span class="metaPill">${esc(n.group||"")}</span></div>
  ` : `<h3>🏁 No hay partidos futuros cargados.</h3>`;
}
function renderParticipants(){
  $("participantsBody").innerHTML = participants.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
    const st = participantStats(p.id);
    return `<tr><td>${esc(p.name)}</td><td>${st.count}</td><td class="adminOnly"><button onclick="deleteParticipant('${p.id}')">Eliminar</button></td></tr>`;
  }).join("") || `<tr><td colspan="3" class="muted">Aún no hay participantes.</td></tr>`;
}
function renderMatches(){
  const q = ($("matchSearch")?.value||"").toLowerCase();
  const ph = $("phaseFilter")?.value || "";
  let list = sortedMatches().filter(m => (!ph || m.group===ph) && (!q || `${m.teamA} ${m.teamB} ${m.group} ${m.venue}`.toLowerCase().includes(q)));
  if(showUpcomingOnly) list = list.filter(m=>m.utc && new Date(m.utc)>=new Date());
  $("matchesBody").innerHTML = list.map(m=>`
    <tr>
      <td>${m.matchNumber}</td>
      <td><span class="phasePill">${esc(m.group)}</span></td>
      <td>${matchLabel(m)}</td>
      <td>${localDate(m.utc)}</td>
      <td>${closeDate(m.utc)}</td>
      <td><strong>${m.realA!=="" && m.realB!=="" ? `${m.realA} - ${m.realB}` : "-"}</strong></td>
      <td class="adminOnly">
        <div class="grid">
          <input id="ta_${m.id}" value="${esc(m.teamA)}" placeholder="Equipo A"/>
          <input id="tb_${m.id}" value="${esc(m.teamB)}" placeholder="Equipo B"/>
          <input id="fa_${m.id}" value="${esc(m.flagCodeA||"")}" placeholder="Bandera A"/>
          <input id="fb_${m.id}" value="${esc(m.flagCodeB||"")}" placeholder="Bandera B"/>
          <input class="scoreInput" id="ra_${m.id}" value="${esc(m.realA??"")}" placeholder="A"/>
          <input class="scoreInput" id="rb_${m.id}" value="${esc(m.realB??"")}" placeholder="B"/>
          <button onclick="saveMatch('${m.id}')">Guardar</button>
        </div>
      </td>
    </tr>`).join("");
}
function fillSelects(){
  const bulk = $("bulkParticipant");
  const oldBulk = bulk?.value;
  if(bulk){
    bulk.innerHTML = participants.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
    if(oldBulk && participants.some(p=>p.id===oldBulk)) bulk.value = oldBulk;
  }

  const pm = $("predictionMatchFilter"), pp = $("predictionParticipantFilter"), mode = $("predictionViewMode");
  if(pm){
    const old = pm.value;
    pm.innerHTML = sortedMatches().map(m=>`<option value="${m.id}">#${m.matchNumber} · ${esc(m.teamA)} vs ${esc(m.teamB)} · ${localDate(m.utc)}</option>`).join("");
    const n = nextMatch();
    pm.value = old && matches.some(m=>m.id===old) ? old : (n?.id || matches[0]?.id || "");
  }
  if(pp){
    const old = pp.value;
    pp.innerHTML = participants.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
    if(old && participants.some(p=>p.id===old)) pp.value = old;
  }
  if(mode && pm && pp){
    const byMatch = mode.value !== "participant";
    pm.style.display = byMatch ? "" : "none";
    pp.style.display = byMatch ? "none" : "";
  }

  const pf = $("phaseFilter");
  if(pf){
    const old = pf.value;
    const phases = [...new Set(matches.map(m=>m.group).filter(Boolean))];
    pf.innerHTML = `<option value="">Todas las fases</option>` + phases.map(x=>`<option>${esc(x)}</option>`).join("");
    pf.value = old;
  }

  fillSettingsInputs();
}
function renderBulkPredictions(){
  const pid = $("bulkParticipant")?.value || participants[0]?.id;
  const body = $("bulkPredictionsBody");
  if(!body) return;
  if(!pid){ body.innerHTML = `<tr><td colspan="7" class="muted">Agrega participantes primero.</td></tr>`; return; }
  body.innerHTML = sortedMatches().map(m=>{
    const p = predictions.find(x=>x.participantId===pid && x.matchId===m.id);
    const open = isBetOpen(m);
    const aVal = drafts[`${pid}_${m.id}_A`] ?? p?.goalsA ?? "";
    const bVal = drafts[`${pid}_${m.id}_B`] ?? p?.goalsB ?? "";
    return `<tr>
      <td>${m.matchNumber}</td>
      <td><span class="phasePill">${esc(m.group)}</span></td>
      <td>${matchLabel(m)}</td>
      <td>${localDate(m.utc)}</td>
      <td>${open ? `<span class="open">Abierto</span>` : `<span class="locked">Cerrado</span>`}</td>
      <td><input ${open?"":"disabled"} data-bulk-a="${m.id}" class="scoreInput" value="${esc(aVal)}" placeholder="A"> - <input ${open?"":"disabled"} data-bulk-b="${m.id}" class="scoreInput" value="${esc(bVal)}" placeholder="B"></td>
      <td><button ${open?"":"disabled"} onclick="savePrediction('${pid}','${m.id}')">Guardar</button></td>
    </tr>`;
  }).join("");
}
function renderPredictions(){
  const mode = $("predictionViewMode")?.value || "match";
  let rows = predictions.slice();
  if(mode==="participant"){
    const pid = $("predictionParticipantFilter")?.value || participants[0]?.id;
    rows = rows.filter(p=>p.participantId===pid);
  }else{
    const mid = $("predictionMatchFilter")?.value || nextMatch()?.id;
    rows = rows.filter(p=>p.matchId===mid);
  }
  rows.sort((a,b)=>{
    const ma=matches.find(m=>m.id===a.matchId), mb=matches.find(m=>m.id===b.matchId);
    const pa=participants.find(p=>p.id===a.participantId), pb=participants.find(p=>p.id===b.participantId);
    return (ma?.matchNumber||999)-(mb?.matchNumber||999) || (pa?.name||"").localeCompare(pb?.name||"");
  });
  $("predictionsBody").innerHTML = rows.map(p=>{
    const u=participants.find(x=>x.id===p.participantId), m=matches.find(x=>x.id===p.matchId);
    return `<tr><td>${esc(u?.name||"")}</td><td>${m?matchLabel(m):""}</td><td>${m?localDate(m.utc):""}</td><td>${p.goalsA} - ${p.goalsB}</td><td><strong>${m?pointsFor(p,m):0}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">No hay apuestas para este filtro.</td></tr>`;
}

async function seedKnockout(){
  if(!isAdmin) return alert("Solo admin.");
  const ko = OFFICIAL_MATCHES.filter(m=>Number(m.matchNumber)>=73 && Number(m.matchNumber)<=104).map(m=>({
    ...m,
    sourceId:m.id,
    realA:m.realA ?? "",
    realB:m.realB ?? "",
    updatedAt: serverTimestamp()
  }));
  for(const m of ko){
    await setDoc(doc(db,C.matches,m.id), m, {merge:true});
  }
  alert(`Calendario eliminatorio cargado/actualizado: ${ko.length} partidos.`);
}
async function addParticipant(){
  if(!isAdmin) return alert("Solo admin.");
  const name = $("participantName").value.trim();
  if(!name) return;
  await addDoc(collection(db,C.participants), {name, createdAt:serverTimestamp()});
  $("participantName").value="";
}
window.deleteParticipant = async id => {
  if(!isAdmin) return;
  if(confirm("¿Eliminar participante? Sus apuestas no se borran automáticamente.")) await deleteDoc(doc(db,C.participants,id));
};
window.saveMatch = async id => {
  if(!isAdmin) return;
  await updateDoc(doc(db,C.matches,id), {
    teamA:$(`ta_${id}`).value.trim(),
    teamB:$(`tb_${id}`).value.trim(),
    flagCodeA:$(`fa_${id}`).value.trim(),
    flagCodeB:$(`fb_${id}`).value.trim(),
    realA:$(`ra_${id}`).value.trim(),
    realB:$(`rb_${id}`).value.trim(),
    updatedAt:serverTimestamp()
  });
};
window.savePrediction = async (pid,mid) => {
  if(!isAdmin) return alert("Solo admin.");
  const m = matches.find(x=>x.id===mid);
  if(!isBetOpen(m)) return alert("Este partido ya está cerrado para apuestas.");
  const a = document.querySelector(`[data-bulk-a="${mid}"]`)?.value.trim();
  const b = document.querySelector(`[data-bulk-b="${mid}"]`)?.value.trim();
  if(a==="" || b==="") return alert("Completa ambos marcadores.");
  await setDoc(doc(db,C.predictions,`${pid}_${mid}`), {participantId:pid, matchId:mid, goalsA:a, goalsB:b, updatedAt:serverTimestamp()});
};
async function saveAllOpenPredictions(){
  if(!isAdmin) return;
  const pid = $("bulkParticipant")?.value;
  if(!pid) return;
  let n=0;
  for(const m of sortedMatches()){
    if(!isBetOpen(m)) continue;
    const a = document.querySelector(`[data-bulk-a="${m.id}"]`)?.value.trim();
    const b = document.querySelector(`[data-bulk-b="${m.id}"]`)?.value.trim();
    if(a==="" || b==="") continue;
    await setDoc(doc(db,C.predictions,`${pid}_${m.id}`), {participantId:pid, matchId:m.id, goalsA:a, goalsB:b, updatedAt:serverTimestamp()});
    n++;
  }
  alert(`Apuestas guardadas: ${n}`);
}
function parseCsv(text){
  const lines = text.replace(/^\ufeff/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line=>{
    const parts = line.split(sep).map(x=>x.trim());
    const row = {};
    headers.forEach((h,i)=>row[h]=parts[i]??"");
    return row;
  });
}
async function getOrCreateParticipant(name){
  const clean = String(name||"").trim();
  if(!clean) throw new Error("Participante vacío");
  const found = participants.find(p=>p.name.toLowerCase()===clean.toLowerCase());
  if(found) return found.id;
  const ref = await addDoc(collection(db,C.participants), {name:clean, createdAt:serverTimestamp()});
  return ref.id;
}
async function importCsv(){
  if(!isAdmin) return alert("Solo admin.");
  const file = $("csvFile").files?.[0];
  if(!file) return alert("Selecciona un CSV.");
  const rows = parseCsv(await file.text());
  let ok=0, skipped=0;
  const cache={};
  for(const r of rows){
    const name = r.participante || r.nombre || "";
    const no = Number(r.partido_numero || r.partido || "");
    const a = (r.goles_a ?? r.a ?? "").toString().trim();
    const b = (r.goles_b ?? r.b ?? "").toString().trim();
    const m = matches.find(x=>Number(x.matchNumber)===no);
    if(!name || !m || a==="" || b==="" || !isBetOpen(m)){ skipped++; continue; }
    const key = name.toLowerCase();
    if(!cache[key]) cache[key] = await getOrCreateParticipant(name);
    await setDoc(doc(db,C.predictions,`${cache[key]}_${m.id}`), {participantId:cache[key], matchId:m.id, goalsA:a, goalsB:b, updatedAt:serverTimestamp()});
    ok++;
  }
  alert(`Importación lista.\nApuestas importadas: ${ok}\nFilas omitidas: ${skipped}`);
}
function downloadText(filename, text, type="text/plain"){
  const blob = new Blob([text], {type});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function downloadTemplate(){
  const lines = ["participante;partido_numero;goles_a;goles_b"];
  const name = participants[0]?.name || "Nombre participante";
  sortedMatches().forEach(m=>lines.push(`${name};${m.matchNumber};;`));
  downloadText("plantilla_segunda_fase.csv", "\ufeff"+lines.join("\n"), "text/csv;charset=utf-8");
}
function downloadBackup(){
  downloadText(`respaldo_segunda_fase_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({participants,matches,predictions,settings},null,2), "application/json");
}
function downloadPredictionsCsv(){
  const lines = ["participante;partido_numero;fase;equipo_a;equipo_b;goles_a;goles_b;puntos"];
  predictions.forEach(p=>{
    const u=participants.find(x=>x.id===p.participantId), m=matches.find(x=>x.id===p.matchId);
    if(m) lines.push(`${u?.name||""};${m.matchNumber};${m.group};${m.teamA};${m.teamB};${p.goalsA};${p.goalsB};${pointsFor(p,m)}`);
  });
  downloadText("apuestas_segunda_fase.csv", "\ufeff"+lines.join("\n"), "text/csv;charset=utf-8");
}
function fillSettingsInputs(){
  if(!$("entryFeeInput")) return;
  $("entryFeeInput").value = settings.entryFee ?? 5000;
  $("manualPoolInput").value = settings.manualPool ?? "";
  $("firstPctInput").value = settings.firstPct ?? 70;
  $("secondPctInput").value = settings.secondPct ?? 20;
  $("thirdPctInput").value = settings.thirdPct ?? 10;
}
async function saveSettings(){
  if(!isAdmin) return;
  const payload = {
    entryFee:Number($("entryFeeInput").value||5000),
    manualPool:$("manualPoolInput").value==="" ? "" : Number($("manualPoolInput").value||0),
    firstPct:Number($("firstPctInput").value||70),
    secondPct:Number($("secondPctInput").value||20),
    thirdPct:Number($("thirdPctInput").value||10),
    updatedAt:serverTimestamp()
  };
  settings = {...settings,...payload};
  await setDoc(doc(db,C.settings,"main"), payload, {merge:true});
  alert("Configuración guardada.");
}
function requireReset(){
  if($("resetConfirmInput").value.trim()!=="RESET"){ alert("Escribe RESET para confirmar."); return false; }
  return confirm("Acción irreversible. ¿Continuar?");
}
async function clearCollection(name, arr){
  await Promise.all(arr.map(x=>deleteDoc(doc(db,name,x.id))));
  return arr.length;
}
async function clearPredictions(){
  if(!isAdmin || !requireReset()) return;
  const n=await clearCollection(C.predictions,predictions);
  alert(`Apuestas borradas: ${n}`);
}
async function clearParticipants(){
  if(!isAdmin || !requireReset()) return;
  const n=await clearCollection(C.participants,participants);
  alert(`Participantes borrados: ${n}`);
}
async function clearResults(){
  if(!isAdmin || !requireReset()) return;
  await Promise.all(matches.map(m=>updateDoc(doc(db,C.matches,m.id),{realA:"",realB:""})));
  alert("Resultados limpiados.");
}
async function resetAll(){
  if(!isAdmin || !requireReset()) return;
  const p=await clearCollection(C.predictions,predictions);
  const u=await clearCollection(C.participants,participants);
  await Promise.all(matches.map(m=>updateDoc(doc(db,C.matches,m.id),{realA:"",realB:""})));
  alert(`Reset listo. Participantes: ${u}. Apuestas: ${p}.`);
}

document.querySelectorAll("nav button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(`view-${btn.dataset.view}`).classList.add("active");
  });
});

$("loginBtn")?.addEventListener("click", async ()=>{
  try{ await signInWithEmailAndPassword(auth,$("adminEmail").value.trim(),$("adminPass").value); }
  catch(e){ alert("No se pudo iniciar sesión: "+e.message); }
});
$("logoutBtn")?.addEventListener("click",()=>signOut(auth));
$("seedKoBtn")?.addEventListener("click",seedKnockout);
$("addParticipantBtn")?.addEventListener("click",addParticipant);
$("saveAllPredictionsBtn")?.addEventListener("click",saveAllOpenPredictions);
$("bulkParticipant")?.addEventListener("change",()=>{rememberDrafts(); renderBulkPredictions();});
$("matchSearch")?.addEventListener("input",renderMatches);
$("phaseFilter")?.addEventListener("change",renderMatches);
$("upcomingBtn")?.addEventListener("click",()=>{showUpcomingOnly=!showUpcomingOnly; renderMatches();});
$("downloadTemplateBtn")?.addEventListener("click",downloadTemplate);
$("importCsvBtn")?.addEventListener("click",importCsv);
$("predictionViewMode")?.addEventListener("change",()=>{fillSelects(); renderPredictions();});
$("predictionMatchFilter")?.addEventListener("change",renderPredictions);
$("predictionParticipantFilter")?.addEventListener("change",renderPredictions);
$("saveSettingsBtn")?.addEventListener("click",saveSettings);
$("downloadJsonBtn")?.addEventListener("click",downloadBackup);
$("downloadCsvBtn")?.addEventListener("click",downloadPredictionsCsv);
$("clearPredictionsBtn")?.addEventListener("click",clearPredictions);
$("clearParticipantsBtn")?.addEventListener("click",clearParticipants);
$("clearResultsBtn")?.addEventListener("click",clearResults);
$("resetAllBtn")?.addEventListener("click",resetAll);

onAuthStateChanged(auth,user=>{
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  document.body.classList.toggle("isAdmin",isAdmin);
});

onSnapshot(collection(db,C.participants), snap=>{participants=snap.docs.map(d=>({id:d.id,...d.data()})); renderAll();});
onSnapshot(collection(db,C.matches), snap=>{matches=snap.docs.map(d=>({id:d.id,...d.data()})); renderAll();});
onSnapshot(collection(db,C.predictions), snap=>{predictions=snap.docs.map(d=>({id:d.id,...d.data()})); renderAll();});
onSnapshot(doc(db,C.settings,"main"), snap=>{if(snap.exists()) settings={...settings,...snap.data()}; renderAll();});
