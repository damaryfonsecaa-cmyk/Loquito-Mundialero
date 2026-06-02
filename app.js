import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* 
  PASO IMPORTANTE:
  Reemplaza este bloque con tu configuración real de Firebase.
  Firebase Console > Project settings > Your apps > Web app > firebaseConfig
*/
const firebaseConfig = {
  apiKey: "AIzaSyCjydf-EE6Z_ZUZ0B48oQFha262sz9KJms",
  authDomain: "la-polla-del-loquito-2026.firebaseapp.com",
  projectId: "la-polla-del-loquito-2026",
  storageBucket: "la-polla-del-loquito-2026.firebasestorage.app",
  messagingSenderId: "891495833735",
  appId: "1:891495833735:web:cc94c249318be9e2851822",
  measurementId: "G-26Z5TPY2HD"
};

/*
  Correo autorizado como administrador.
  Cambia este correo por el tuyo.
*/
const ADMIN_EMAIL = "damary.fonseca.a@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let participants = [];
let matches = [];
let predictions = [];
let isAdmin = false;

const $ = (id) => document.getElementById(id);

document.querySelectorAll("nav button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    btn.classList.add("active");
    $(`view-${btn.dataset.view}`).classList.add("active");
  });
});

function winner(a,b){
  if(a === null || b === null || a === "" || b === "") return "";
  a = Number(a); b = Number(b);
  if(a>b) return "A";
  if(b>a) return "B";
  return "E";
}

function calcPoints(pred, match){
  if(match.realA === undefined || match.realB === undefined || match.realA === "" || match.realB === "") return 0;
  const pa = Number(pred.goalsA), pb = Number(pred.goalsB);
  const ra = Number(match.realA), rb = Number(match.realB);
  if(pa === ra && pb === rb) return 3;
  if(winner(pa,pb) === winner(ra,rb)) return 1;
  return 0;
}

function participantStats(participantId){
  const ps = predictions.filter(p => p.participantId === participantId);
  let pts = 0;
  ps.forEach(p => {
    const m = matches.find(x => x.id === p.matchId);
    if(m) pts += calcPoints(p,m);
  });
  return { count: ps.length, points: pts };
}

function renderAll(){
  renderParticipants();
  renderMatches();
  renderPredictions();
  renderRanking();
  fillSelects();
}

function renderRanking(){
  const rows = participants.map(p => ({...p, ...participantStats(p.id)}))
    .sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));
  $("rankingBody").innerHTML = rows.map((p,i)=>`
    <tr><td>${i+1}</td><td>${escapeHtml(p.name)}</td><td><strong>${p.points}</strong></td><td>${p.count}</td></tr>
  `).join("");
}

function renderParticipants(){
  $("participantsBody").innerHTML = participants.map(p => {
    const st = participantStats(p.id);
    return `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${st.count}</td>
      <td class="adminOnly"><button class="danger" data-del-participant="${p.id}">Eliminar</button></td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-del-participant]").forEach(btn => {
    btn.onclick = async () => {
      if(!isAdmin) return;
      if(confirm("¿Eliminar participante?")) await deleteDoc(doc(db,"participants",btn.dataset.delParticipant));
    };
  });
}

function renderMatches(){
  $("matchesBody").innerHTML = matches.map(m => `
    <tr>
      <td>${escapeHtml(m.group || "")}</td>
      <td>${escapeHtml(m.teamA)} vs ${escapeHtml(m.teamB)}</td>
      <td>${m.date ? new Date(m.date).toLocaleString("es-ES") : ""}</td>
      <td>${m.realA ?? ""} - ${m.realB ?? ""}</td>
      <td class="adminOnly">
        <input type="number" min="0" value="${m.realA ?? ""}" placeholder="A" data-real-a="${m.id}" style="width:70px">
        <input type="number" min="0" value="${m.realB ?? ""}" placeholder="B" data-real-b="${m.id}" style="width:70px">
        <button data-save-result="${m.id}">Guardar</button>
        <button class="danger" data-del-match="${m.id}">Eliminar</button>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-save-result]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.saveResult;
      const a = document.querySelector(`[data-real-a="${id}"]`).value;
      const b = document.querySelector(`[data-real-b="${id}"]`).value;
      await updateDoc(doc(db,"matches",id), { realA: a, realB: b });
    };
  });

  document.querySelectorAll("[data-del-match]").forEach(btn => {
    btn.onclick = async () => {
      if(confirm("¿Eliminar partido?")) await deleteDoc(doc(db,"matches",btn.dataset.delMatch));
    };
  });
}

function renderPredictions(){
  $("predictionsBody").innerHTML = predictions.map(p => {
    const participant = participants.find(x=>x.id===p.participantId);
    const match = matches.find(x=>x.id===p.matchId);
    if(!participant || !match) return "";
    return `<tr>
      <td>${escapeHtml(participant.name)}</td>
      <td>${escapeHtml(match.teamA)} vs ${escapeHtml(match.teamB)}</td>
      <td>${p.goalsA} - ${p.goalsB}</td>
      <td>${calcPoints(p,match)}</td>
    </tr>`;
  }).join("");
}

function fillSelects(){
  $("predParticipant").innerHTML = participants.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  $("predMatch").innerHTML = matches.map(m=>`<option value="${m.id}">${escapeHtml(m.teamA)} vs ${escapeHtml(m.teamB)}</option>`).join("");
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[s]));
}

$("addParticipantBtn").onclick = async () => {
  if(!isAdmin) return alert("Solo admin.");
  const name = $("participantName").value.trim();
  if(!name) return;
  await addDoc(collection(db,"participants"), { name, createdAt: serverTimestamp() });
  $("participantName").value = "";
};

$("addMatchBtn").onclick = async () => {
  if(!isAdmin) return alert("Solo admin.");
  const group = $("matchGroup").value.trim();
  const teamA = $("teamA").value.trim();
  const teamB = $("teamB").value.trim();
  const date = $("matchDate").value;
  if(!teamA || !teamB) return alert("Faltan equipos.");
  await addDoc(collection(db,"matches"), { group, teamA, teamB, date, realA:"", realB:"", createdAt: serverTimestamp() });
  $("matchGroup").value = $("teamA").value = $("teamB").value = $("matchDate").value = "";
};

$("savePredictionBtn").onclick = async () => {
  if(!isAdmin) return alert("Solo admin.");
  const participantId = $("predParticipant").value;
  const matchId = $("predMatch").value;
  const goalsA = $("predA").value;
  const goalsB = $("predB").value;
  if(!participantId || !matchId || goalsA === "" || goalsB === "") return alert("Faltan datos.");
  const id = `${participantId}_${matchId}`;
  await setDoc(doc(db,"predictions",id), { participantId, matchId, goalsA, goalsB, updatedAt: serverTimestamp() });
  $("predA").value = $("predB").value = "";
};

$("loginBtn").onclick = async () => {
  try{
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  }catch(e){
    alert("No se pudo iniciar sesión: " + e.message);
  }
};

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  isAdmin = !!user && user.email === ADMIN_EMAIL;
  document.body.classList.toggle("isAdmin", isAdmin);
  $("loginBox").classList.toggle("hidden", !!user);
  $("adminBox").classList.toggle("hidden", !user);
  $("adminEmail").textContent = user?.email || "";
  if(user && !isAdmin) alert("Este correo no está autorizado como administrador.");
});

onSnapshot(query(collection(db,"participants"), orderBy("createdAt","asc")), snap => {
  participants = snap.docs.map(d=>({id:d.id,...d.data()}));
  renderAll();
});

onSnapshot(query(collection(db,"matches"), orderBy("createdAt","asc")), snap => {
  matches = snap.docs.map(d=>({id:d.id,...d.data()}));
  renderAll();
});

onSnapshot(collection(db,"predictions"), snap => {
  predictions = snap.docs.map(d=>({id:d.id,...d.data()}));
  renderAll();
});
