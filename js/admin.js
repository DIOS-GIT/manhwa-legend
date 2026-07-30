// admin.js — panel de administración de contenido.
// Requiere Firebase Auth (mismo patrón de roles que Punto Frío Bocagrande:
// solo usuarios con doc en /admins/{uid} pueden escribir).

import { db, auth } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const storySelect = document.getElementById("story-select");
const chapterList = document.getElementById("chapter-list");

// ---------------- Auth ----------------

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    document.getElementById("login-error").textContent = "Login inválido: " + err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "block";
    adminView.style.display = "none";
    return;
  }
  // Chequeo de rol: solo usuarios listados en /admins/{uid} pueden editar contenido
  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) {
    alert("Tu cuenta no tiene permisos de administrador de contenido.");
    signOut(auth);
    return;
  }
  loginView.style.display = "none";
  adminView.style.display = "block";
  await refreshStoryList();
});

// ---------------- Historias ----------------

async function refreshStoryList() {
  storySelect.innerHTML = "";
  const snap = await getDocs(collection(db, "stories"));
  snap.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.data().title} (${d.data().status || "borrador"})`;
    storySelect.appendChild(opt);
  });
  if (storySelect.value) loadChapters(storySelect.value);
}

document.getElementById("new-story-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("story-title").value;
  const ageRating = document.getElementById("story-age-rating").value;
  const statKeysRaw = document.getElementById("story-stat-keys").value;
  const statKeys = statKeysRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const ref = await addDoc(collection(db, "stories"), {
    title,
    ageRating,
    statKeys,
    status: "borrador",
    firstChapterId: null,
    createdAt: Date.now()
  });

  alert(`Historia creada. ID: ${ref.id}\nAhora agregá capítulos.`);
  e.target.reset();
  refreshStoryList();
});

storySelect.addEventListener("change", () => loadChapters(storySelect.value));

// ---------------- Capítulos ----------------

async function loadChapters(storyId) {
  chapterList.innerHTML = "Cargando...";
  const snap = await getDocs(collection(db, "stories", storyId, "chapters"));
  const chapters = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  chapterList.innerHTML = "";
  chapters.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <strong>#${ch.order ?? "?"} — ${ch.title}</strong>
      <span class="tag">${ch.isEnding ? "FINAL" : `${(ch.choices || []).length} decisiones`}</span>
      <button data-id="${ch.id}" class="edit-chapter-btn">Editar</button>
      <button data-id="${ch.id}" class="delete-chapter-btn">Eliminar</button>
    `;
    chapterList.appendChild(row);
  });

  chapterList.querySelectorAll(".delete-chapter-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este capítulo?")) return;
      await deleteDoc(doc(db, "stories", storyId, "chapters", btn.dataset.id));
      loadChapters(storyId);
    })
  );

  chapterList.querySelectorAll(".edit-chapter-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadChapterIntoForm(storyId, btn.dataset.id))
  );
}

async function loadChapterIntoForm(storyId, chapterId) {
  const snap = await getDoc(doc(db, "stories", storyId, "chapters", chapterId));
  const data = snap.data();
  document.getElementById("chapter-id").value = chapterId;
  document.getElementById("chapter-order").value = data.order ?? "";
  document.getElementById("chapter-title").value = data.title ?? "";
  document.getElementById("chapter-text").value = data.sceneText ?? "";
  document.getElementById("chapter-image").value = data.imageUrl ?? "";
  document.getElementById("chapter-warnings").value = (data.contentWarnings || []).join(", ");
  document.getElementById("chapter-is-ending").checked = !!data.isEnding;
  document.getElementById("chapter-choices").value = JSON.stringify(data.choices || [], null, 2);
}

document.getElementById("chapter-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = storySelect.value;
  const chapterId = document.getElementById("chapter-id").value;

  let choices = [];
  try {
    choices = JSON.parse(document.getElementById("chapter-choices").value || "[]");
  } catch (err) {
    alert("El JSON de decisiones tiene un error de sintaxis: " + err.message);
    return;
  }

  const payload = {
    order: Number(document.getElementById("chapter-order").value),
    title: document.getElementById("chapter-title").value,
    sceneText: document.getElementById("chapter-text").value,
    imageUrl: document.getElementById("chapter-image").value || null,
    contentWarnings: document
      .getElementById("chapter-warnings")
      .value.split(",").map((s) => s.trim()).filter(Boolean),
    isEnding: document.getElementById("chapter-is-ending").checked,
    choices
  };

  if (chapterId) {
    await updateDoc(doc(db, "stories", storyId, "chapters", chapterId), payload);
  } else {
    const ref = await addDoc(collection(db, "stories", storyId, "chapters"), payload);
    // Si es el primer capítulo de la historia, lo seteamos como firstChapterId
    const storySnap = await getDoc(doc(db, "stories", storyId));
    if (!storySnap.data().firstChapterId) {
      await updateDoc(doc(db, "stories", storyId), { firstChapterId: ref.id });
    }
  }

  alert("Capítulo guardado.");
  e.target.reset();
  document.getElementById("chapter-id").value = "";
  loadChapters(storyId);
});

document.getElementById("chapter-form-reset").addEventListener("click", () => {
  document.getElementById("chapter-form").reset();
  document.getElementById("chapter-id").value = "";
});

// ---------------- Finales ----------------

document.getElementById("ending-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = storySelect.value;
  const endingId = document.getElementById("ending-id").value.trim();
  if (!endingId) return alert("El final necesita un ID corto (ej: final-heroe)");

  let condition = {};
  try {
    condition = JSON.parse(document.getElementById("ending-condition").value || "{}");
  } catch (err) {
    return alert("El JSON de condición tiene un error: " + err.message);
  }

  await setDoc(doc(db, "stories", storyId, "endings", endingId), {
    title: document.getElementById("ending-title").value,
    description: document.getElementById("ending-description").value,
    imageUrl: document.getElementById("ending-image").value || null,
    condition,
    priority: Number(document.getElementById("ending-priority").value || 0)
  });

  alert("Final guardado.");
  e.target.reset();
});
