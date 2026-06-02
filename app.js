import { OFFICIAL_MATCHES } from "./schedule.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

let participants = [];
let matches = [];
let predictions = [];
let isAdmin = false;
let showUpcomingOnly = false;

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
  return utc ? new Date(utc).toLocaleString("es-CL", {
    timeZone:"America/Santiago", weekday:"short", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"
  }).replace(",", " ·") : "";
}
function winner(a,b){
  if(a === "" || b === "" || a == null || b == null) return "";
  a = Number(a); b = Number(b);
  if(a > b) return "A";
  if(b > a) return "B";
  return "E";
}
function pointsFor(pred,match){
  if(!match || match.realA === "" || match.realB === "" || match.realA == null || match.realB == null) return 0;
  if(Number(pred.goalsA) === Number(match.realA) && Number(pred.goalsB) === Number(match.realB)) return 3;
  return winner(pred.goalsA,pred.goalsB) === winner(match.realA,match.realB) ? 1 : 0;
}
function participantStats(pid){
  const ps = predictions.filter(p => p.participantId === pid);
  let points = 0;
  ps.forEach(p => points += pointsFor(p, matches.find(m => m.id === p.matchId)));
  return { count: ps.length, points };
}
function nextUpcomingMatch(){
  const now = new Date();
  return matches.filter(m => m.utc && new Date(m.utc) >= now).sort((a,b)=>new Date(a.utc)-new Date(b.utc))[0];
}
function countdownText(utc){
  if(!utc) return "";
  const diff = new Date(utc) - new Date();
  if(diff <= 0) return "en juego o finalizado";
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const m = Math.floor((diff%3600000)/60000);
  return d > 0 ? `${d} días · ${h} h · ${m} min` : `${h} h · ${m} min`;
}
function isSoon(m){
  if(!m?.utc) return false;
  const diff = new Date(m.utc) - new Date();
  return diff > 0 && diff <= 48*3600000;
}
function groupRemaining(){
  return matches.filter(m => (m.group||"").startsWith("Grupo") && (m.realA==="" || m.realB==="" || m.realA==null || m.realB==null)).length;
}
function lastResult(){
  return matches.filter(m => m.realA!=="" && m.realB!=="" && m.realA!=null && m.realB!=null).sort((a,b)=>(b.matchNumber||0)-(a.matchNumber||0))[0];
}

function renderAll(){
  renderRanking();
  renderParticipants();
  renderMatches();
  renderPredictions();
  renderBulkPredictions();
  renderTeams();
  fillSelects();
  fillPhaseFilter();
  renderNextMatch();
}

function renderRanking(){
  const rows = participants.map(p => ({...p, ...participantStats(p.id)}))
    .sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));
  $("rankingBody").innerHTML = rows.map((p,i)=>`
    <tr><td>${i+1}</td><td>${esc(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.count}</td></tr>
  `).join("");
  $("podium").innerHTML = rows.slice(0,3).map((p,i)=>`
    <div class="podiumCard">
      <div class="muted">${["🥇 1° lugar","🥈 2° lugar","🥉 3° lugar"][i]}</div>
      <strong>${esc(p.name)}</strong>
      <div>${p.points} puntos</div>
    </div>
  `).join("");
}
function renderNextMatch(){
  const n = nextUpcomingMatch();
  const last = lastResult();
  const nextHtml = n ? `
    <h3>${isSoon(n) ? "🔥 Próximo partido en menos de 48 h" : "⏳ Próximo partido"}</h3>
    <div class="nextTeams">
      <div class="nextTeam">${flagImg(n.flagCodeA,n.teamA)} ${esc(n.teamA)}</div>
      <div class="nextVs">VS</div>
      <div class="nextTeam">${flagImg(n.flagCodeB,n.teamB)} ${esc(n.teamB)}</div>
    </div>
    <div class="countdown">${countdownText(n.utc)}</div>
    <div class="matchMeta">
      <span class="metaPill">🇨🇱 ${localDate(n.utc)}</span>
      <span class="metaPill">🏟️ ${esc(n.venue||"")}</span>
      <span class="metaPill">🏷️ ${esc(n.group||"")}</span>
    </div>
  ` : `<h3>🏁 No hay partidos futuros cargados</h3>`;

  const summary = `
    <div class="infoCard"><div class="muted">Fase de grupos pendiente</div><strong>${groupRemaining()}</strong><div>partidos sin resultado</div></div>
    <div class="infoCard"><div class="muted">Último resultado ingresado</div>${
      last ? `<div>${matchLabel(last)}</div><div class="lastResultScore">${last.realA} - ${last.realB}</div>` : `<div>Aún no hay resultados cargados.</div>`
    }</div>
  `;
  if($("nextMatchHero")) $("nextMatchHero").innerHTML = nextHtml;
  if($("nextMatchBox")) $("nextMatchBox").innerHTML = nextHtml;
  if($("summaryCards")) $("summaryCards").innerHTML = summary;
}
function renderParticipants(){
  $("participantsBody").innerHTML = participants.map(p => `
    <tr><td>${esc(p.name)}</td><td>${participantStats(p.id).count}</td>
    <td class="adminOnly"><button class="danger" data-del-participant="${p.id}">Eliminar</button></td></tr>
  `).join("");
  document.querySelectorAll("[data-del-participant]").forEach(btn => {
    btn.onclick = async () => {
      if(!isAdmin) return alert("Solo admin.");
      if(confirm("¿Eliminar participante?")) await deleteDoc(doc(db,"participants",btn.dataset.delParticipant));
    };
  });
}
function fillPhaseFilter(){
  const sel = $("phaseFilter");
  if(!sel) return;
  const current = sel.value;
  const phases = [...new Set(matches.map(m => m.group).filter(Boolean))];
  sel.innerHTML = `<option value="">Todas las fases</option>` + phases.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  sel.value = current;
}
function filteredMatches(){
  const q = ($("matchSearch")?.value || "").toLowerCase();
  const ph = $("phaseFilter")?.value || "";
  const now = new Date();
  return matches.filter(m => {
    const blob = `${m.group} ${m.teamA} ${m.teamB} ${m.venue}`.toLowerCase();
    return (!q || blob.includes(q)) && (!ph || m.group === ph) && (!showUpcomingOnly || (m.utc && new Date(m.utc) >= now));
  }).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
}
function renderMatches(){
  $("matchesBody").innerHTML = filteredMatches().map(m => `
    <tr class="${isSoon(m) ? "upcomingRow liveSoon" : ""}">
      <td>${m.matchNumber ?? ""}</td>
      <td><span class="chip">${esc(m.group||"")}</span></td>
      <td><div class="matchTitle">${matchLabel(m)}</div><div class="muted">${esc(m.noteA || m.noteB || "")}</div></td>
      <td><strong>🇨🇱 ${localDate(m.utc)}</strong></td>
      <td><div class="venue">🏟️ ${esc(m.venue||"")}</div></td>
      <td><strong>${m.realA ?? ""} - ${m.realB ?? ""}</strong></td>
      <td class="adminOnly">
        <input type="number" min="0" value="${m.realA ?? ""}" data-real-a="${m.id}" style="width:70px">
        <input type="number" min="0" value="${m.realB ?? ""}" data-real-b="${m.id}" style="width:70px">
        <button data-save-result="${m.id}">Guardar</button>
        <button class="danger" data-del-match="${m.id}">Eliminar</button>
      </td>
    </tr>
  `).join("");
  document.querySelectorAll("[data-save-result]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.saveResult;
      await updateDoc(doc(db,"matches",id), {
        realA: document.querySelector(`[data-real-a="${id}"]`).value,
        realB: document.querySelector(`[data-real-b="${id}"]`).value
      });
    };
  });
  document.querySelectorAll("[data-del-match]").forEach(btn => {
    btn.onclick = async () => {
      if(confirm("¿Eliminar partido?")) await deleteDoc(doc(db,"matches",btn.dataset.delMatch));
    };
  });
}
function renderPredictions(){
  const selected = $("viewParticipant")?.value || "";
  const rows = predictions.filter(p => !selected || p.participantId === selected)
    .sort((a,b)=>{
      const ma = matches.find(m=>m.id===a.matchId);
      const mb = matches.find(m=>m.id===b.matchId);
      return (ma?.matchNumber||999)-(mb?.matchNumber||999);
    });
  $("predictionsBody").innerHTML = rows.map(p => {
    const participant = participants.find(x=>x.id===p.participantId);
    const match = matches.find(x=>x.id===p.matchId);
    if(!participant || !match) return "";
    return `<tr><td>${esc(participant.name)}</td><td>${matchLabel(match)}</td><td>${localDate(match.utc)}</td><td><strong>${p.goalsA} - ${p.goalsB}</strong></td><td>${pointsFor(p,match)}</td></tr>`;
  }).join("");
}
function renderBulkPredictions(){
  const body = $("bulkPredictionsBody");
  if(!body) return;
  const pid = $("bulkParticipant")?.value || participants[0]?.id || "";
  const existing = Object.fromEntries(predictions.filter(p=>p.participantId===pid).map(p=>[p.matchId,p]));
  body.innerHTML = matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m => {
    const p = existing[m.id] || {};
    return `<tr>
      <td>${m.matchNumber ?? ""}</td>
      <td><span class="chip">${esc(m.group||"")}</span></td>
      <td>${matchLabel(m)}</td>
      <td>${localDate(m.utc)}</td>
      <td><div class="predScore"><input type="number" min="0" value="${p.goalsA ?? ""}" placeholder="A" data-bulk-a="${m.id}"><span class="smallVs">-</span><input type="number" min="0" value="${p.goalsB ?? ""}" placeholder="B" data-bulk-b="${m.id}"></div></td>
    </tr>`;
  }).join("");
}
function renderTeams(){
  const teams = {};
  matches.forEach(m => [[m.teamA,m.flagCodeA,m.noteA],[m.teamB,m.flagCodeB,m.noteB]].forEach(([name,code,note])=>{
    if(!name || name.includes("Grupo") || name.includes("Ganador") || name.includes("Perdedor") || name.includes("partido")) return;
    if(!teams[name]) teams[name] = {name, code, note, games:0};
    teams[name].games++;
    if(!teams[name].note) teams[name].note = note;
  }));
  $("teamsGrid").innerHTML = Object.values(teams).sort((a,b)=>a.name.localeCompare(b.name)).map(t => `
    <div class="teamCard"><div class="bigFlag">${flagImg(t.code,t.name)}</div><h3>${esc(t.name)}</h3><div class="muted">${t.games} partidos cargados</div><p>${esc(t.note || "Participante del Mundial 2026.")}</p></div>
  `).join("");
}
function fillSelects(){
  const participantOptions = participants.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const bulk = $("bulkParticipant");
  if(bulk){
    const old = bulk.value;
    bulk.innerHTML = participantOptions;
    if(old) bulk.value = old;
  }
  const view = $("viewParticipant");
  if(view){
    const old = view.value;
    view.innerHTML = `<option value="">Todos los participantes</option>` + participantOptions;
    if(old) view.value = old;
  }
}

function csvEscape(value){
  const s = String(value ?? "");
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
}
function downloadText(filename,text,mime){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function backupRows(){
  return predictions.map(p => {
    const participant = participants.find(x=>x.id===p.participantId);
    const match = matches.find(x=>x.id===p.matchId);
    return {
      participante: participant?.name || "",
      partido_numero: match?.matchNumber || "",
      fase: match?.group || "",
      equipo_a: match?.teamA || "",
      equipo_b: match?.teamB || "",
      fecha_chile: match ? localDate(match.utc) : "",
      sede: match?.venue || "",
      apuesta_a: p.goalsA ?? "",
      apuesta_b: p.goalsB ?? "",
      resultado_a: match?.realA ?? "",
      resultado_b: match?.realB ?? "",
      puntos: match ? pointsFor(p,match) : 0
    };
  }).sort((a,b)=>String(a.participante).localeCompare(String(b.participante)) || Number(a.partido_numero)-Number(b.partido_numero));
}
function downloadPredictionsCsv(){
  const rows = backupRows();
  const headers = ["participante","partido_numero","fase","equipo_a","equipo_b","fecha_chile","sede","apuesta_a","apuesta_b","resultado_a","resultado_b","puntos"];
  const csv = "\ufeff" + [headers.join(";"), ...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(";"))].join("\n");
  downloadText(`apuestas_loquito_mundialero_${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv;charset=utf-8");
}
function downloadFullJson(){
  const payload = { generado:new Date().toISOString(), participantes:participants, partidos:matches, predicciones:predictions, apuestas_resumen:backupRows() };
  downloadText(`respaldo_loquito_mundialero_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload,null,2), "application/json;charset=utf-8");
}

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(`view-${btn.dataset.view}`).classList.add("active");
  });
});

$("matchSearch")?.addEventListener("input", renderMatches);
$("phaseFilter")?.addEventListener("change", renderMatches);
$("bulkParticipant")?.addEventListener("change", renderBulkPredictions);
$("viewParticipant")?.addEventListener("change", renderPredictions);
$("upcomingBtn")?.addEventListener("click", () => { showUpcomingOnly = !showUpcomingOnly; renderMatches(); });

$("addParticipantBtn")?.addEventListener("click", async () => {
  if(!isAdmin) return alert("Solo admin.");
  const name = $("participantName").value.trim();
  if(!name) return;
  await addDoc(collection(db,"participants"), {name, createdAt:serverTimestamp()});
  $("participantName").value = "";
});
$("seedScheduleBtn")?.addEventListener("click", async () => {
  if(!isAdmin) return alert("Solo admin.");
  if(!confirm("¿Cargar/actualizar los 104 partidos? No borra participantes ni apuestas.")) return;
  for(const m of OFFICIAL_MATCHES){
    const ref = doc(db,"matches",m.id);
    const old = await getDoc(ref);
    const keep = old.exists() ? {realA: old.data().realA ?? "", realB: old.data().realB ?? ""} : {};
    await setDoc(ref, {...m, ...keep, updatedAt:serverTimestamp()});
  }
  alert("Calendario cargado ✅");
});
$("saveAllPredictionsBtn")?.addEventListener("click", async () => {
  if(!isAdmin) return alert("Solo admin.");
  const participantId = $("bulkParticipant")?.value;
  if(!participantId) return alert("Primero agrega o selecciona un participante.");
  let saved = 0;
  for(const m of matches){
    const a = document.querySelector(`[data-bulk-a="${m.id}"]`)?.value;
    const b = document.querySelector(`[data-bulk-b="${m.id}"]`)?.value;
    if(a !== "" && b !== ""){
      await setDoc(doc(db,"predictions",`${participantId}_${m.id}`), {participantId, matchId:m.id, goalsA:a, goalsB:b, updatedAt:serverTimestamp()});
      saved++;
    }
  }
  alert(`Apuestas guardadas: ${saved}`);
});
$("loginBtn")?.addEventListener("click", async () => {
  try{
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  }catch(e){
    alert("No se pudo iniciar sesión: " + e.message);
  }
});
$("logoutBtn")?.addEventListener("click", () => signOut(auth));
$("downloadCsvBtn")?.addEventListener("click", downloadPredictionsCsv);
$("downloadJsonBtn")?.addEventListener("click", downloadFullJson);

onAuthStateChanged(auth, user => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  document.body.classList.toggle("isAdmin", isAdmin);
  $("loginBox")?.classList.toggle("hidden", !!user);
  $("adminBox")?.classList.toggle("hidden", !user);
  if($("adminEmail")) $("adminEmail").textContent = user?.email || "";
  if(user && !isAdmin) alert("Este correo no está autorizado como administrador.");
  renderAll();
});

onSnapshot(query(collection(db,"participants"), orderBy("createdAt","asc")), snap => {
  participants = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderAll();
});
onSnapshot(query(collection(db,"matches"), orderBy("matchNumber","asc")), snap => {
  matches = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderAll();
});
onSnapshot(collection(db,"predictions"), snap => {
  predictions = snap.docs.map(d=>({id:d.id, ...d.data()}));
  renderAll();
});
