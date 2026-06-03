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
let predictionDrafts = {};

const TEAM_FLAGS = {"Mexico":"mx","South Africa":"za","South Korea":"kr","Czech Republic":"cz","Canada":"ca","Bosnia & Herzegovina":"ba","USA":"us","Paraguay":"py","Qatar":"qa","Switzerland":"ch","Brazil":"br","Morocco":"ma","Haiti":"ht","Scotland":"gb-sct","Australia":"au","Turkey":"tr","Germany":"de","Curacao":"cw","Netherlands":"nl","Japan":"jp","Ivory Coast":"ci","Ecuador":"ec","Sweden":"se","Tunisia":"tn","Spain":"es","Cape Verde":"cv","Belgium":"be","Egypt":"eg","Saudi Arabia":"sa","Uruguay":"uy","Iran":"ir","New Zealand":"nz","France":"fr","Senegal":"sn","Iraq":"iq","Norway":"no","Argentina":"ar","Algeria":"dz","Austria":"at","Jordan":"jo","Portugal":"pt","DR Congo":"cd","England":"gb-eng","Croatia":"hr","Ghana":"gh","Panama":"pa","Uzbekistan":"uz","Colombia":"co","Chile":"cl"};
const KO_NEXT = {"match073":["match090","A"],"match075":["match090","B"],"match074":["match089","A"],"match077":["match089","B"],"match076":["match091","A"],"match078":["match091","B"],"match079":["match092","A"],"match080":["match092","B"],"match083":["match093","A"],"match084":["match093","B"],"match081":["match094","A"],"match082":["match094","B"],"match086":["match095","A"],"match088":["match095","B"],"match085":["match096","A"],"match087":["match096","B"],"match089":["match097","A"],"match090":["match097","B"],"match093":["match098","A"],"match094":["match098","B"],"match091":["match099","A"],"match092":["match099","B"],"match095":["match100","A"],"match096":["match100","B"],"match097":["match101","A"],"match098":["match101","B"],"match099":["match102","A"],"match100":["match102","B"],"match101":["match104","A","match103","A"],"match102":["match104","B","match103","B"]};

const TEAM_FACTS = {
  "Algeria": {titles:0, star:"Riyad Mahrez", best:"Octavos de final (2014)", fact:"Selección norteafricana históricamente competitiva."},
  "Argentina": {titles:3, star:"Lionel Messi", best:"Campeón (1978, 1986, 2022)", fact:"Campeón vigente de Qatar 2022."},
  "Australia": {titles:0, star:"Mathew Ryan", best:"Octavos de final", fact:"Representante habitual de Asia/Oceanía en Mundiales recientes."},
  "Austria": {titles:0, star:"David Alaba", best:"3° lugar (1954)", fact:"Selección europea con tradición histórica mundialista."},
  "Belgium": {titles:0, star:"Kevin De Bruyne", best:"3° lugar (2018)", fact:"Generación reciente de alto nivel internacional."},
  "Bosnia & Herzegovina": {titles:0, star:"Edin Džeko", best:"Fase de grupos (2014)", fact:"Debutó en Mundiales en Brasil 2014."},
  "Brazil": {titles:5, star:"Vinícius Jr.", best:"Campeón (5 veces)", fact:"Máximo campeón histórico del Mundial masculino."},
  "Canada": {titles:0, star:"Alphonso Davies", best:"Fase de grupos", fact:"Una de las selecciones anfitrionas de 2026."},
  "Cape Verde": {titles:0, star:"Ryan Mendes", best:"Debut mundialista", fact:"Una de las historias emergentes del torneo."},
  "Colombia": {titles:0, star:"Luis Díaz", best:"Cuartos de final (2014)", fact:"Regresa con una generación muy competitiva."},
  "Croatia": {titles:0, star:"Luka Modrić", best:"Subcampeón (2018)", fact:"Finalista 2018 y tercero en 2022."},
  "Curacao": {titles:0, star:"Leandro Bacuna", best:"Debut mundialista", fact:"Una de las clasificadas más llamativas del torneo."},
  "Czech Republic": {titles:0, star:"Patrik Schick", best:"Subcampeón como Checoslovaquia", fact:"Hereda una tradición futbolística histórica europea."},
  "DR Congo": {titles:0, star:"Cédric Bakambu", best:"Participación histórica como Zaire", fact:"Regresa al foco mundial con una generación física y potente."},
  "Ecuador": {titles:0, star:"Moisés Caicedo", best:"Octavos de final (2006)", fact:"Selección sudamericana joven e intensa."},
  "Egypt": {titles:0, star:"Mohamed Salah", best:"Fase de grupos", fact:"Una potencia africana con gran historia continental."},
  "England": {titles:1, star:"Jude Bellingham", best:"Campeón (1966)", fact:"Busca su segundo título mundial."},
  "France": {titles:2, star:"Kylian Mbappé", best:"Campeón (1998, 2018)", fact:"Subcampeona del Mundial 2022."},
  "Germany": {titles:4, star:"Jamal Musiala", best:"Campeón (4 veces)", fact:"Una de las selecciones más exitosas de la historia."},
  "Ghana": {titles:0, star:"Mohammed Kudus", best:"Cuartos de final (2010)", fact:"Una de las selecciones africanas más recordadas en Mundiales modernos."},
  "Haiti": {titles:0, star:"Duckens Nazon", best:"Fase de grupos (1974)", fact:"Regresa al gran escenario mundialista."},
  "Iran": {titles:0, star:"Mehdi Taremi", best:"Fase de grupos", fact:"Selección asiática muy competitiva y experimentada."},
  "Iraq": {titles:0, star:"Aymen Hussein", best:"Fase de grupos (1986)", fact:"Vuelve a una Copa del Mundo tras una larga espera."},
  "Ivory Coast": {titles:0, star:"Franck Kessié", best:"Fase de grupos", fact:"Potencia africana con enorme talento físico y técnico."},
  "Japan": {titles:0, star:"Takefusa Kubo", best:"Octavos de final", fact:"Selección asiática muy regular en Mundiales recientes."},
  "Jordan": {titles:0, star:"Mousa Al-Taamari", best:"Debut mundialista", fact:"Una de las apariciones más interesantes de Asia."},
  "Mexico": {titles:0, star:"Santiago Giménez", best:"Cuartos de final", fact:"Anfitrión: abre el Mundial 2026 en Ciudad de México."},
  "Morocco": {titles:0, star:"Achraf Hakimi", best:"Semifinales (2022)", fact:"Primera selección africana en llegar a semifinales."},
  "Netherlands": {titles:0, star:"Virgil van Dijk", best:"Subcampeón (3 veces)", fact:"Histórica selección europea que aún busca su primer Mundial."},
  "New Zealand": {titles:0, star:"Tim Payne", best:"Fase de grupos", fact:"Representante oceánico de gran disciplina competitiva."},
  "Norway": {titles:0, star:"Erling Haaland", best:"Octavos de final", fact:"Regresa con una generación ofensiva muy potente."},
  "Panama": {titles:0, star:"Adalberto Carrasquilla", best:"Fase de grupos (2018)", fact:"Segunda etapa mundialista para una selección en crecimiento."},
  "Paraguay": {titles:0, star:"Miguel Almirón", best:"Cuartos de final (2010)", fact:"Selección sudamericana históricamente difícil de enfrentar."},
  "Portugal": {titles:0, star:"Bruno Fernandes", best:"3° lugar (1966)", fact:"Una generación que aspira a su primer Mundial."},
  "Qatar": {titles:0, star:"Akram Afif", best:"Fase de grupos (2022)", fact:"Campeón asiático reciente y anfitrión del Mundial 2022."},
  "Saudi Arabia": {titles:0, star:"Salem Al-Dawsari", best:"Octavos de final (1994)", fact:"Recordada por vencer a Argentina en Qatar 2022."},
  "Scotland": {titles:0, star:"Andrew Robertson", best:"Fase de grupos", fact:"Regresa a una Copa del Mundo con una afición muy fiel."},
  "Senegal": {titles:0, star:"Sadio Mané", best:"Cuartos de final (2002)", fact:"Una de las selecciones africanas más fuertes del siglo XXI."},
  "South Africa": {titles:0, star:"Percy Tau", best:"Fase de grupos", fact:"Fue anfitriona del Mundial 2010."},
  "South Korea": {titles:0, star:"Son Heung-min", best:"4° lugar (2002)", fact:"Una de las selecciones asiáticas más constantes."},
  "Spain": {titles:1, star:"Lamine Yamal", best:"Campeón (2010)", fact:"Campeona mundial 2010 y potencia técnica europea."},
  "Sweden": {titles:0, star:"Alexander Isak", best:"Subcampeón (1958)", fact:"Histórica selección europea con gran tradición."},
  "Switzerland": {titles:0, star:"Granit Xhaka", best:"Cuartos de final", fact:"Selección europea muy ordenada y competitiva."},
  "Tunisia": {titles:0, star:"Ellyes Skhiri", best:"Fase de grupos", fact:"Habitual representante africano en Copas del Mundo."},
  "Turkey": {titles:0, star:"Hakan Çalhanoğlu", best:"3° lugar (2002)", fact:"Selección de gran intensidad y tradición competitiva."},
  "Uruguay": {titles:2, star:"Federico Valverde", best:"Campeón (1930, 1950)", fact:"Bicampeón mundial y potencia histórica sudamericana."},
  "USA": {titles:0, star:"Christian Pulisic", best:"3° lugar (1930)", fact:"Anfitrión y selección en crecimiento."},
  "Uzbekistan": {titles:0, star:"Eldor Shomurodov", best:"Debut mundialista", fact:"Una de las grandes historias nuevas del Mundial 2026."},
  "Chile": {titles:0, star:"Alexis Sánchez", best:"3° lugar (1962)", fact:"La Roja alcanzó su mejor resultado como anfitriona en 1962."}
};


const $ = id => document.getElementById(id);

function currentBulkParticipantId(){
  return $("bulkParticipant")?.value || participants[0]?.id || "";
}
function draftKey(participantId, matchId, side){
  return `${participantId}_${matchId}_${side}`;
}
function rememberDrafts(){
  const participantId = currentBulkParticipantId();
  if(!participantId) return;
  document.querySelectorAll("[data-bulk-a]").forEach(input => {
    predictionDrafts[draftKey(participantId, input.dataset.bulkA, "A")] = input.value;
  });
  document.querySelectorAll("[data-bulk-b]").forEach(input => {
    predictionDrafts[draftKey(participantId, input.dataset.bulkB, "B")] = input.value;
  });
}

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
  rememberDrafts();
  renderRanking();
  renderParticipants();
  renderMatches();
  renderPredictions();
  renderBulkPredictions();
  renderTeams();
  fillSelects();
  fillPhaseFilter();
  renderNextMatch();
  renderBracket();
  renderBracketBoard();
  renderFlagBracket();
  fillKoEditor();
  renderStats();
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
        <button data-clear-result="${m.id}">Limpiar</button>
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
      await advanceWinnerFrom(id);
    };
  });
  document.querySelectorAll("[data-clear-result]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.clearResult;
      await updateDoc(doc(db,"matches",id), { realA:"", realB:"" });
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

  const pid = currentBulkParticipantId();
  const existing = Object.fromEntries(
    predictions.filter(p => p.participantId === pid).map(p => [p.matchId, p])
  );

  body.innerHTML = matches.slice()
    .sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999))
    .map(m => {
      const p = existing[m.id] || {};
      const valA = predictionDrafts[draftKey(pid,m.id,"A")] ?? p.goalsA ?? "";
      const valB = predictionDrafts[draftKey(pid,m.id,"B")] ?? p.goalsB ?? "";

      return `<tr>
        <td>${m.matchNumber ?? ""}</td>
        <td><span class="chip">${esc(m.group||"")}</span></td>
        <td>${matchLabel(m)}</td>
        <td>${localDate(m.utc)}</td>
        <td>
          <div class="predScore">
            <input type="number" min="0" value="${valA}" placeholder="A" data-bulk-a="${m.id}">
            <span class="smallVs">-</span>
            <input type="number" min="0" value="${valB}" placeholder="B" data-bulk-b="${m.id}">
          </div>
        </td>
        <td>
          <button type="button" class="rowSaveBtn" data-save-pred="${m.id}">Guardar</button>
          <span class="savedHint" data-saved-hint="${m.id}"></span>
        </td>
      </tr>`;
    }).join("");

  document.querySelectorAll("[data-bulk-a]").forEach(input => {
    input.addEventListener("input", () => {
      predictionDrafts[draftKey(pid, input.dataset.bulkA, "A")] = input.value;
    });
  });
  document.querySelectorAll("[data-bulk-b]").forEach(input => {
    input.addEventListener("input", () => {
      predictionDrafts[draftKey(pid, input.dataset.bulkB, "B")] = input.value;
    });
  });

  document.querySelectorAll("[data-save-pred]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if(!isAdmin) return alert("Solo admin.");

      const participantId = currentBulkParticipantId();
      const matchId = btn.dataset.savePred;
      const a = document.querySelector(`[data-bulk-a="${matchId}"]`)?.value.trim() ?? "";
      const b = document.querySelector(`[data-bulk-b="${matchId}"]`)?.value.trim() ?? "";

      if(a === "" || b === ""){
        return alert("Completa ambos marcadores antes de guardar esta apuesta.");
      }

      predictionDrafts[draftKey(participantId,matchId,"A")] = a;
      predictionDrafts[draftKey(participantId,matchId,"B")] = b;

      await setDoc(doc(db,"predictions",`${participantId}_${matchId}`), {
        participantId,
        matchId,
        goalsA:a,
        goalsB:b,
        updatedAt:serverTimestamp()
      });

      const hint = document.querySelector(`[data-saved-hint="${matchId}"]`);
      if(hint){
        hint.textContent = "✓ guardado";
        setTimeout(() => hint.textContent = "", 1800);
      }
    });
  });
}
function renderTeams(){
  const teams = {};
  matches.forEach(m => [[m.teamA,m.flagCodeA,m.noteA],[m.teamB,m.flagCodeB,m.noteB]].forEach(([name,code,note])=>{
    if(!name || name.includes("Grupo") || name.includes("Ganador") || name.includes("Perdedor") || name.includes("partido")) return;
    if(!teams[name]) teams[name] = {name, code, note, games:0};
    teams[name].games++;
    if(!teams[name].note) teams[name].note = note;
  }));
  const stats = Object.fromEntries(teamTournamentStats().map(t=>[t.name,t]));
  $("teamsGrid").innerHTML = Object.values(teams).sort((a,b)=>a.name.localeCompare(b.name)).map(t => {
    const f = TEAM_FACTS[t.name] || {};
    const st = stats[t.name] || {gf:0,ga:0,played:0,wins:0,draws:0,losses:0};
    const dg = st.gf - st.ga;
    return `<div class="teamCard">
      <div class="bigFlag">${flagImg(t.code,t.name)}</div>
      <h3>${esc(t.name)}</h3>
      <div class="teamMeta">
        <span class="chip">🏆 ${f.titles ?? 0} Mundiales</span>
        <span class="chip">⚽ ${st.gf} GF</span>
        <span class="chip">🥅 ${st.ga} GC</span>
        <span class="chip">➕ ${dg} DG</span>
      </div>
      <div class="teamHighlight">
        <strong>⭐ Figura:</strong> ${esc(f.star || "Por definir")}<br>
        <strong>🎯 Mejor resultado:</strong> ${esc(f.best || "Por definir")}
      </div>
      <ul class="teamFactList">
        <li><strong>Dato:</strong> ${esc(f.fact || t.note || "Participante del Mundial 2026.")}</li>
        <li><strong>Registro en torneo:</strong> ${st.wins}G - ${st.draws}E - ${st.losses}P</li>
      </ul>
    </div>`;
  }).join("");
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


function isKnockout(m){ return Number(m.matchNumber) >= 73; }
function teamFlagCode(name,fallback=""){ return TEAM_FLAGS[name] || fallback || ""; }
function matchWinnerLoser(m){
  if(!m || m.realA==="" || m.realB==="" || m.realA==null || m.realB==null) return {winner:null,loser:null};
  const a=Number(m.realA), b=Number(m.realB);
  if(a===b) return {winner:null,loser:null};
  return a>b ? {winner:{name:m.teamA,code:m.flagCodeA},loser:{name:m.teamB,code:m.flagCodeB}} : {winner:{name:m.teamB,code:m.flagCodeB},loser:{name:m.teamA,code:m.flagCodeA}};
}
async function advanceWinnerFrom(matchId){
  const m=matches.find(x=>x.id===matchId), map=KO_NEXT[matchId];
  if(!m || !map) return;
  const res=matchWinnerLoser(m);
  if(!res.winner) return;
  const up={};
  if(map[1]==="A"){up.teamA=res.winner.name;up.flagCodeA=res.winner.code||teamFlagCode(res.winner.name);up.flagA="";}
  else{up.teamB=res.winner.name;up.flagCodeB=res.winner.code||teamFlagCode(res.winner.name);up.flagB="";}
  await updateDoc(doc(db,"matches",map[0]),up);
  if(map[2] && res.loser){
    const lp={};
    if(map[3]==="A"){lp.teamA=res.loser.name;lp.flagCodeA=res.loser.code||teamFlagCode(res.loser.name);lp.flagA="";}
    else{lp.teamB=res.loser.name;lp.flagCodeB=res.loser.code||teamFlagCode(res.loser.name);lp.flagB="";}
    await updateDoc(doc(db,"matches",map[2]),lp);
  }
}
function renderBracket(){
  const wrap=$("bracketWrap"); if(!wrap) return;
  const rounds=["Dieciseisavos","Octavos","Cuartos","Semifinal","Tercer lugar","Final"];
  wrap.innerHTML=rounds.map(round=>{
    const ms=matches.filter(m=>m.group===round).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
    if(!ms.length) return "";
    return `<div class="bracketRound"><h3>${esc(round)}</h3>${ms.map(m=>{
      const {winner}=matchWinnerLoser(m), winA=winner&&winner.name===m.teamA, winB=winner&&winner.name===m.teamB;
      return `<div class="bracketMatch ${winner?"done":""}">
        <div class="bracketMatchNumber">Partido #${m.matchNumber??""}</div>
        <div class="bracketTeam ${winA?"winner":""}"><span>${flagImg(m.flagCodeA,m.teamA)} ${esc(m.teamA)}</span><span class="bracketScore">${m.realA??""}</span></div>
        <div class="bracketTeam ${winB?"winner":""}"><span>${flagImg(m.flagCodeB,m.teamB)} ${esc(m.teamB)}</span><span class="bracketScore">${m.realB??""}</span></div>
        <div class="bracketArrow">${winner ? "Avanza: "+esc(winner.name) : "Pendiente"}</div>
      </div>`;
    }).join("")}</div>`;
  }).join("");
}
function fillFlagSelects(){
  const opts='<option value="">Sin bandera</option>'+Object.entries(TEAM_FLAGS).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join("");
  if($("koFlagA") && !$("koFlagA").innerHTML) $("koFlagA").innerHTML=opts;
  if($("koFlagB") && !$("koFlagB").innerHTML) $("koFlagB").innerHTML=opts;
}
function fillKoInputs(){
  const m=matches.find(x=>x.id===$("koMatchSelect")?.value); if(!m) return;
  if($("koTeamA")) $("koTeamA").value=m.teamA||"";
  if($("koTeamB")) $("koTeamB").value=m.teamB||"";
  fillFlagSelects();
  if($("koFlagA")) $("koFlagA").value=m.flagCodeA||teamFlagCode(m.teamA)||"";
  if($("koFlagB")) $("koFlagB").value=m.flagCodeB||teamFlagCode(m.teamB)||"";
}
function fillKoEditor(){
  const sel=$("koMatchSelect"); if(!sel) return;
  const old=sel.value;
  sel.innerHTML=matches.filter(isKnockout).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m=>`<option value="${m.id}">#${m.matchNumber} ${esc(m.group)} — ${esc(m.teamA)} vs ${esc(m.teamB)}</option>`).join("");
  if(old) sel.value=old;
  fillKoInputs();
}



function playedMatches(){
  return matches.filter(m => m.realA !== "" && m.realB !== "" && m.realA != null && m.realB != null);
}
function lastPlayedMatch(){
  const played = playedMatches();
  return played.sort((a,b)=>(b.matchNumber||0)-(a.matchNumber||0))[0];
}
function predictionResultType(pred, match){
  if(!match) return "none";
  if(match.realA === "" || match.realB === "" || match.realA == null || match.realB == null) return "pending";
  if(Number(pred.goalsA) === Number(match.realA) && Number(pred.goalsB) === Number(match.realB)) return "exact";
  return winner(pred.goalsA,pred.goalsB) === winner(match.realA,match.realB) ? "winner" : "miss";
}
function participantDetailedStats(participantId){
  const ps = predictions.filter(p => p.participantId === participantId);
  let exact = 0, winnerOnly = 0, misses = 0, points = 0, resolved = 0;
  ps.forEach(p => {
    const m = matches.find(x => x.id === p.matchId);
    const type = predictionResultType(p,m);
    if(type !== "pending" && type !== "none") resolved++;
    if(type === "exact") exact++;
    if(type === "winner") winnerOnly++;
    if(type === "miss") misses++;
    if(m) points += pointsFor(p,m);
  });
  const hitRate = resolved ? Math.round(((exact + winnerOnly) / resolved) * 100) : 0;
  return {exact, winnerOnly, misses, points, count: ps.length, resolved, hitRate};
}
function teamTournamentStats(){
  const map = {};
  function ensure(name, code){
    if(!name || name.includes("Grupo") || name.includes("Ganador") || name.includes("Perdedor") || name.includes("partido")) return null;
    if(!map[name]) map[name] = {name, code, gf:0, ga:0, played:0, wins:0, draws:0, losses:0};
    if(code && !map[name].code) map[name].code = code;
    return map[name];
  }
  playedMatches().forEach(m => {
    const a = ensure(m.teamA,m.flagCodeA), b = ensure(m.teamB,m.flagCodeB);
    if(!a || !b) return;
    const ga = Number(m.realA), gb = Number(m.realB);
    a.gf += ga; a.ga += gb; a.played++;
    b.gf += gb; b.ga += ga; b.played++;
    if(ga > gb){ a.wins++; b.losses++; }
    else if(gb > ga){ b.wins++; a.losses++; }
    else { a.draws++; b.draws++; }
  });
  return Object.values(map);
}
function renderLastHitBox(){
  const box = $("lastHitBox");
  if(!box) return;
  const last = lastPlayedMatch();
  if(!last){
    box.innerHTML = `<h3>🎯 Aciertos del último partido</h3><p>Aún no hay resultados cargados. Cuando ingreses un resultado, aquí aparecerán quienes acertaron.</p>`;
    return;
  }
  const exact = [];
  const winnerHits = [];
  predictions.filter(p => p.matchId === last.id).forEach(p => {
    const user = participants.find(x => x.id === p.participantId);
    if(!user) return;
    const type = predictionResultType(p,last);
    if(type === "exact") exact.push(user.name);
    if(type === "winner") winnerHits.push(user.name);
  });
  box.innerHTML = `
    <h3>🎯 Aciertos del último partido jugado</h3>
    <div class="matchTitle">${matchLabel(last)}</div>
    <div class="lastResultScore">${last.realA} - ${last.realB}</div>
    <p><strong>Exactos:</strong></p>
    <div class="hitList">${exact.length ? exact.map(n=>`<span class="hitPill">🏆 ${esc(n)}</span>`).join("") : `<span class="muted">Nadie acertó exacto.</span>`}</div>
    <p><strong>Acertaron ganador/resultado:</strong></p>
    <div class="hitList">${winnerHits.length ? winnerHits.map(n=>`<span class="hitPill">✅ ${esc(n)}</span>`).join("") : `<span class="muted">Nadie acertó el ganador/resultado.</span>`}</div>
  `;
}
function renderTournamentStats(){
  const wrap = $("tournamentStats");
  if(!wrap) return;
  const played = playedMatches();
  const totalGoals = played.reduce((acc,m)=>acc+Number(m.realA||0)+Number(m.realB||0),0);
  const avgGoals = played.length ? (totalGoals/played.length).toFixed(2) : "0.00";
  const maxGoalsMatch = played.slice().sort((a,b)=>(Number(b.realA)+Number(b.realB))-(Number(a.realA)+Number(a.realB)))[0];
  const teams = teamTournamentStats();
  const topScorerTeam = teams.slice().sort((a,b)=>b.gf-a.gf)[0];
  const bestDefense = teams.filter(t=>t.played>0).sort((a,b)=>a.ga-b.ga || b.played-a.played)[0];
  const totalExact = predictions.reduce((acc,p)=>{
    const m = matches.find(x=>x.id===p.matchId);
    return acc + (predictionResultType(p,m)==="exact" ? 1 : 0);
  },0);
  const leader = participants.map(p=>({name:p.name,...participantDetailedStats(p.id)})).sort((a,b)=>b.points-a.points)[0];
  wrap.innerHTML = `
    <div class="statCard"><div class="muted">Partidos jugados</div><div class="bigNumber">${played.length}</div><div>de ${matches.length || 104} cargados</div></div>
    <div class="statCard"><div class="muted">Goles totales</div><div class="bigNumber">${totalGoals}</div><div>Promedio: ${avgGoals} por partido</div></div>
    <div class="statCard"><div class="muted">Exactos acumulados</div><div class="bigNumber">${totalExact}</div><div>entre todos los participantes</div></div>
    <div class="statCard"><div class="muted">Líder actual</div>${leader ? `<strong>${esc(leader.name)}</strong><div class="bigNumber">${leader.points}</div><div>${leader.exact} exactos</div>` : "Sin participantes"}</div>
    <div class="statCard"><div class="muted">Partido con más goles</div>${maxGoalsMatch ? `<strong>${matchLabel(maxGoalsMatch)}</strong><div class="lastResultScore">${maxGoalsMatch.realA} - ${maxGoalsMatch.realB}</div>` : "Pendiente"}</div>
    <div class="statCard"><div class="muted">Selección más goleadora</div>${topScorerTeam ? `<strong>${flagImg(topScorerTeam.code,topScorerTeam.name)} ${esc(topScorerTeam.name)}</strong><div class="bigNumber">${topScorerTeam.gf}</div>` : "Pendiente"}</div>
    <div class="statCard"><div class="muted">Menos goles recibidos</div>${bestDefense ? `<strong>${flagImg(bestDefense.code,bestDefense.name)} ${esc(bestDefense.name)}</strong><div class="bigNumber">${bestDefense.ga}</div>` : "Pendiente"}</div>
  `;
}
function renderTopRankingCards(){
  const wrap = $("topRankingCards");
  if(!wrap) return;
  const rows = participants.map(p => ({name:p.name, ...participantDetailedStats(p.id)}))
    .sort((a,b)=>b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name))
    .slice(0,5);
  wrap.innerHTML = rows.length ? rows.map((r,i)=>`
    <div class="topRankCard">
      <div class="rankPlace">${["🥇","🥈","🥉","🏅","🏅"][i]} ${i+1}° lugar</div>
      <div class="rankName">${esc(r.name)}</div>
      <div><strong>${r.points}</strong> puntos</div>
      <div class="muted">${r.exact} exactos · ${r.hitRate}% acierto</div>
      <div class="progressBar"><span style="width:${Math.min(100,r.hitRate)}%"></span></div>
    </div>
  `).join("") : `<p class="muted">Aún no hay participantes.</p>`;
}
function renderParticipantStatsTable(){
  const body = $("participantStatsBody");
  if(!body) return;
  const rows = participants.map(p => ({name:p.name, ...participantDetailedStats(p.id)}))
    .sort((a,b)=>b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name));
  body.innerHTML = rows.map(r => `<tr><td>${esc(r.name)}</td><td><strong>${r.points}</strong></td><td>${r.exact}</td><td>${r.winnerOnly}</td><td>${r.hitRate}%</td><td>${r.count}</td></tr>`).join("");
}
function renderStats(){
  renderLastHitBox();
  renderTournamentStats();
  renderTopRankingCards();
  renderParticipantStatsTable();
}


function renderStableKoCard(m){
  const res = matchWinnerLoser(m);
  const winner = res.winner;
  const winA = winner && winner.name === m.teamA;
  const winB = winner && winner.name === m.teamB;
  return `<div class="koCard ${winner ? "done" : ""}">
    <div class="koMatchNo">#${m.matchNumber ?? ""} · ${esc(m.group || "")}</div>
    <div class="koTeam ${winA ? "winner" : ""}">
      <span>${flagImg(m.flagCodeA,m.teamA)} ${esc(m.teamA)}</span>
      <span class="koScore">${m.realA ?? ""}</span>
    </div>
    <div class="koTeam ${winB ? "winner" : ""}">
      <span>${flagImg(m.flagCodeB,m.teamB)} ${esc(m.teamB)}</span>
      <span class="koScore">${m.realB ?? ""}</span>
    </div>
    <div class="koPending">${winner ? "Avanza: " + esc(winner.name) : "Pendiente"}</div>
  </div>`;
}
function renderBracketBoard(){
  const board = $("bracketBoard");
  if(!board) return;
  const rounds = ["Dieciseisavos","Octavos","Cuartos","Semifinal","Tercer lugar","Final"];
  board.innerHTML = rounds.map(round => {
    const ms = matches
      .filter(m => m.group === round)
      .sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
    return `<div class="bracketColumn">
      <h3>${esc(round)}</h3>
      ${ms.length ? ms.map(renderStableKoCard).join("") : `<p class="muted">Sin partidos</p>`}
    </div>`;
  }).join("");

  const final = matches.find(m => Number(m.matchNumber) === 104);
  const champ = final ? matchWinnerLoser(final).winner : null;
  if($("championName")){
    $("championName").innerHTML = champ ? `${flagImg(champ.code,champ.name)} ${esc(champ.name)}` : "?";
  }
}


function shortTeamName(name){
  if(!name) return "";
  const clean = String(name).replace("Ganador partido ","G").replace("Perdedor partido ","P").replace("Grupo ","G");
  if(clean.length <= 10) return clean;
  return clean.slice(0,10);
}
function renderFlagOnlyMatch(m){
  const {winner}=matchWinnerLoser(m);
  const winA = winner && winner.name === m.teamA;
  const winB = winner && winner.name === m.teamB;
  return `<div class="flagOnlyMatch ${winner ? "done" : ""}" title="${esc(m.teamA)} vs ${esc(m.teamB)}">
    <div class="flagOnlyNo">#${m.matchNumber ?? ""}</div>
    <div class="flagOnlyTeam ${winA ? "winner" : ""}">
      ${flagImg(m.flagCodeA,m.teamA)}
      <span class="flagCodeText">${esc(shortTeamName(m.teamA))}</span>
      <span class="flagOnlyScore">${m.realA ?? ""}</span>
    </div>
    <div class="flagOnlyTeam ${winB ? "winner" : ""}">
      ${flagImg(m.flagCodeB,m.teamB)}
      <span class="flagCodeText">${esc(shortTeamName(m.teamB))}</span>
      <span class="flagOnlyScore">${m.realB ?? ""}</span>
    </div>
  </div>`;
}
function renderRoundBlock(title, nums){
  const ms = nums.map(n => matches.find(m => Number(m.matchNumber) === n)).filter(Boolean);
  return `<div class="flagRoundBlock"><h5>${esc(title)}</h5>${ms.map(renderFlagOnlyMatch).join("")}</div>`;
}
function renderFlagBracket(){
  const upper = $("upperFlagBracket"), lower = $("lowerFlagBracket");
  if(!upper || !lower) return;

  upper.innerHTML = [
    renderRoundBlock("16avos", [73,74,75,76,77,78,79,80]),
    renderRoundBlock("Octavos", [89,90,91,92]),
    renderRoundBlock("Cuartos", [97,99]),
    renderRoundBlock("Semi", [101])
  ].join("");

  lower.innerHTML = [
    renderRoundBlock("Semi", [102]),
    renderRoundBlock("Cuartos", [98,100]),
    renderRoundBlock("Octavos", [93,94,95,96]),
    renderRoundBlock("16avos", [81,82,83,84,85,86,87,88])
  ].join("");

  const final = matches.find(m => Number(m.matchNumber) === 104);
  const third = matches.find(m => Number(m.matchNumber) === 103);
  const champ = final ? matchWinnerLoser(final).winner : null;

  if($("championName")){
    $("championName").innerHTML = champ ? `${flagImg(champ.code,champ.name)} ${esc(champ.name)}` : "?";
  }
  if($("finalFlagCard")) $("finalFlagCard").innerHTML = final ? renderFlagOnlyMatch(final) : "";
  if($("thirdFlagCard")) $("thirdFlagCard").innerHTML = third ? renderFlagOnlyMatch(third) : "";

  renderFlagGroups();
}
function renderFlagGroups(){
  const wrap = $("flagGroups");
  if(!wrap) return;
  const groupMatches = matches.filter(m => /^Grupo /.test(m.group||""));
  const groups = {};
  groupMatches.forEach(m => {
    if(!groups[m.group]) groups[m.group] = new Map();
    [[m.teamA,m.flagCodeA],[m.teamB,m.flagCodeB]].forEach(([t,c]) => {
      if(t && !t.includes("Grupo") && !t.includes("Ganador") && !t.includes("Perdedor")) groups[m.group].set(t,c);
    });
  });
  wrap.innerHTML = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([g,map]) => {
    return `<div class="flagGroupCard"><span>${esc(g.replace("Grupo ","G"))}</span>${[...map.entries()].slice(0,4).map(([t,c])=>flagImg(c,t)).join("")}</div>`;
  }).join("");
}


function normalizeText(s){ return String(s ?? "").trim().toLowerCase(); }
function parseCsvText(text){
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h=>normalizeText(h));
  return lines.slice(1).map(line=>{
    const parts=line.split(sep).map(x=>x.trim());
    const row={};
    headers.forEach((h,i)=>row[h]=parts[i] ?? "");
    return row;
  });
}
function buildPredTemplateCsv(){
  const header="participante;partido_numero;goles_a;goles_b";
  const name=participants[0]?.name || "Nombre participante";
  const rows=matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m=>`${name};${m.matchNumber ?? ""};;`);
  return "\ufeff" + [header,...rows].join("\n");
}
async function getOrCreateParticipantByName(name){
  const clean=String(name||"").trim();
  if(!clean) throw new Error("Participante vacío.");
  const found=participants.find(p=>normalizeText(p.name)===normalizeText(clean));
  if(found) return found.id;
  const ref=await addDoc(collection(db,"participants"), {name:clean, createdAt:serverTimestamp()});
  return ref.id;
}
async function importPredictionsFromRows(rows){
  let imported=0, skipped=0;
  const cache={};
  for(const row of rows){
    const participantName=row.participante || row.nombre || row.participant || "";
    const matchNo=Number(row.partido_numero || row.partido || row.match || row.match_number || "");
    const goalsA=(row.goles_a ?? row.goalsa ?? row.a ?? row.local ?? "").toString().trim();
    const goalsB=(row.goles_b ?? row.goalsb ?? row.b ?? row.visita ?? "").toString().trim();
    if(!participantName || !matchNo || goalsA==="" || goalsB===""){ skipped++; continue; }
    const match=matches.find(m=>Number(m.matchNumber)===matchNo);
    if(!match){ skipped++; continue; }
    const key=normalizeText(participantName);
    if(!cache[key]) cache[key]=await getOrCreateParticipantByName(participantName);
    const participantId=cache[key];
    await setDoc(doc(db,"predictions",`${participantId}_${match.id}`), {
      participantId, matchId:match.id, goalsA, goalsB, updatedAt:serverTimestamp()
    });
    imported++;
  }
  return {imported, skipped};
}

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    
function isKnockout(m){ return Number(m.matchNumber) >= 73; }
function teamFlagCode(name,fallback=""){ return TEAM_FLAGS[name] || fallback || ""; }
function matchWinnerLoser(m){
  if(!m || m.realA==="" || m.realB==="" || m.realA==null || m.realB==null) return {winner:null,loser:null};
  const a=Number(m.realA), b=Number(m.realB);
  if(a===b) return {winner:null,loser:null};
  return a>b ? {winner:{name:m.teamA,code:m.flagCodeA},loser:{name:m.teamB,code:m.flagCodeB}} : {winner:{name:m.teamB,code:m.flagCodeB},loser:{name:m.teamA,code:m.flagCodeA}};
}
async function advanceWinnerFrom(matchId){
  const m=matches.find(x=>x.id===matchId), map=KO_NEXT[matchId];
  if(!m || !map) return;
  const res=matchWinnerLoser(m);
  if(!res.winner) return;
  const up={};
  if(map[1]==="A"){up.teamA=res.winner.name;up.flagCodeA=res.winner.code||teamFlagCode(res.winner.name);up.flagA="";}
  else{up.teamB=res.winner.name;up.flagCodeB=res.winner.code||teamFlagCode(res.winner.name);up.flagB="";}
  await updateDoc(doc(db,"matches",map[0]),up);
  if(map[2] && res.loser){
    const lp={};
    if(map[3]==="A"){lp.teamA=res.loser.name;lp.flagCodeA=res.loser.code||teamFlagCode(res.loser.name);lp.flagA="";}
    else{lp.teamB=res.loser.name;lp.flagCodeB=res.loser.code||teamFlagCode(res.loser.name);lp.flagB="";}
    await updateDoc(doc(db,"matches",map[2]),lp);
  }
}
function renderBracket(){
  const wrap=$("bracketWrap"); if(!wrap) return;
  const rounds=["Dieciseisavos","Octavos","Cuartos","Semifinal","Tercer lugar","Final"];
  wrap.innerHTML=rounds.map(round=>{
    const ms=matches.filter(m=>m.group===round).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
    if(!ms.length) return "";
    return `<div class="bracketRound"><h3>${esc(round)}</h3>${ms.map(m=>{
      const {winner}=matchWinnerLoser(m), winA=winner&&winner.name===m.teamA, winB=winner&&winner.name===m.teamB;
      return `<div class="bracketMatch ${winner?"done":""}">
        <div class="bracketMatchNumber">Partido #${m.matchNumber??""}</div>
        <div class="bracketTeam ${winA?"winner":""}"><span>${flagImg(m.flagCodeA,m.teamA)} ${esc(m.teamA)}</span><span class="bracketScore">${m.realA??""}</span></div>
        <div class="bracketTeam ${winB?"winner":""}"><span>${flagImg(m.flagCodeB,m.teamB)} ${esc(m.teamB)}</span><span class="bracketScore">${m.realB??""}</span></div>
        <div class="bracketArrow">${winner ? "Avanza: "+esc(winner.name) : "Pendiente"}</div>
      </div>`;
    }).join("")}</div>`;
  }).join("");
}
function fillFlagSelects(){
  const opts='<option value="">Sin bandera</option>'+Object.entries(TEAM_FLAGS).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`<option value="${c}">${esc(n)}</option>`).join("");
  if($("koFlagA") && !$("koFlagA").innerHTML) $("koFlagA").innerHTML=opts;
  if($("koFlagB") && !$("koFlagB").innerHTML) $("koFlagB").innerHTML=opts;
}
function fillKoInputs(){
  const m=matches.find(x=>x.id===$("koMatchSelect")?.value); if(!m) return;
  if($("koTeamA")) $("koTeamA").value=m.teamA||"";
  if($("koTeamB")) $("koTeamB").value=m.teamB||"";
  fillFlagSelects();
  if($("koFlagA")) $("koFlagA").value=m.flagCodeA||teamFlagCode(m.teamA)||"";
  if($("koFlagB")) $("koFlagB").value=m.flagCodeB||teamFlagCode(m.teamB)||"";
}
function fillKoEditor(){
  const sel=$("koMatchSelect"); if(!sel) return;
  const old=sel.value;
  sel.innerHTML=matches.filter(isKnockout).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m=>`<option value="${m.id}">#${m.matchNumber} ${esc(m.group)} — ${esc(m.teamA)} vs ${esc(m.teamB)}</option>`).join("");
  if(old) sel.value=old;
  fillKoInputs();
}


function playedMatches(){
  return matches.filter(m => m.realA !== "" && m.realB !== "" && m.realA != null && m.realB != null);
}
function lastPlayedMatch(){
  const played = playedMatches();
  return played.sort((a,b)=>(b.matchNumber||0)-(a.matchNumber||0))[0];
}
function predictionResultType(pred, match){
  if(!match) return "none";
  if(match.realA === "" || match.realB === "" || match.realA == null || match.realB == null) return "pending";
  if(Number(pred.goalsA) === Number(match.realA) && Number(pred.goalsB) === Number(match.realB)) return "exact";
  return winner(pred.goalsA,pred.goalsB) === winner(match.realA,match.realB) ? "winner" : "miss";
}
function participantDetailedStats(participantId){
  const ps = predictions.filter(p => p.participantId === participantId);
  let exact = 0, winnerOnly = 0, points = 0;
  ps.forEach(p => {
    const m = matches.find(x => x.id === p.matchId);
    const type = predictionResultType(p,m);
    if(type === "exact") exact++;
    if(type === "winner") winnerOnly++;
    if(m) points += pointsFor(p,m);
  });
  return {exact, winnerOnly, points, count: ps.length};
}
function teamTournamentStats(){
  const map = {};
  function ensure(name, code){
    if(!name || name.includes("Grupo") || name.includes("Ganador") || name.includes("Perdedor") || name.includes("partido")) return null;
    if(!map[name]) map[name] = {name, code, gf:0, ga:0, played:0, wins:0, draws:0, losses:0};
    if(code && !map[name].code) map[name].code = code;
    return map[name];
  }
  playedMatches().forEach(m => {
    const a = ensure(m.teamA,m.flagCodeA), b = ensure(m.teamB,m.flagCodeB);
    if(!a || !b) return;
    const ga = Number(m.realA), gb = Number(m.realB);
    a.gf += ga; a.ga += gb; a.played++;
    b.gf += gb; b.ga += ga; b.played++;
    if(ga > gb){ a.wins++; b.losses++; }
    else if(gb > ga){ b.wins++; a.losses++; }
    else { a.draws++; b.draws++; }
  });
  return Object.values(map);
}
function renderLastHitBox(){
  const box = $("lastHitBox");
  if(!box) return;
  const last = lastPlayedMatch();
  if(!last){
    box.innerHTML = `<h3>🎯 Aciertos del último partido</h3><p>Aún no hay resultados cargados.</p>`;
    return;
  }
  const exact = [];
  const winnerHits = [];
  predictions.filter(p => p.matchId === last.id).forEach(p => {
    const user = participants.find(x => x.id === p.participantId);
    if(!user) return;
    const type = predictionResultType(p,last);
    if(type === "exact") exact.push(user.name);
    if(type === "winner") winnerHits.push(user.name);
  });
  box.innerHTML = `
    <h3>🎯 Aciertos del último partido</h3>
    <div class="matchTitle">${matchLabel(last)}</div>
    <div class="lastResultScore">${last.realA} - ${last.realB}</div>
    <p><strong>Exactos:</strong></p>
    <div class="hitList">${exact.length ? exact.map(n=>`<span class="hitPill">🏆 ${esc(n)}</span>`).join("") : `<span class="muted">Nadie acertó exacto.</span>`}</div>
    <p><strong>Acertaron ganador/resultado:</strong></p>
    <div class="hitList">${winnerHits.length ? winnerHits.map(n=>`<span class="hitPill">✅ ${esc(n)}</span>`).join("") : `<span class="muted">Nadie acertó el ganador/resultado.</span>`}</div>
  `;
}
function renderTournamentStats(){
  const wrap = $("tournamentStats");
  if(!wrap) return;
  const played = playedMatches();
  const totalGoals = played.reduce((acc,m)=>acc+Number(m.realA||0)+Number(m.realB||0),0);
  const maxGoalsMatch = played.slice().sort((a,b)=>(Number(b.realA)+Number(b.realB))-(Number(a.realA)+Number(a.realB)))[0];
  const teams = teamTournamentStats();
  const topScorerTeam = teams.slice().sort((a,b)=>b.gf-a.gf)[0];
  const bestDefense = teams.filter(t=>t.played>0).sort((a,b)=>a.ga-b.ga || b.played-a.played)[0];
  const totalExact = predictions.reduce((acc,p)=>{
    const m = matches.find(x=>x.id===p.matchId);
    return acc + (predictionResultType(p,m)==="exact" ? 1 : 0);
  },0);
  wrap.innerHTML = `
    <div class="statCard"><div class="muted">Partidos jugados</div><div class="bigNumber">${played.length}</div></div>
    <div class="statCard"><div class="muted">Goles totales</div><div class="bigNumber">${totalGoals}</div></div>
    <div class="statCard"><div class="muted">Exactos acumulados</div><div class="bigNumber">${totalExact}</div></div>
    <div class="statCard"><div class="muted">Partido con más goles</div>${maxGoalsMatch ? `<strong>${matchLabel(maxGoalsMatch)}</strong><div class="lastResultScore">${maxGoalsMatch.realA} - ${maxGoalsMatch.realB}</div>` : "Pendiente"}</div>
    <div class="statCard"><div class="muted">Selección más goleadora</div>${topScorerTeam ? `<strong>${flagImg(topScorerTeam.code,topScorerTeam.name)} ${esc(topScorerTeam.name)}</strong><div class="bigNumber">${topScorerTeam.gf}</div>` : "Pendiente"}</div>
    <div class="statCard"><div class="muted">Menos goles recibidos</div>${bestDefense ? `<strong>${flagImg(bestDefense.code,bestDefense.name)} ${esc(bestDefense.name)}</strong><div class="bigNumber">${bestDefense.ga}</div>` : "Pendiente"}</div>
  `;
}
function renderParticipantStatsTable(){
  const body = $("participantStatsBody");
  if(!body) return;
  const rows = participants.map(p => ({name:p.name, ...participantDetailedStats(p.id)}))
    .sort((a,b)=>b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name));
  body.innerHTML = rows.map(r => `<tr><td>${esc(r.name)}</td><td><strong>${r.points}</strong></td><td>${r.exact}</td><td>${r.winnerOnly}</td><td>${r.count}</td></tr>`).join("");
}
function renderStats(){
  renderLastHitBox();
  renderTournamentStats();
  renderParticipantStatsTable();
}


function renderPosterMatch(m){
  const {winner}=matchWinnerLoser(m);
  const winA=winner && winner.name===m.teamA;
  const winB=winner && winner.name===m.teamB;
  return `<div class="posterMatch ${winner?"done":""}">
    <div class="roundName">#${m.matchNumber ?? ""} · ${esc(m.group||"")}</div>
    <div class="posterTeam ${winA?"winner":""}"><span>${flagImg(m.flagCodeA,m.teamA)} ${esc(m.teamA)}</span><span class="posterScore">${m.realA ?? ""}</span></div>
    <div class="posterConnector"></div>
    <div class="posterTeam ${winB?"winner":""}"><span>${flagImg(m.flagCodeB,m.teamB)} ${esc(m.teamB)}</span><span class="posterScore">${m.realB ?? ""}</span></div>
  </div>`;
}
function renderPosterBracket(){
  const left=$("posterLeft"), right=$("posterRight");
  if(!left || !right) return;
  const ko = matches.filter(m=>Number(m.matchNumber)>=73).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
  const leftNums = new Set([73,74,75,76,89,90,91,92,97,99,101]);
  const rightNums = new Set([77,78,79,80,81,82,83,84,85,86,87,88,93,94,95,96,98,100,102]);
  const leftMatches = ko.filter(m=>leftNums.has(Number(m.matchNumber)));
  const rightMatches = ko.filter(m=>rightNums.has(Number(m.matchNumber)));
  left.className = "posterSide posterRed leftLayout";
  right.className = "posterSide posterBlue rightLayout";
  left.innerHTML = leftMatches.map(renderPosterMatch).join("");
  right.innerHTML = rightMatches.map(renderPosterMatch).join("");

  const final = matches.find(m=>Number(m.matchNumber)===104);
  const third = matches.find(m=>Number(m.matchNumber)===103);
  const champ = final ? matchWinnerLoser(final).winner : null;
  if($("championName")) $("championName").innerHTML = champ ? `${flagImg(champ.code,champ.name)} ${esc(champ.name)}` : "?";
  if($("finalMini")) $("finalMini").innerHTML = final ? renderPosterMatch(final) : "";
  if($("thirdPlaceBox")) $("thirdPlaceBox").innerHTML = third ? `<strong>🥉 Tercer lugar</strong>${renderPosterMatch(third)}` : "";

  renderMiniGroups();
}
function renderMiniGroups(){
  const top=$("miniGroupsTop"), bottom=$("miniGroupsBottom");
  if(!top || !bottom) return;
  const groupMatches = matches.filter(m => /^Grupo /.test(m.group||""));
  const groups = {};
  groupMatches.forEach(m=>{
    if(!groups[m.group]) groups[m.group]=new Set();
    [m.teamA,m.teamB].forEach(t=>{
      if(t && !t.includes("Grupo") && !t.includes("Ganador") && !t.includes("Perdedor")) groups[m.group].add(t);
    });
  });
  const cards = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([g,set])=>{
    const teams=[...set].slice(0,4);
    return `<div class="groupMini"><span>${esc(g.replace("Grupo ","G"))}</span>${teams.map(t=>flagImg(teamFlagCode(t),t)).join("")}</div>`;
  });
  const mid = Math.ceil(cards.length/2);
  top.innerHTML = cards.slice(0,mid).join("");
  bottom.innerHTML = cards.slice(mid).join("");
}


function renderStableKoCard(m){
  const res = matchWinnerLoser(m);
  const winner = res.winner;
  const winA = winner && winner.name === m.teamA;
  const winB = winner && winner.name === m.teamB;
  return `<div class="koCard ${winner ? "done" : ""}">
    <div class="koMatchNo">#${m.matchNumber ?? ""} · ${esc(m.group || "")}</div>
    <div class="koTeam ${winA ? "winner" : ""}">
      <span>${flagImg(m.flagCodeA,m.teamA)} ${esc(m.teamA)}</span>
      <span class="koScore">${m.realA ?? ""}</span>
    </div>
    <div class="koTeam ${winB ? "winner" : ""}">
      <span>${flagImg(m.flagCodeB,m.teamB)} ${esc(m.teamB)}</span>
      <span class="koScore">${m.realB ?? ""}</span>
    </div>
    <div class="koPending">${winner ? "Avanza: " + esc(winner.name) : "Pendiente"}</div>
  </div>`;
}
function renderBracketBoard(){
  const board = $("bracketBoard");
  if(!board) return;
  const rounds = ["Dieciseisavos","Octavos","Cuartos","Semifinal","Tercer lugar","Final"];
  board.innerHTML = rounds.map(round => {
    const ms = matches
      .filter(m => m.group === round)
      .sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999));
    return `<div class="bracketColumn">
      <h3>${esc(round)}</h3>
      ${ms.length ? ms.map(renderStableKoCard).join("") : `<p class="muted">Sin partidos</p>`}
    </div>`;
  }).join("");

  const final = matches.find(m => Number(m.matchNumber) === 104);
  const champ = final ? matchWinnerLoser(final).winner : null;
  if($("championName")){
    $("championName").innerHTML = champ ? `${flagImg(champ.code,champ.name)} ${esc(champ.name)}` : "?";
  }
}


function shortTeamName(name){
  if(!name) return "";
  const clean = String(name).replace("Ganador partido ","G").replace("Perdedor partido ","P").replace("Grupo ","G");
  if(clean.length <= 10) return clean;
  return clean.slice(0,10);
}
function renderFlagOnlyMatch(m){
  const {winner}=matchWinnerLoser(m);
  const winA = winner && winner.name === m.teamA;
  const winB = winner && winner.name === m.teamB;
  return `<div class="flagOnlyMatch ${winner ? "done" : ""}" title="${esc(m.teamA)} vs ${esc(m.teamB)}">
    <div class="flagOnlyNo">#${m.matchNumber ?? ""}</div>
    <div class="flagOnlyTeam ${winA ? "winner" : ""}">
      ${flagImg(m.flagCodeA,m.teamA)}
      <span class="flagCodeText">${esc(shortTeamName(m.teamA))}</span>
      <span class="flagOnlyScore">${m.realA ?? ""}</span>
    </div>
    <div class="flagOnlyTeam ${winB ? "winner" : ""}">
      ${flagImg(m.flagCodeB,m.teamB)}
      <span class="flagCodeText">${esc(shortTeamName(m.teamB))}</span>
      <span class="flagOnlyScore">${m.realB ?? ""}</span>
    </div>
  </div>`;
}
function renderRoundBlock(title, nums){
  const ms = nums.map(n => matches.find(m => Number(m.matchNumber) === n)).filter(Boolean);
  return `<div class="flagRoundBlock"><h5>${esc(title)}</h5>${ms.map(renderFlagOnlyMatch).join("")}</div>`;
}
function renderFlagBracket(){
  const upper = $("upperFlagBracket"), lower = $("lowerFlagBracket");
  if(!upper || !lower) return;

  upper.innerHTML = [
    renderRoundBlock("16avos", [73,74,75,76,77,78,79,80]),
    renderRoundBlock("Octavos", [89,90,91,92]),
    renderRoundBlock("Cuartos", [97,99]),
    renderRoundBlock("Semi", [101])
  ].join("");

  lower.innerHTML = [
    renderRoundBlock("Semi", [102]),
    renderRoundBlock("Cuartos", [98,100]),
    renderRoundBlock("Octavos", [93,94,95,96]),
    renderRoundBlock("16avos", [81,82,83,84,85,86,87,88])
  ].join("");

  const final = matches.find(m => Number(m.matchNumber) === 104);
  const third = matches.find(m => Number(m.matchNumber) === 103);
  const champ = final ? matchWinnerLoser(final).winner : null;

  if($("championName")){
    $("championName").innerHTML = champ ? `${flagImg(champ.code,champ.name)} ${esc(champ.name)}` : "?";
  }
  if($("finalFlagCard")) $("finalFlagCard").innerHTML = final ? renderFlagOnlyMatch(final) : "";
  if($("thirdFlagCard")) $("thirdFlagCard").innerHTML = third ? renderFlagOnlyMatch(third) : "";

  renderFlagGroups();
}
function renderFlagGroups(){
  const wrap = $("flagGroups");
  if(!wrap) return;
  const groupMatches = matches.filter(m => /^Grupo /.test(m.group||""));
  const groups = {};
  groupMatches.forEach(m => {
    if(!groups[m.group]) groups[m.group] = new Map();
    [[m.teamA,m.flagCodeA],[m.teamB,m.flagCodeB]].forEach(([t,c]) => {
      if(t && !t.includes("Grupo") && !t.includes("Ganador") && !t.includes("Perdedor")) groups[m.group].set(t,c);
    });
  });
  wrap.innerHTML = Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([g,map]) => {
    return `<div class="flagGroupCard"><span>${esc(g.replace("Grupo ","G"))}</span>${[...map.entries()].slice(0,4).map(([t,c])=>flagImg(c,t)).join("")}</div>`;
  }).join("");
}


function normalizeText(s){ return String(s ?? "").trim().toLowerCase(); }
function parseCsvText(text){
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h=>normalizeText(h));
  return lines.slice(1).map(line=>{
    const parts=line.split(sep).map(x=>x.trim());
    const row={};
    headers.forEach((h,i)=>row[h]=parts[i] ?? "");
    return row;
  });
}
function buildPredTemplateCsv(){
  const header="participante;partido_numero;goles_a;goles_b";
  const name=participants[0]?.name || "Nombre participante";
  const rows=matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m=>`${name};${m.matchNumber ?? ""};;`);
  return "\ufeff" + [header,...rows].join("\n");
}
async function getOrCreateParticipantByName(name){
  const clean=String(name||"").trim();
  if(!clean) throw new Error("Participante vacío.");
  const found=participants.find(p=>normalizeText(p.name)===normalizeText(clean));
  if(found) return found.id;
  const ref=await addDoc(collection(db,"participants"), {name:clean, createdAt:serverTimestamp()});
  return ref.id;
}
async function importPredictionsFromRows(rows){
  let imported=0, skipped=0;
  const cache={};
  for(const row of rows){
    const participantName=row.participante || row.nombre || row.participant || "";
    const matchNo=Number(row.partido_numero || row.partido || row.match || row.match_number || "");
    const goalsA=(row.goles_a ?? row.goalsa ?? row.a ?? row.local ?? "").toString().trim();
    const goalsB=(row.goles_b ?? row.goalsb ?? row.b ?? row.visita ?? "").toString().trim();
    if(!participantName || !matchNo || goalsA==="" || goalsB===""){ skipped++; continue; }
    const match=matches.find(m=>Number(m.matchNumber)===matchNo);
    if(!match){ skipped++; continue; }
    const key=normalizeText(participantName);
    if(!cache[key]) cache[key]=await getOrCreateParticipantByName(participantName);
    const participantId=cache[key];
    await setDoc(doc(db,"predictions",`${participantId}_${match.id}`), {
      participantId, matchId:match.id, goalsA, goalsB, updatedAt:serverTimestamp()
    });
    imported++;
  }
  return {imported, skipped};
}

document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(`view-${btn.dataset.view}`).classList.add("active");
  });
});

$("matchSearch")?.addEventListener("input", renderMatches);
$("phaseFilter")?.addEventListener("change", renderMatches);
$("bulkParticipant")?.addEventListener("change", () => { rememberDrafts(); renderBulkPredictions(); });
$("viewParticipant")?.addEventListener("change", renderPredictions);
$("upcomingBtn")?.addEventListener("click", () => { showUpcomingOnly = !showUpcomingOnly; renderMatches(); });

$("koMatchSelect")?.addEventListener("change", fillKoInputs);
$("saveKoTeamsBtn")?.addEventListener("click", async ()=>{
  if(!isAdmin) return alert("Solo admin.");
  const id=$("koMatchSelect")?.value;
  if(!id) return alert("Selecciona un partido.");
  const a=$("koTeamA")?.value.trim()||"", b=$("koTeamB")?.value.trim()||"";
  await updateDoc(doc(db,"matches",id),{teamA:a,teamB:b,flagCodeA:$("koFlagA")?.value||teamFlagCode(a),flagCodeB:$("koFlagB")?.value||teamFlagCode(b),flagA:"",flagB:""});
  alert("Equipos de la llave actualizados.");
});


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

  const participantId = currentBulkParticipantId();
  if(!participantId) return alert("Primero agrega o selecciona un participante.");

  const rowsToSave = [];
  for(const m of matches){
    const a = document.querySelector(`[data-bulk-a="${m.id}"]`)?.value.trim() ?? "";
    const b = document.querySelector(`[data-bulk-b="${m.id}"]`)?.value.trim() ?? "";

    predictionDrafts[draftKey(participantId,m.id,"A")] = a;
    predictionDrafts[draftKey(participantId,m.id,"B")] = b;

    if(a !== "" && b !== ""){
      rowsToSave.push({participantId, matchId:m.id, goalsA:a, goalsB:b});
    }
  }

  if(rowsToSave.length === 0) return alert("No hay apuestas completas para guardar.");

  await Promise.all(rowsToSave.map(r =>
    setDoc(doc(db,"predictions",`${r.participantId}_${r.matchId}`), {
      participantId:r.participantId,
      matchId:r.matchId,
      goalsA:r.goalsA,
      goalsB:r.goalsB,
      updatedAt:serverTimestamp()
    })
  ));

  alert(`Apuestas guardadas: ${rowsToSave.length}.`);
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

$("downloadPredTemplateBtn")?.addEventListener("click", () => {
  const csv = buildPredTemplateCsv();
  downloadText("plantilla_apuestas_loquito_mundialero.csv", csv, "text/csv;charset=utf-8");
});
$("importPredCsvBtn")?.addEventListener("click", async () => {
  if(!isAdmin) return alert("Solo admin.");
  const file = $("csvPredFile")?.files?.[0];
  if(!file) return alert("Selecciona un archivo CSV o TXT.");
  const rows = parseCsvText(await file.text());
  if(!rows.length) return alert("El archivo no tiene filas para importar.");
  if(!confirm(`Se importarán/actualizarán apuestas desde ${rows.length} filas. ¿Continuar?`)) return;
  try{
    const result = await importPredictionsFromRows(rows);
    alert(`Importación lista ✅\nApuestas importadas: ${result.imported}\nFilas omitidas: ${result.skipped}`);
  }catch(e){
    alert("Error importando CSV: " + e.message);
  }
});


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
