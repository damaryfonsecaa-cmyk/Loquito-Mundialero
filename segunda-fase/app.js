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
const ADMIN_EMAILS = [ADMIN_EMAIL, "damary.fonseca.a@gmail.com"];

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

const KO_ROUNDS = {
  r32: [73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88],
  r16: [89,90,91,92,93,94,95,96],
  qf: [97,98,99,100],
  sf: [101,102],
  final: [104],
  third: [103]
};
const KO_UPPER = {
  r32:[73,74,75,76,77,78,79,80],
  r16:[89,90,91,92],
  qf:[97,99],
  sf:[101]
};
const KO_LOWER = {
  r32:[81,82,83,84,85,86,87,88],
  r16:[93,94,95,96],
  qf:[98,100],
  sf:[102]
};
let koEditingMatchId = "";

let prizeSettings = {entryFee:5000, manualPool:"", firstPct:70, secondPct:20, thirdPct:10};

const $ = id => document.getElementById(id);

window.addEventListener("unhandledrejection", event => {
  console.error(event.reason);
  alert("Ocurrió un error: " + (event.reason?.message || event.reason || "revisa la consola"));
});
window.addEventListener("error", event => {
  console.error(event.error || event.message);
});

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

function allowLateBets(){
  // Emergency override: admin can load closed bets.
  // The checkbox is visual/control guidance, but admin is never blocked.
  return isAdmin || !!$("allowLateBetsToggle")?.checked;
}
function canEditPredictionForMatch(m){
  return isBetOpen(m) || allowLateBets();
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

function cleanScoreValue(v){
  if(v === "" || v == null) return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}
function predictionScore(pred, side){
  if(!pred) return null;
  const keys = side === "A"
    ? ["goalsA", "scoreA", "predA", "predictionA", "homeGoals", "teamAScore"]
    : ["goalsB", "scoreB", "predB", "predictionB", "awayGoals", "teamBScore"];
  for(const key of keys){
    const value = cleanScoreValue(pred[key]);
    if(value !== null) return value;
  }
  return null;
}
function matchScore(match, side){
  if(!match) return null;
  const keys = side === "A"
    ? ["realA", "scoreA", "goalsA", "homeGoals", "teamAScore"]
    : ["realB", "scoreB", "goalsB", "awayGoals", "teamBScore"];
  for(const key of keys){
    const value = cleanScoreValue(match[key]);
    if(value !== null) return value;
  }
  return null;
}
function resultSign(a,b){
  const na = cleanScoreValue(a);
  const nb = cleanScoreValue(b);
  if(na === null || nb === null) return null;
  const diff = na - nb;
  if(diff > 0) return "A";
  if(diff < 0) return "B";
  return "E";
}
function pointsFor(pred,match){
  const predA = predictionScore(pred,"A");
  const predB = predictionScore(pred,"B");
  const realA = matchScore(match,"A");
  const realB = matchScore(match,"B");
  if(predA === null || predB === null || realA === null || realB === null) return 0;

  if(predA === realA && predB === realB) return 3;

  const predictedSign = resultSign(predA,predB);
  const realSign = resultSign(realA,realB);
  return predictedSign && predictedSign === realSign ? 1 : 0;
}
function exactPoints(pred,match){
  return pointsFor(pred,match) === 3 ? 3 : 0;
}
function winnerOnlyPoints(pred,match){
  return pointsFor(pred,match) === 1 ? 1 : 0;
}

function participantStats(pid){
  const ps = predictions.filter(p => p.participantId === pid);
  let points = 0, exacts = 0, winners = 0;
  ps.forEach(p => {
    const m = matches.find(x => x.id === p.matchId);
    const pts = pointsFor(p,m);
    points += pts;
    if(pts === 3) exacts++;
    if(pts === 1) winners++;
  });
  return {count:ps.length, points, exacts, winners, missing:Math.max(0,matches.length-ps.length)};
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


function statsRows(){
  return participants.map(p => ({...p, ...participantStats(p.id)}))
    .sort((a,b)=>b.points-a.points || b.exacts-a.exacts || b.winners-a.winners || a.name.localeCompare(b.name));
}
function lastPlayedMatch(){
  return matches
    .filter(m => m.realA !== "" && m.realB !== "" && m.realA != null && m.realB != null)
    .sort((a,b)=>(b.matchNumber||0)-(a.matchNumber||0))[0];
}

function hasResult(m){
  return m && m.realA !== "" && m.realB !== "" && m.realA != null && m.realB != null;
}
function roundProgress(title, nums){
  const total = nums.length;
  const played = nums.map(n => getMatchByNumber(n)).filter(hasResult).length;
  const pending = Math.max(0, total - played);
  const pct = total ? Math.round((played / total) * 100) : 0;
  return {title, played, total, pending, pct};
}
function koProgressRows(){
  return [
    roundProgress("16avos", KO_ROUNDS.r32),
    roundProgress("Octavos", KO_ROUNDS.r16),
    roundProgress("Cuartos", KO_ROUNDS.qf),
    roundProgress("Semifinales", KO_ROUNDS.sf),
    roundProgress("Tercer lugar", KO_ROUNDS.third),
    roundProgress("Final", KO_ROUNDS.final)
  ];
}
function renderClassificationSummary(){
  const box = $("summaryCards");
  if(!box) return;

  const totalPreds = predictions.length;
  const exacts = predictions.filter(p => {
    const m = matches.find(x=>x.id===p.matchId);
    return pointsFor(p,m) === 3;
  }).length;
  const winnerPreds = predictions.filter(p => {
    const m = matches.find(x=>x.id===p.matchId);
    return pointsFor(p,m) === 1;
  }).length;
  const totalMatches = matches.length;
  const playedMatches = matches.filter(hasResult).length;
  const pendingMatches = Math.max(0, totalMatches - playedMatches);
  const last = lastPlayedMatch();
  const rounds = koProgressRows();

  box.innerHTML = `
    <div class="infoCard"><div class="muted">Participantes</div><strong>${participants.length}</strong><div>jugando segunda fase</div></div>
    <div class="infoCard"><div class="muted">Apuestas cargadas</div><strong>${totalPreds}</strong><div>${exacts} exactos · ${winnerPreds} ganador/empate</div></div>
    <div class="infoCard"><div class="muted">Partidos con resultado</div><strong>${playedMatches} de ${totalMatches}</strong><div>${pendingMatches} pendientes</div></div>
    <div class="infoCard"><div class="muted">Último resultado cargado</div>${
      last ? `<div>${matchLabel(last)}</div><div class="lastResultScore">${last.realA} - ${last.realB}</div>` : `<div>Aún no hay resultados cargados.</div>`
    }</div>
    <div class="infoCard classificationProgressCard">
      <div class="muted">Avance por etapa</div>
      <div class="koProgressList">
        ${rounds.map(r=>`
          <div class="koProgressRow">
            <div><strong>${esc(r.title)}</strong><span>${r.played} de ${r.total} jugados</span></div>
            <div class="koProgressTrack"><i style="width:${r.pct}%"></i></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}
function renderStats(){
  const lastBox = $("lastHitBox");
  const statsBox = $("tournamentStats");
  const topBox = $("topRankingCards");
  const body = $("participantStatsBody");
  if(!lastBox || !statsBox || !topBox || !body) return;

  const totalMatches = matches.length;
  const played = matches.filter(m => m.realA !== "" && m.realB !== "" && m.realA != null && m.realB != null).length;
  const totalPreds = predictions.length;
  const exactPreds = predictions.filter(p => {
    const m = matches.find(x=>x.id===p.matchId);
    return pointsFor(p,m) === 3;
  }).length;
  const winnerPreds = predictions.filter(p => {
    const m = matches.find(x=>x.id===p.matchId);
    return pointsFor(p,m) === 1;
  }).length;
  const pct = totalPreds ? Math.round(((exactPreds + winnerPreds)/totalPreds)*100) : 0;

  statsBox.innerHTML = `
    <div class="statCard"><div class="muted">Partidos cargados</div><div class="bigNumber">${totalMatches}</div></div>
    <div class="statCard"><div class="muted">Partidos con resultado</div><div class="bigNumber">${played}</div></div>
    <div class="statCard"><div class="muted">Apuestas cargadas</div><div class="bigNumber">${totalPreds}</div></div>
    <div class="statCard"><div class="muted">Exactos totales</div><div class="bigNumber">${exactPreds}</div></div>
    <div class="statCard"><div class="muted">Ganador/empate</div><div class="bigNumber">${winnerPreds}</div><div class="muted">${pct}% acierto total</div></div>
  `;

  const last = lastPlayedMatch();
  if(last){
    const hits = predictions.filter(p => p.matchId === last.id && pointsFor(p,last) === 3)
      .map(p => participants.find(x=>x.id===p.participantId)?.name)
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b));
    const onePointers = predictions.filter(p => p.matchId === last.id && pointsFor(p,last) === 1)
      .map(p => participants.find(x=>x.id===p.participantId)?.name)
      .filter(Boolean)
      .sort((a,b)=>a.localeCompare(b));
    lastBox.innerHTML = `
      <h3>🎯 Último partido jugado</h3>
      <div>${matchLabel(last)}</div>
      <div class="lastResultScore">${last.realA} - ${last.realB}</div>
      <p><strong>Acertaron exacto:</strong> ${hits.length ? "" : "nadie todavía."}</p>
      <div class="hitList">${hits.map(n=>`<span class="hitPill">${esc(n)}</span>`).join("")}</div>
      <p><strong>También sumaron 1 punto:</strong> ${onePointers.length ? "" : "nadie."}</p>
      <div class="hitList">${onePointers.map(n=>`<span class="hitPill onePoint">${esc(n)}</span>`).join("")}</div>
    `;
  }else{
    lastBox.innerHTML = `<h3>🎯 Último partido jugado</h3><p class="muted">Aún no hay resultados cargados.</p>`;
  }

  const rows = statsRows();
  topBox.innerHTML = rows.slice(0,3).map((p,i)=>`
    <div class="topRankingCard">
      <div class="muted">${["🥇 Líder","🥈 Segundo","🥉 Tercero"][i]}</div>
      <strong>${esc(p.name)}</strong>
      <div>${p.points} puntos · ${p.exacts} exactos · ${p.winners} ganador/empate</div>
    </div>
  `).join("");

  body.innerHTML = rows.map(p => {
    const rate = p.count ? Math.round(((p.exacts + p.winners)/p.count)*100) : 0;
    return `<tr>
      <td>${esc(p.name)}</td>
      <td><strong>${p.points}</strong></td>
      <td>${p.exacts}</td>
      <td>${p.winners}</td>
      <td>${rate}%</td>
      <td>${p.count}</td>
      <td>${p.missing}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="7" class="muted">Aún no hay participantes.</td></tr>`;
}


function renderAdminStatus(user=null){
  const box = $("adminStatusBox");
  if(!box) return;
  if(!user){
    box.innerHTML = `<div class="card"><strong>🔐 Admin:</strong> no has iniciado sesión.</div>`;
    return;
  }
  const ok = ADMIN_EMAILS.includes(user.email);
  box.innerHTML = `<div class="card ${ok ? "adminOk" : "adminWarn"}">
    <strong>${ok ? "✅ Admin activo" : "⚠️ Sesión iniciada, pero correo no autorizado"}</strong>
    <div class="muted">Correo: ${esc(user.email || "")}</div>
    ${ok ? "" : `<div>El correo debe coincidir con las reglas de Firestore.</div>`}
  </div>`;
}


function realWinnerTeam(m){
  if(!m || m.realA === "" || m.realB === "" || m.realA == null || m.realB == null) return "";
  const a = Number(m.realA), b = Number(m.realB);
  if(a > b) return m.teamA;
  if(b > a) return m.teamB;
  return "";
}
function getMatchByNumber(no){
  return matches.find(m => Number(m.matchNumber) === Number(no));
}
function teamMini(name, code){
  return `<span class="miniTeam">${flagImg(code,name)}<span>${esc(name || "Por definir")}</span></span>`;
}
function renderKoTeamLine(m, side){
  const team = side === "A" ? m?.teamA : m?.teamB;
  const code = side === "A" ? m?.flagCodeA : m?.flagCodeB;
  const score = side === "A" ? m?.realA : m?.realB;
  const win = realWinnerTeam(m) && realWinnerTeam(m) === team;
  return `<div class="koTeamLine ${win ? "winner" : ""}">
    <span>${teamMini(team,code)}</span>
    <strong>${score !== "" && score != null ? esc(score) : ""}</strong>
  </div>`;
}
function koCard(no, compact=false){
  const m = getMatchByNumber(no);
  if(!m) return `<div class="koFlagCard empty"><strong>#${no}</strong><span>Sin cargar</span></div>`;
  return `<button class="koFlagCard ${compact ? "compact" : ""}" data-edit-ko="${m.id}">
    <div class="koMatchNo">#${m.matchNumber} · ${esc(m.group || "")}</div>
    ${renderKoTeamLine(m,"A")}
    ${renderKoTeamLine(m,"B")}
  </button>`;
}
function renderFlagColumn(roundTitle, nums){
  return `<div class="flagRoundCol">
    <div class="roundTitle">${roundTitle}</div>
    ${nums.map(n=>koCard(n,true)).join("")}
  </div>`;
}
function renderKoVisualBracket(){
  const upper = $("koUpperFlagBracket");
  const lower = $("koLowerFlagBracket");
  const final = $("koFinalFlagCard");
  const third = $("koThirdFlagCard");
  const champ = $("koChampionName");
  if(!upper || !lower || !final || !third) return;

  upper.innerHTML = [
    renderFlagColumn("16avos", KO_UPPER.r32),
    renderFlagColumn("Octavos", KO_UPPER.r16),
    renderFlagColumn("Cuartos", KO_UPPER.qf),
    renderFlagColumn("Semi", KO_UPPER.sf)
  ].join("");

  lower.innerHTML = [
    renderFlagColumn("Semi", KO_LOWER.sf),
    renderFlagColumn("Cuartos", KO_LOWER.qf),
    renderFlagColumn("Octavos", KO_LOWER.r16),
    renderFlagColumn("16avos", KO_LOWER.r32)
  ].join("");

  final.innerHTML = koCard(104);
  third.innerHTML = `<div class="thirdTitle">TERCER LUGAR</div>${koCard(103)}`;

  const fm = getMatchByNumber(104);
  const winnerName = realWinnerTeam(fm);
  if(champ) champ.textContent = winnerName || "?";

  document.querySelectorAll("[data-edit-ko]").forEach(btn => {
    btn.onclick = () => openKoEditor(btn.dataset.editKo);
  });
}
function renderKoBracketBoard(){
  const board = $("koBracketBoard");
  if(!board) return;
  const rounds = [
    ["16avos", KO_ROUNDS.r32],
    ["Octavos", KO_ROUNDS.r16],
    ["Cuartos", KO_ROUNDS.qf],
    ["Semifinales", KO_ROUNDS.sf],
    ["Tercer lugar", KO_ROUNDS.third],
    ["Final", KO_ROUNDS.final]
  ];
  board.innerHTML = `<div class="bracketWrap">${rounds.map(([title,nums])=>`
    <div class="bracketRound">
      <h3>${title}</h3>
      ${nums.map(n => {
        const m = getMatchByNumber(n);
        if(!m) return `<div class="bracketMatch"><div class="bracketMatchNumber">#${n}</div><div class="muted">Sin cargar</div></div>`;
        return `<div class="bracketMatch ${realWinnerTeam(m) ? "done" : ""}" data-edit-ko="${m.id}">
          <div class="bracketMatchNumber">#${m.matchNumber} · ${esc(m.group||"")}</div>
          ${renderKoTeamLine(m,"A")}
          ${renderKoTeamLine(m,"B")}
          <div class="bracketArrow">🇨🇱 ${localDate(m.utc)}</div>
        </div>`;
      }).join("")}
    </div>
  `).join("")}</div>`;

  document.querySelectorAll("#koBracketBoard [data-edit-ko]").forEach(el => {
    el.onclick = () => openKoEditor(el.dataset.editKo);
  });
}
function renderKoAll(){
  renderKoVisualBracket();
  renderKoBracketBoard();
}
function openKoEditor(matchId){
  if(!isAdmin){
    alert("Para editar equipos debes iniciar sesión como admin.");
    return;
  }
  const m = matches.find(x=>x.id===matchId);
  if(!m) return;
  koEditingMatchId = matchId;
  $("koModalTitle").textContent = `Editar partido #${m.matchNumber}`;
  $("modalTeamA").value = m.teamA || "";
  $("modalTeamB").value = m.teamB || "";
  $("modalFlagA").value = m.flagCodeA || "";
  $("modalFlagB").value = m.flagCodeB || "";
  $("koEditModal").classList.remove("hidden");
}
function closeKoEditor(){
  $("koEditModal")?.classList.add("hidden");
  koEditingMatchId = "";
}
async function saveKoModal(){
  if(!isAdmin) return alert("Solo admin.");
  if(!koEditingMatchId) return;
  try{
    await updateDoc(doc(db,C.matches,koEditingMatchId), {
      teamA:$("modalTeamA").value.trim(),
      teamB:$("modalTeamB").value.trim(),
      flagCodeA:$("modalFlagA").value.trim(),
      flagCodeB:$("modalFlagB").value.trim(),
      updatedAt:serverTimestamp()
    });
    closeKoEditor();
    await refreshAfterWrite();
    alert("Llave actualizada ✅");
  }catch(e){
    console.error(e);
    alert("No se pudo guardar la llave: " + e.message);
  }
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
  renderStats();
  renderKoAll();
}

function renderRanking(){
  const rows = participants.map(p => ({...p, ...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exacts-a.exacts || b.winners-a.winners || a.name.localeCompare(b.name));
  $("rankingBody").innerHTML = rows.map((p,i)=>`
    <tr><td>${i+1}</td><td>${esc(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.exacts}</td><td>${p.winners}</td><td>${p.count}</td><td>${p.missing}</td></tr>
  `).join("") || `<tr><td colspan="7" class="muted">Aún no hay participantes.</td></tr>`;

  $("podium").innerHTML = rows.slice(0,3).map((p,i)=>`
    <div class="podiumCard">
      <div class="muted">${["🥇 1° lugar","🥈 2° lugar","🥉 3° lugar"][i]}</div>
      <strong>${esc(p.name)}</strong>
      <div>${p.points} puntos · ${p.exacts} exactos · ${p.winners} ganador/empate</div>
    </div>
  `).join("");

  renderClassificationSummary();
}
function renderPrize(){
  const pool = effectivePool();
  const rows = participants.map(p => ({...p, ...participantStats(p.id)})).sort((a,b)=>b.points-a.points || b.exacts-a.exacts || b.winners-a.winners || a.name.localeCompare(b.name));
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
      if(confirm("¿Eliminar participante?")){ await deleteDoc(doc(db,C.participants,btn.dataset.delParticipant)); await refreshAfterWrite(); }
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

  const manualSel = $("manualMatchSelect");
  if(manualSel){
    const old = manualSel.value;
    manualSel.innerHTML = sortedMatches().map(m=>`<option value="${m.id}">#${m.matchNumber} · ${esc(m.group||"")} · ${esc(m.teamA)} vs ${esc(m.teamB)}</option>`).join("");
    if(old && matches.some(m=>m.id===old)) manualSel.value = old;
    fillManualEditor();
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
    const open = canEditPredictionForMatch(m);
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
    return `<tr><td>${esc(u?.name||"")}</td><td>${m?matchLabel(m):""}</td><td>${m?localDate(m.utc):""}</td><td>${p.goalsA} - ${p.goalsB}</td><td><strong>${m?pointsFor(p,m):0}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="5" class="muted">No hay apuestas para este filtro.</td></tr>`;
}


async function syncFromGroupStage(){
  if(!isAdmin) return alert("Solo admin.");
  try{
    const snap = await getDocs(collection(db,"matches"));
    const source = snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(m => Number(m.matchNumber) >= 73 && Number(m.matchNumber) <= 104)
      .sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));

    if(!source.length){
      return alert("No encontré partidos 73 a 104 en la colección original 'matches'. Primero actualiza las llaves en Fase de Grupos o usa la carga base.");
    }

    for(const m of source){
      await setDoc(doc(db,C.matches,m.id), {...m, sourceId:m.id, syncedFromGroups:true, updatedAt:serverTimestamp()}, {merge:true});
    }
    await refreshAfterWrite();
    alert(`Sincronización lista ✅\nPartidos copiados desde Fase de Grupos: ${source.length}`);
  }catch(e){
    console.error(e);
    alert("No se pudo sincronizar desde fase de grupos: " + e.message);
  }
}
function fillManualEditor(){
  const sel = $("manualMatchSelect");
  if(!sel) return;
  const m = matches.find(x=>x.id===sel.value);
  if(!m) return;
  $("manualTeamA").value = m.teamA || "";
  $("manualTeamB").value = m.teamB || "";
  $("manualFlagA").value = m.flagCodeA || "";
  $("manualFlagB").value = m.flagCodeB || "";
}
async function saveManualMatch(){
  if(!isAdmin) return alert("Solo admin.");
  const id = $("manualMatchSelect")?.value;
  if(!id) return alert("Selecciona un partido.");
  try{
    await updateDoc(doc(db,C.matches,id), {
      teamA:$("manualTeamA").value.trim(),
      teamB:$("manualTeamB").value.trim(),
      flagCodeA:$("manualFlagA").value.trim(),
      flagCodeB:$("manualFlagB").value.trim(),
      updatedAt:serverTimestamp()
    });
    await refreshAfterWrite();
    alert("Partido actualizado ✅");
  }catch(e){
    console.error(e);
    alert("No se pudo guardar el partido: " + e.message);
  }
}

async function seedSchedule(){
  if(!isAdmin) return alert("Solo admin.");
  try{
    const ko = OFFICIAL_MATCHES.filter(m => Number(m.matchNumber) >= 73 && Number(m.matchNumber) <= 104);
    for(const m of ko){
      await setDoc(doc(db,C.matches,m.id), {...m, sourceId:m.id, updatedAt:serverTimestamp()}, {merge:true});
    }
    await refreshAfterWrite();
    alert(`Calendario base segunda fase cargado/actualizado: ${ko.length} partidos.
Si ya tienes cruces definidos en Fase de Grupos, usa “Sincronizar desde fase de grupos”.`);
  }catch(e){
    console.error(e);
    alert("No se pudo cargar el calendario. Revisa Firestore Rules ko_matches. Detalle: " + e.message);
  }
}
async function addParticipant(){
  if(!isAdmin) return alert("Solo admin. Primero inicia sesión.");
  const name = $("participantName").value.trim();
  if(!name) return alert("Escribe un nombre.");
  try{
    await addDoc(collection(db,C.participants), {name, createdAt:serverTimestamp()});
    $("participantName").value = "";
    await refreshAfterWrite();
    alert("Participante agregado ✅");
  }catch(e){
    console.error(e);
    alert("No se pudo agregar participante. Revisa Firestore Rules ko_participants. Detalle: " + e.message);
  }
}
async function saveOnePrediction(pid,mid){
  if(!isAdmin) return alert("Solo admin.");
  const m = matches.find(x=>x.id===mid);
  if(!canEditPredictionForMatch(m)) return alert("Este partido ya está cerrado para apuestas.");
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
    if(!canEditPredictionForMatch(m)) continue;
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
    if(!name || !m || a==="" || b==="" || !canEditPredictionForMatch(m)){ skipped++; continue; }
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

function parseWhatsappPredictions(text){
  const lines = text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length < 2) return {name:"", rows:[]};
  const name = lines[0].replace(/^participante\s*[:\-]\s*/i,"").trim();
  const rows = [];
  for(const line of lines.slice(1)){
    const m = line.match(/(?:partido\s*)?(\d{1,3})\s*[:\-]?\s+(\d+)\s*[-xX]\s*(\d+)/i);
    if(m) rows.push({matchNumber:Number(m[1]), goalsA:m[2], goalsB:m[3]});
  }
  return {name, rows};
}
async function importWhatsappText(){
  if(!isAdmin) return alert("Solo admin.");
  const text = $("whatsappPredText")?.value || "";
  const parsed = parseWhatsappPredictions(text);
  if(!parsed.name || !parsed.rows.length){
    return alert("No pude leer el texto. Usa formato: Nombre, y luego líneas tipo: 73 2-1");
  }
  const pid = await getOrCreateParticipant(parsed.name);
  let ok = 0, skipped = 0;
  for(const r of parsed.rows){
    const m = matches.find(x=>Number(x.matchNumber) === Number(r.matchNumber));
    if(!m || !canEditPredictionForMatch(m)){ skipped++; continue; }
    await setDoc(doc(db,C.predictions,`${pid}_${m.id}`), {
      participantId:pid, matchId:m.id, goalsA:r.goalsA, goalsB:r.goalsB, updatedAt:serverTimestamp()
    });
    ok++;
  }
  await refreshAfterWrite();
  alert(`Importación WhatsApp lista.\nParticipante: ${parsed.name}\nApuestas importadas: ${ok}\nFilas omitidas: ${skipped}`);
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
    if(m) lines.push(`${u?.name||""};${m.matchNumber};${m.group};${m.teamA};${m.teamB};${p.goalsA};${p.goalsB};${pointsFor(p,m)}`);
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
$("seedScheduleBtn2")?.addEventListener("click",seedSchedule);
$("syncFromGroupsBtn")?.addEventListener("click",syncFromGroupStage);
$("syncFromGroupsBtn2")?.addEventListener("click",syncFromGroupStage);
$("addParticipantBtn")?.addEventListener("click",addParticipant);
$("saveAllPredictionsBtn")?.addEventListener("click",saveAllPredictions);
$("bulkParticipant")?.addEventListener("change",()=>{rememberDrafts(); renderBulkPredictions();});
$("allowLateBetsToggle")?.addEventListener("change",renderBulkPredictions);
$("matchSearch")?.addEventListener("input",renderMatches);
$("phaseFilter")?.addEventListener("change",renderMatches);
$("manualMatchSelect")?.addEventListener("change",fillManualEditor);
$("saveManualMatchBtn")?.addEventListener("click",saveManualMatch);
$("saveKoModalBtn")?.addEventListener("click",saveKoModal);
$("closeKoModalBtn")?.addEventListener("click",closeKoEditor);
$("upcomingBtn")?.addEventListener("click",()=>{showUpcomingOnly=!showUpcomingOnly; renderMatches();});
$("downloadPredTemplateBtn")?.addEventListener("click",downloadTemplate);
$("importPredCsvBtn")?.addEventListener("click",importCsv);
$("importWhatsappBtn")?.addEventListener("click",importWhatsappText);
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
  isAdmin = !!user && ADMIN_EMAILS.includes(user.email);
  document.body.classList.toggle("isAdmin",isAdmin);
  renderAdminStatus(user);
});
loadAllData();