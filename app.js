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

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
let participants=[],matches=[],predictions=[],isAdmin=false;
const $=id=>document.getElementById(id);
document.querySelectorAll("nav button").forEach(btn=>btn.onclick=()=>{document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));btn.classList.add("active");$(`view-${btn.dataset.view}`).classList.add("active")});
$("matchSearch")?.addEventListener("input",renderMatches); $("phaseFilter")?.addEventListener("change",renderMatches); $("todayBtn")?.addEventListener("click",()=>{$("matchSearch").value=""; $("phaseFilter").value=""; window.showUpcomingOnly = !window.showUpcomingOnly; renderMatches();});

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function localDate(utc){return utc?new Date(utc).toLocaleString("es-CL",{timeZone:"America/Santiago",weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).replace(",", " ·"):""}
function winner(a,b){if(a===""||b===""||a==null||b==null)return"";a=+a;b=+b;return a>b?"A":b>a?"B":"E"}
function pts(p,m){if(!m||m.realA===""||m.realB===""||m.realA==null||m.realB==null)return 0;return (+p.goalsA===+m.realA&&+p.goalsB===+m.realB)?3:(winner(p.goalsA,p.goalsB)===winner(m.realA,m.realB)?1:0)}
function stat(pid){let ps=predictions.filter(p=>p.participantId===pid),points=0;ps.forEach(p=>points+=pts(p,matches.find(m=>m.id===p.matchId)));return{count:ps.length,points}}
function nextUpcomingMatch(){
  const now = new Date();
  return matches
    .filter(m => m.utc && new Date(m.utc) >= now)
    .sort((a,b)=>new Date(a.utc)-new Date(b.utc))[0];
}
function countdownText(utc){
  if(!utc) return "";
  const diff = new Date(utc) - new Date();
  if(diff <= 0) return "en juego o finalizado";
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const m = Math.floor((diff%3600000)/60000);
  if(d>0) return `${d} días · ${h} h · ${m} min`;
  return `${h} h · ${m} min`;
}
function isSoon(m){
  if(!m?.utc) return false;
  const diff = new Date(m.utc) - new Date();
  return diff > 0 && diff <= 48*3600000;
}
function hasChile(m){
  return /chile/i.test(`${m.teamA} ${m.teamB}`);
}
function renderNextMatch(){
  const n = nextUpcomingMatch();
  const html = n ? `
    <h3>⏳ Próximo partido</h3>
    <div class="matchTitle"><span class="flag">${n.flagA||"🏳️"}</span>${esc(n.teamA)} <span class="vs">vs</span> <span class="flag">${n.flagB||"🏳️"}</span>${esc(n.teamB)}</div>
    <div class="countdown">${countdownText(n.utc)}</div>
    <div class="matchMeta">
      <span class="metaPill">🇨🇱 ${localDate(n.utc)}</span>
      <span class="metaPill">🏟️ ${esc(n.venue||"")}</span>
      <span class="metaPill">🏷️ ${esc(n.group||"")}</span>
    </div>
  ` : `<h3>🏁 No hay partidos futuros cargados</h3>`;
  if($("nextMatchHero")) $("nextMatchHero").innerHTML = html;
  if($("nextMatchBox")) $("nextMatchBox").innerHTML = html;
}

function renderAll(){renderParticipants();renderMatches();renderPredictions();renderRanking();fillSelects();renderTeams();fillPhaseFilter();renderNextMatch()}
function renderRanking(){let rows=participants.map(p=>({...p,...stat(p.id)})).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));$("rankingBody").innerHTML=rows.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.count}</td></tr>`).join("");$("podium").innerHTML=rows.slice(0,3).map((p,i)=>`<div class="podiumCard"><div class="muted">${["🥇 1° lugar","🥈 2° lugar","🥉 3° lugar"][i]}</div><strong>${esc(p.name)}</strong><div>${p.points} puntos</div></div>`).join("")}
function renderParticipants(){$("participantsBody").innerHTML=participants.map(p=>`<tr><td>${esc(p.name)}</td><td>${stat(p.id).count}</td><td class="adminOnly"><button class="danger" data-del-participant="${p.id}">Eliminar</button></td></tr>`).join("");document.querySelectorAll("[data-del-participant]").forEach(b=>b.onclick=async()=>{if(isAdmin&&confirm("¿Eliminar participante?"))await deleteDoc(doc(db,"participants",b.dataset.delParticipant))})}
function fillPhaseFilter(){let cur=$("phaseFilter").value, phases=[...new Set(matches.map(m=>m.group).filter(Boolean))];$("phaseFilter").innerHTML=`<option value="">Todas las fases</option>`+phases.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join("");$("phaseFilter").value=cur}
function filteredMatches(){let q=($("matchSearch")?.value||"").toLowerCase(), ph=$("phaseFilter")?.value||"";return matches.filter(m=>(!q||`${m.group} ${m.teamA} ${m.teamB} ${m.venue}`.toLowerCase().includes(q))&&(!ph||m.group===ph)&&(!window.showUpcomingOnly || (m.utc && new Date(m.utc)>=new Date()))).sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999))}
function renderMatches(){$("matchesBody").innerHTML=filteredMatches().map(m=>`<tr class="${isSoon(m) ? "upcomingRow liveSoon" : ""} ${hasChile(m) ? "highlightChile" : ""}"><td>${m.matchNumber??""}</td><td><span class="chip">${esc(m.group)}</span></td><td><div class="matchTitle"><span class="flag">${m.flagA||"🏳️"}</span><span class="flagText">${esc(m.teamA)}</span><span class="vs">vs</span><span class="flag">${m.flagB||"🏳️"}</span><span class="flagText">${esc(m.teamB)}</span></div><div class="muted">${esc(m.noteA||m.noteB||"")}</div></td><td><strong>🇨🇱 ${localDate(m.utc)}</strong></td><td><div class="venue">🏟️ ${esc(m.venue||"")}</div></td><td><strong>${m.realA??""} - ${m.realB??""}</strong></td><td class="adminOnly"><input type="number" min="0" value="${m.realA??""}" data-real-a="${m.id}" style="width:70px"><input type="number" min="0" value="${m.realB??""}" data-real-b="${m.id}" style="width:70px"><button data-save-result="${m.id}">Guardar</button><button class="danger" data-del-match="${m.id}">Eliminar</button></td></tr>`).join("");document.querySelectorAll("[data-save-result]").forEach(b=>b.onclick=async()=>{let id=b.dataset.saveResult;await updateDoc(doc(db,"matches",id),{realA:document.querySelector(`[data-real-a="${id}"]`).value,realB:document.querySelector(`[data-real-b="${id}"]`).value})});document.querySelectorAll("[data-del-match]").forEach(b=>b.onclick=async()=>{if(confirm("¿Eliminar partido?"))await deleteDoc(doc(db,"matches",b.dataset.delMatch))})}
function renderPredictions(){$("predictionsBody").innerHTML=predictions.map(p=>{let u=participants.find(x=>x.id===p.participantId),m=matches.find(x=>x.id===p.matchId);return(!u||!m)?"":`<tr><td>${esc(u.name)}</td><td>${m.flagA||"🏳️"} ${esc(m.teamA)} vs ${m.flagB||"🏳️"} ${esc(m.teamB)}</td><td>${localDate(m.utc)}</td><td><strong>${p.goalsA} - ${p.goalsB}</strong></td><td>${pts(p,m)}</td></tr>`}).join("")}
function fillSelects(){$("predParticipant").innerHTML=participants.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");$("predMatch").innerHTML=matches.slice().sort((a,b)=>(a.matchNumber||999)-(b.matchNumber||999)).map(m=>`<option value="${m.id}">#${m.matchNumber||""} ${m.flagA||"🏳️"} ${esc(m.teamA)} vs ${m.flagB||"🏳️"} ${esc(m.teamB)} — ${localDate(m.utc)}</option>`).join("")}
function renderTeams(){let teams={};matches.forEach(m=>[[m.teamA,m.flagA,m.noteA],[m.teamB,m.flagB,m.noteB]].forEach(([n,f,note])=>{if(!n||n.includes("Grupo")||n.includes("Ganador")||n.includes("Perdedor")||n.includes("partido"))return;if(!teams[n])teams[n]={name:n,flag:f,fact:note,games:0};teams[n].games++;if(!teams[n].fact)teams[n].fact=note}));$("teamsGrid").innerHTML=Object.values(teams).sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<div class="teamCard"><div class="bigFlag">${t.flag||"🏳️"}</div><h3>${esc(t.name)}</h3><div class="muted">${t.games} partidos cargados</div><p>${esc(t.fact||"Participante del Mundial 2026.")}</p></div>`).join("")}
$("addParticipantBtn").onclick=async()=>{if(!isAdmin)return alert("Solo admin.");let name=$("participantName").value.trim();if(name){await addDoc(collection(db,"participants"),{name,createdAt:serverTimestamp()});$("participantName").value=""}};
$("seedScheduleBtn").onclick=async()=>{if(!isAdmin)return alert("Solo admin.");if(!confirm("¿Cargar/actualizar los 104 partidos? No borra participantes ni predicciones."))return;for(const m of OFFICIAL_MATCHES){let ref=doc(db,"matches",m.id), old=await getDoc(ref), keep=old.exists()?{realA:old.data().realA??"",realB:old.data().realB??""}:{};await setDoc(ref,{...m,...keep,updatedAt:serverTimestamp()})}alert("Calendario cargado con chiminuchina ✅")};
$("savePredictionBtn").onclick=async()=>{if(!isAdmin)return alert("Solo admin.");let participantId=$("predParticipant").value,matchId=$("predMatch").value,goalsA=$("predA").value,goalsB=$("predB").value;if(!participantId||!matchId||goalsA===""||goalsB==="")return alert("Faltan datos.");await setDoc(doc(db,"predictions",`${participantId}_${matchId}`),{participantId,matchId,goalsA,goalsB,updatedAt:serverTimestamp()});$("predA").value=$("predB").value=""};
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(e){alert("No se pudo iniciar sesión: "+e.message)}};$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,user=>{isAdmin=!!user&&user.email===ADMIN_EMAIL;document.body.classList.toggle("isAdmin",isAdmin);$("loginBox").classList.toggle("hidden",!!user);$("adminBox").classList.toggle("hidden",!user);$("adminEmail").textContent=user?.email||"";if(user&&!isAdmin)alert("Este correo no está autorizado como administrador.")});
onSnapshot(query(collection(db,"participants"),orderBy("createdAt","asc")),s=>{participants=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
onSnapshot(query(collection(db,"matches"),orderBy("matchNumber","asc")),s=>{matches=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
onSnapshot(collection(db,"predictions"),s=>{predictions=s.docs.map(d=>({id:d.id,...d.data()}));renderAll()});
