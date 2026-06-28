import { OFFICIAL_MATCHES } from "./schedule.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, setDoc, getDocs, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
let isAdmin = false;
let showUpcomingOnly = false;
let predictionDrafts = {};
let prizeSettings = {entryFee:5000, manualPool:"", firstPct:70, secondPct:20, thirdPct:10};

const $ = id => document.getElementById(id);

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}
function flagImg(code,name){
  if(!code) return `<span class="flagFallback">${esc((name||"").slice(0,2).toUpperCase())}</span>`;
  return `<img class="flagImg" src="https://flagcdn.com/w40/${code}.png" alt="${esc(name)}" loading="lazy" onerror="this.outerHTML='<span class=&quot;flagFallback&quot;>${esc((name||'').slice(0,2).toUpperCase())}</span>'">`;
}
function matchLabel(m){
  return `${flagImg(m.flagCodeA,m.teamA)}<span class="flagText">${esc(m.teamA)}</span><span class="vs">vs</span>${flagImg(m.flagCodeB,m.teamB)}<span class="flagText">${esc(m.teamB)}</span>`;
}
function localDate(utc){
  return utc ? new Date(utc).toLocaleString("es-CL", {timeZone:"America/Santiago",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",", " ·") : "";
}
function closeDate(utc){
  return utc ? new Date(new Date(utc).getTime()-15*60000).toLocaleString("es-CL", {timeZone:"America/Santiago",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",", " ·") : "";
}
function isBetOpen(m){
  if(!m?.utc) return true;
  return new Date() < new Date(new Date(m.utc).getTime()-15*60000);
}
function countdownText(utc){
  if(!utc) return "";
  const diff = new Date(utc) - new Date();
  if(diff <= 0) return "en juego o finalizado";
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const mm = Math.floor((diff%3600000)/60000);
  return d > 0 ? `${d} días · ${h} h · ${mm} min` : `${h} h · ${mm} min`;
}
function money(v){
  return Number(v||0).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0});
}
function exactPoints(pred,match){
  if(!match || match.realA === "" || match.realB === "" || match.realA == null || match.realB == null) return 0;
  return Number(pred.goalsA) === Number(match.realA) && Number(pred.goalsB) === Number(match.realB) ? 3 : 0;
}
function participantStats(pid){
  const ps = predictions.filter(p => p.participantId === pid);
  let points = 0, exacts = 0;
  ps.forEach(p => {
    const m = matches.find(x => x.id === p.matchId);
    const pts = exactPoints(p,m);
    points += pts;
    if(pts === 3) exacts++;
  });
  return {count:ps.length, points, exacts, missing:Math.max(0,matches.length-ps.length)};
}
function sortedMatches(){
  return matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
}
function nextUpcomingMatch(){
  const now = new Date();
  return matches.filter(m => m.utc && new Date(m.utc) >= now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))[0];
}
function currentBulkParticipantId(){
  return $("bulkParticipant")?.value || participants[0]?.id || "";
}
function draftKey(pid,mid,side){ return `${pid}_${mid}_${side}`; }
function rememberDrafts(){
  const pid = currentBulkParticipantId();
  if(!pid) return;
  document.querySelectorAll("[data-bulk-a]").forEach(input => predictionDrafts[draftKey(pid,input.dataset.bulkA,"A")] = input.value);
  document.querySelectorAll("[data-bulk-b]").forEach(input => predictionDrafts[draftKey(pid,input.dataset.bulkB,"B")] = input.value);
}
function effectivePool(){
  const manual = Number(prizeSettings.manualPool||0);
  return manual > 0 ? manual : participants.length * Number(prizeSettings.entryFee||5000);
}

function renderAll(){
  rememberDrafts();
  renderRanking();
  renderParticipants();
  renderMatches();
  renderBulkPredictions();
  fillSelects();
  renderPredictions();
  renderNextMatch();
  renderPrize();
}

function renderRanking(){
  const rows = participants.map(p => ({...p, ...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exacts-a.exacts || a.name.localeCompare(b.name));
  $("rankingBody").innerHTML = rows.map((p,i)=>`
    <tr><td>${i+1}</td><td>${esc(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.exacts}</td><td>${p.count}</td><td>${p.missing}</td></tr>
  `).join("") || `<tr><td colspan="6" class="muted">Aún no hay participantes.</td></tr>`;

  $("podium").innerHTML = rows.slice(0,3).map((p,i)=>`
    <div class="podiumCard">
      <div class="muted">${["🥇 1° lugar","🥈 2° lugar","🥉 3° lugar"][i]}</div>
      <strong>${esc(p.name)}</strong>
      <div>${p.points} puntos · ${p.exacts} exactos</div>
    </div>
  `).join("");

  const totalPreds = predictions.length;
  const exacts = predictions.filter(p => {
    const m = matches.find(x=>x.id===p.matchId);
    return exactPoints(p,m) === 3;
  }).length;
  $("summaryCards").innerHTML = `
    <div class="infoCard"><div class="muted">Participantes</div><strong>${participants.length}</strong></div>
    <div class="infoCard"><div class="muted">Apuestas cargadas</div><strong>${totalPreds}</strong></div>
    <div class="infoCard"><div class="muted">Exactos</div><strong>${exacts}</strong></div>
  `;
}
function renderPrize(){
  const pool = effectivePool();
  const rows = participants.map(p => ({...p, ...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exacts-a.exacts || a.name.localeCompare(b.name));
  const prizes = [
    ["🥇 1° lugar", prizeSettings.firstPct, rows[0]?.name || "Por definir"],
    ["🥈 2° lugar", prizeSettings.secondPct, rows[1]?.name || "Por definir"],
    ["🥉 3° lugar", prizeSettings.thirdPct, rows[2]?.name || "Por definir"]
  ];
  $("prizeRankingBox").innerHTML = `<h3>💰 Premios / Pozo</h3>
    <p><strong>Pozo actual:</strong> ${money(pool)} <span class="muted">· Participantes: ${participants.length} · Cuota: ${money(prizeSettings.entryFee||5000)}</span></p>
    <div class="prizeGrid">${prizes.map(p=>`<div class="prizeCard"><div class="muted">${p[0]} · ${p[1]}%</div><strong>${esc(p[2])}</strong><div class="amount">${money(pool*Number(p[1]||0)/100)}</div></div>`).join("")}</div>`;
}
function renderNextMatch(){
  const n = nextUpcomingMatch();
  const html = n ? `
    <h3>⏳ Próximo partido</h3>
    <div class="nextTeams">
      <div class="nextTeam">${flagImg(n.flagCodeA,n.teamA)} ${esc(n.teamA)}</div>
      <div class="nextVs">VS</div>
      <div class="nextTeam">${flagImg(n.flagCodeB,n.teamB)} ${esc(n.teamB)}</div>
    </div>
    <div class="countdown">${countdownText(n.utc)}</div>
    <div class="matchMeta">
      <span class="metaPill">🇨🇱 ${localDate(n.utc)}</span>
      <span class="metaPill">🔒 Cierre: ${closeDate(n.utc)}</span>
      <span class="metaPill">🏟️ ${esc(n.venue||"")}</span>
      <span class="metaPill">🏷️ ${esc(n.group||"")}</span>
    </div>
  ` : `<h3>🏁 No hay partidos futuros cargados</h3>`;
  if($("nextMatchHero")) $("nextMatchHero").innerHTML = html;
  if($("nextMatchBox")) $("nextMatchBox").innerHTML = html;
}
function renderParticipants(){
  $("participantsBody").innerHTML = participants.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p => `
    <tr><td>${esc(p.name)}</td><td>${participantStats(p.id).count}</td>
    <td class="adminOnly"><button class="danger" data-del-participant="${p.id}">Eliminar</button></td></tr>
  `).join("") || `<tr><td colspan="3" class="muted">Aún no hay participantes.</td></tr>`;
  document.querySelectorAll("[data-del-participant]").forEach(btn => {
    btn.onclick = async () => {
      if(!isAdmin) return alert("Solo admin.");
      if(confirm("¿Eliminar participante?")) await deleteDoc(doc(db,C.participants,btn.dataset.delParticipant));
    };
  });
}
function filteredMatches(){
  const q = ($("matchSearch")?.value || "").toLowerCase();
  const ph = $("phaseFilter")?.value || "";
  const now = new Date();
  return sortedMatches().filter(m => {
    const blob = `${m.group} ${m.teamA} ${m.teamB} ${m.venue}`.toLowerCase();
    return (!q || blob.includes(q)) && (!ph || m.group === ph) && (!showUpcomingOnly || (m.utc && new Date(m.utc) >= now));
  });
}
function renderMatches(){
  const body = $("matchesBody");
  if(!body) return;
  body.innerHTML = filteredMatches().map(m => `
    <tr>
      <td>${m.matchNumber ?? ""}</td>
      <td><span class="chip">${esc(m.group||"")}</span></td>
      <td><div class="matchTitle">${matchLabel(m)}</div></td>
      <td><strong>🇨🇱 ${localDate(m.utc)}</strong></td>
      <td><span class="${isBetOpen(m) ? "statusOpen" : "statusClosed"}">${closeDate(m.utc)}</span></td>
      <td><div class="venue">🏟️ ${esc(m.venue||"")}</div></td>
      <td><strong>${m.realA ?? ""} - ${m.realB ?? ""}</strong></td>
      <td class="adminOnly">
        <input type="number" min="0" value="${m.realA ?? ""}" data-real-a="${m.id}" style="width:70px">
        <input type="number" min="0" value="${m.realB ?? ""}" data-real-b="${m.id}" style="width:70px">
        <button data-save-result="${m.id}">Guardar</button>
        <button data-clear-result="${m.id}">Limpiar</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" class="muted">Carga el calendario de segunda fase desde Admin/Partidos.</td></tr>`;

  document.querySelectorAll("[data-save-result]").forEach(btn => {
    btn.onclick = async () => {
      if(!isAdmin) return;
      const id = btn.dataset.saveResult;
      await updateDoc(doc(db,C.matches,id), {
        realA: document.querySelector(`[data-real-a="${id}"]`).value,
        realB: document.querySelector(`[data-real-b="${id}"]`).value
      });
      await refreshAfterWrite();
    };
  });
  document.querySelectorAll("[data-clear-result]").forEach(btn => {
    btn.onclick = async () => {
      if(!isAdmin) return;
      await updateDoc(doc(db,C.matches,btn.dataset.clearResult), {realA:"", realB:""});
      await refreshAfterWrite();
    };
  });
}
function fillSelects(){
  const bulk = $("bulkParticipant");
  const oldBulk = bulk?.value;
  if(bulk){
    bulk.innerHTML = participants.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
    if(oldBulk && participants.some(p=>p.id===oldBulk)) bulk.value = oldBulk;
  }

  const phase = $("phaseFilter");
  if(phase){
    const old = phase.value;
    const phases = [...new Set(matches.map(m=>m.group).filter(Boolean))];
    phase.innerHTML = `<option value="">Todas las fases</option>` + phases.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");
    phase.value = old;
  }

  const mode = $("predictionViewMode"), ms = $("predictionMatchFilter"), ps = $("predictionParticipantFilter");
  if(ms){
    const old = ms.value;
    const n = nextUpcomingMatch();
    ms.innerHTML = sortedMatches().map(m=>`<option value="${m.id}">#${m.matchNumber} · ${esc(m.teamA)} vs ${esc(m.teamB)} · ${localDate(m.utc)}</option>`).join("");
    ms.value = old && matches.some(m=>m.id===old) ? old : (n?.id || matches[0]?.id || "");
  }
  if(ps){
    const old = ps.value;
    ps.innerHTML = participants.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
    if(old && participants.some(p=>p.id===old)) ps.value = old;
  }
  if(mode && ms && ps){
    const byMatch = mode.value !== "participant";
    ms.style.display = byMatch ? "" : "none";
    ps.style.display = byMatch ? "none" : "";
  }

  if($("entryFeeInput")){
    $("entryFeeInput").value = prizeSettings.entryFee ?? 5000;
    $("manualPoolInput").value = prizeSettings.manualPool ?? "";
    $("firstPctInput").value = prizeSettings.firstPct ?? 70;
    $("secondPctInput").value = prizeSettings.secondPct ?? 20;
    $("thirdPctInput").value = prizeSettings.thirdPct ?? 10;
  }
}
function renderBulkPredictions(){
  const body = $("bulkPredictionsBody");
  if(!body) return;
  const pid = currentBulkParticipantId();
  if(!pid){
    body.innerHTML = `<tr><td colspan="7" class="muted">Agrega participantes primero.</td></tr>`;
    return;
  }
  const existing = Object.fromEntries(predictions.filter(p=>p.participantId===pid).map(p=>[p.matchId,p]));
  body.innerHTML = sortedMatches().map(m => {
    const p = existing[m.id] || {};
    const valA = predictionDrafts[draftKey(pid,m.id,"A")] ?? p.goalsA ?? "";
    const valB = predictionDrafts[draftKey(pid,m.id,"B")] ?? p.goalsB ?? "";
    const open = isBetOpen(m);
    return `<tr>
      <td>${m.matchNumber}</td>
      <td><span class="chip">${esc(m.group||"")}</span></td>
      <td>${matchLabel(m)}</td>
      <td>${localDate(m.utc)}</td>
      <td>${open ? `<span class="statusOpen">Abierto</span>` : `<span class="statusClosed">Cerrado</span>`}</td>
      <td>
        <div class="predScore">
          <input class="scoreInput" type="number" min="0" ${open ? "" : "disabled"} value="${esc(valA)}" data-bulk-a="${m.id}" placeholder="A">
          <span class="smallVs">-</span>
          <input class="scoreInput" type="number" min="0" ${open ? "" : "disabled"} value="${esc(valB)}" data-bulk-b="${m.id}" placeholder="B">
        </div>
      </td>
      <td><button ${open ? "" : "disabled"} data-save-pred="${m.id}">Guardar</button><span class="savedHint" data-saved-hint="${m.id}"></span></td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-bulk-a]").forEach(input => input.addEventListener("input",()=>predictionDrafts[draftKey(pid,input.dataset.bulkA,"A")] = input.value));
  document.querySelectorAll("[data-bulk-b]").forEach(input => input.addEventListener("input",()=>predictionDrafts[draftKey(pid,input.dataset.bulkB,"B")] = input.value));
  document.querySelectorAll("[data-save-pred]").forEach(btn => btn.onclick = () => saveOnePrediction(pid,btn.dataset.savePred));
}
function renderPredictions(){
  const mode = $("predictionViewMode")?.value || "match";
  let rows = predictions.slice();
  if(mode === "participant"){
    const pid = $("predictionParticipantFilter")?.value || participants[0]?.id || "";
    rows = rows.filter(p=>p.participantId===pid);
  }else{
    const mid = $("predictionMatchFilter")?.value || nextUpcomingMatch()?.id || "";
    rows = rows.filter(p=>p.matchId===mid);
  }
  rows.sort((a,b)=>{
    const ma=matches.find(m=>m.id===a.matchId), mb=matches.find(m=>m.id===b.matchId);
    const pa=participants.find(p=>p.id===a.participantId), pb=participants.find(p=>p.id===b.participantId);
    return (ma?.matchNumber||999)-(mb?.matchNumber||999) || (pa?.name||"").localeCompare(pb?.name||"");
  });
  $("predictionsBody").innerHTML = rows.map(p=>{
    const u=participants.find(x=>x.id===p.participantId), m=matches.find(x=>x.id===p.matchId);
    return `<tr><td>${esc(u?.name||"")}</td><td>${m?matchLabel(m):""}</td><td>${m?localDate(m.utc):""}</td><td>${p.goalsA} - ${p.goalsB}</td><td><strong>${m?exactPoints(p,m):0}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">No hay apuestas para este filtro.</td></tr>`;
}

async function seedSchedule(){
  if(!isAdmin) return alert("Solo admin.");
  const ko = OFFICIAL_MATCHES.filter(m => Number(m.matchNumber) >= 73 && Number(m.matchNumber) <= 104);
  for(const m of ko){
    await setDoc(doc(db,C.matches,m.id), {...m, sourceId:m.id, updatedAt:serverTimestamp()}, {merge:true});
  }
  await refreshAfterWrite();
  alert(`Calendario segunda fase cargado/actualizado: ${ko.length} partidos.`);
}
async function addParticipant(){
  if(!isAdmin) return alert("Solo admin.");
  const name = $("participantName").value.trim();
  if(!name) return;
  await addDoc(collection(db,C.participants), {name, createdAt:serverTimestamp()});
  $("participantName").value = "";
  await refreshAfterWrite();
}
async function saveOnePrediction(pid,mid){
  if(!isAdmin) return alert("Solo admin.");
  const m = matches.find(x=>x.id===mid);
  if(!isBetOpen(m)) return alert("Este partido ya está cerrado para apuestas.");
  const a = document.querySelector(`[data-bulk-a="${mid}"]`)?.value.trim();
  const b = document.querySelector(`[data-bulk-b="${mid}"]`)?.value.trim();
  if(a==="" || b==="") return alert("Completa ambos marcadores.");
  await setDoc(doc(db,C.predictions,`${pid}_${mid}`), {participantId:pid, matchId:mid, goalsA:a, goalsB:b, updatedAt:serverTimestamp()});
  const hint = document.querySelector(`[data-saved-hint="${mid}"]`);
  if(hint) hint.textContent = "Guardado ✅";
  await refreshAfterWrite();
}
async function saveAllPredictions(){
  if(!isAdmin) return;
  const pid = currentBulkParticipantId();
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
  await refreshAfterWrite();
  alert(`Apuestas guardadas: ${n}`);
}
function parseCsv(text){
  const lines = text.replace(/^\ufeff/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const parts = line.split(sep).map(x=>x.trim());
    const row = {};
    headers.forEach((h,i)=>row[h]=parts[i] ?? "");
    return row;
  });
}
async function getOrCreateParticipant(name){
  const clean = String(name||"").trim();
  const found = participants.find(p=>p.name.toLowerCase()===clean.toLowerCase());
  if(found) return found.id;
  const ref = await addDoc(collection(db,C.participants), {name:clean, createdAt:serverTimestamp()});
  return ref.id;
}
async function importCsv(){
  if(!isAdmin) return alert("Solo admin.");
  const file = $("csvPredFile").files?.[0];
  if(!file) return alert("Selecciona un CSV.");
  const rows = parseCsv(await file.text());
  const cache = {};
  let ok=0, skipped=0;
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
  await refreshAfterWrite();
  alert(`Importación lista.\nApuestas importadas: ${ok}\nFilas omitidas: ${skipped}`);
}
function downloadText(filename,text,type="text/plain"){
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
  sortedMatches().forEach(m => lines.push(`${name};${m.matchNumber};;`));
  downloadText("plantilla_segunda_fase.csv", "\ufeff"+lines.join("\n"), "text/csv;charset=utf-8");
}
function downloadBackup(){
  downloadText(`respaldo_segunda_fase_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({participants,matches,predictions,prizeSettings},null,2), "application/json");
}
function downloadPredictionsCsv(){
  const lines = ["participante;partido_numero;fase;equipo_a;equipo_b;goles_a;goles_b;puntos"];
  predictions.forEach(p => {
    const u=participants.find(x=>x.id===p.participantId), m=matches.find(x=>x.id===p.matchId);
    if(m) lines.push(`${u?.name||""};${m.matchNumber};${m.group};${m.teamA};${m.teamB};${p.goalsA};${p.goalsB};${exactPoints(p,m)}`);
  });
  downloadText("apuestas_segunda_fase.csv", "\ufeff"+lines.join("\n"), "text/csv;charset=utf-8");
}
async function savePrizeSettings(){
  if(!isAdmin) return;
  const payload = {
    entryFee:Number($("entryFeeInput").value||5000),
    manualPool:$("manualPoolInput").value==="" ? "" : Number($("manualPoolInput").value||0),
    firstPct:Number($("firstPctInput").value||70),
    secondPct:Number($("secondPctInput").value||20),
    thirdPct:Number($("thirdPctInput").value||10),
    updatedAt:serverTimestamp()
  };
  prizeSettings = {...prizeSettings,...payload};
  await setDoc(doc(db,C.settings,"prizes"), payload, {merge:true});
  await refreshAfterWrite();
  alert("Premios guardados ✅");
}
function requireReset(){
  if($("resetConfirmInput").value.trim() !== "RESET"){ alert("Escribe RESET para confirmar."); return false; }
  return confirm("Acción irreversible. ¿Continuar?");
}
async function clearCollection(name,arr){
  await Promise.all(arr.map(x=>deleteDoc(doc(db,name,x.id))));
}
async function clearPredictions(){ if(isAdmin && requireReset()){ await clearCollection(C.predictions,predictions); await refreshAfterWrite();
  alert("Apuestas borradas."); } }
async function clearParticipants(){ if(isAdmin && requireReset()){ await clearCollection(C.participants,participants); await refreshAfterWrite();
  alert("Participantes borrados."); } }
async function clearResults(){ if(isAdmin && requireReset()){ await Promise.all(matches.map(m=>updateDoc(doc(db,C.matches,m.id),{realA:"",realB:""}))); await refreshAfterWrite();
  alert("Resultados limpiados."); } }
async function resetAll(){ if(isAdmin && requireReset()){ await clearCollection(C.predictions,predictions); await clearCollection(C.participants,participants); await Promise.all(matches.map(m=>updateDoc(doc(db,C.matches,m.id),{realA:"",realB:""}))); await refreshAfterWrite();
  alert("Reset segunda fase listo."); } }

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(`view-${btn.dataset.view}`).classList.add("active");
  });
});

$("loginBtn")?.addEventListener("click", async () => {
  try{ await signInWithEmailAndPassword(auth,$("adminEmail").value.trim(),$("adminPass").value); }
  catch(e){ alert("No se pudo iniciar sesión: "+e.message); }
});
$("logoutBtn")?.addEventListener("click",()=>signOut(auth));
$("seedScheduleBtn")?.addEventListener("click",seedSchedule);
$("addParticipantBtn")?.addEventListener("click",addParticipant);
$("saveAllPredictionsBtn")?.addEventListener("click",saveAllPredictions);
$("bulkParticipant")?.addEventListener("change",()=>{rememberDrafts(); renderBulkPredictions();});
$("matchSearch")?.addEventListener("input",renderMatches);
$("phaseFilter")?.addEventListener("change",renderMatches);
$("upcomingBtn")?.addEventListener("click",()=>{showUpcomingOnly=!showUpcomingOnly; renderMatches();});
$("downloadPredTemplateBtn")?.addEventListener("click",downloadTemplate);
$("importPredCsvBtn")?.addEventListener("click",importCsv);
$("predictionViewMode")?.addEventListener("change",()=>{fillSelects(); renderPredictions();});
$("predictionMatchFilter")?.addEventListener("change",renderPredictions);
$("predictionParticipantFilter")?.addEventListener("change",renderPredictions);
$("savePrizeSettingsBtn")?.addEventListener("click",savePrizeSettings);
$("refreshDataBtn")?.addEventListener("click",loadAllData);
$("downloadJsonBtn")?.addEventListener("click",downloadBackup);
$("downloadCsvBtn")?.addEventListener("click",downloadPredictionsCsv);
$("clearPredictionsBtn")?.addEventListener("click",clearPredictions);
$("clearParticipantsBtn")?.addEventListener("click",clearParticipants);
$("clearResultsBtn")?.addEventListener("click",clearResults);
$("resetAllBtn")?.addEventListener("click",resetAll);


async function loadAllData(){
  const [participantsSnap, matchesSnap, predictionsSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db,C.participants)),
    getDocs(collection(db,C.matches)),
    getDocs(collection(db,C.predictions)),
    getDoc(doc(db,C.settings,"prizes"))
  ]);
  participants = participantsSnap.docs.map(d=>({id:d.id,...d.data()}));
  matches = matchesSnap.docs.map(d=>({id:d.id,...d.data()}));
  predictions = predictionsSnap.docs.map(d=>({id:d.id,...d.data()}));
  if(settingsSnap.exists()) prizeSettings = {...prizeSettings,...settingsSnap.data()};
  renderAll();
}
async function refreshAfterWrite(){
  await loadAllData();
}

onAuthStateChanged(auth, user => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  document.body.classList.toggle("isAdmin",isAdmin);
});
loadAllData();