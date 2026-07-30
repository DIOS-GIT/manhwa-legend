// admin-stories.js — login + sección "Historias"
//
// OJO: esta página (admin.html) es la ÚNICA que NO usa requireAdmin() de
// admin-shared.js, porque requireAdmin() redirige a admin.html cuando no hay
// sesión — y como esta ES admin.html, eso causaba un bucle infinito de
// redirecciones (la página se recargaba sola sin parar y de paso cortaba la
// descarga del CSS a mitad de camino). Acá el chequeo de sesión se hace en
// el lugar, sin redirigir nunca.
import { db, auth } from "./firebase-config.js";
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { wireLogout, renderAdminNav, populateStorySelect, setActiveStoryId } from "./admin-shared.js";

const loginView = document.getElementById("login-view");
const adminView = document.getElementById("admin-view");
const storySelect = document.getElementById("story-select");
const storyList = document.getElementById("story-list");

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

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "block";
    adminView.style.display = "none";
    return;
  }

  const adminDoc = await getDoc(doc(db, "admins", user.uid));
  if (!adminDoc.exists()) {
    alert("Tu cuenta no tiene permisos de administrador de contenido.");
    await signOut(auth);
    loginView.style.display = "block";
    adminView.style.display = "none";
    return;
  }

  loginView.style.display = "none";
  adminView.style.display = "block";
  wireLogout();
  renderAdminNav("stories");
  await refreshStoryList();
});

storySelect.addEventListener("change", () => setActiveStoryId(storySelect.value));

async function refreshStoryList() {
  await populateStorySelect(storySelect);
  await renderStoryList();
}

async function renderStoryList() {
  storyList.innerHTML = "Cargando...";
  const snap = await getDocs(collection(db, "stories"));
  const stories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  storyList.innerHTML = "";
  if (!stories.length) {
    storyList.innerHTML = '<p class="helper-text">Todavía no hay historias creadas.</p>';
    return;
  }

  stories.forEach((s) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <strong>${s.title}</strong>
      <span class="desc">${s.ageRating || ""} · ${(s.statKeys || []).join(", ")}</span>
      <span class="tag">${s.status || "borrador"}</span>
      <button data-id="${s.id}" class="edit-story-btn secondary">Editar</button>
      <button data-id="${s.id}" class="delete-story-btn secondary">Eliminar</button>
    `;
    storyList.appendChild(row);
  });

  storyList.querySelectorAll(".edit-story-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const s = stories.find((st) => st.id === btn.dataset.id);
      document.getElementById("story-id").value = s.id;
      document.getElementById("story-title").value = s.title || "";
      document.getElementById("story-age-rating").value = s.ageRating || "13+";
      document.getElementById("story-status").value = s.status || "borrador";
      document.getElementById("story-stat-keys").value = (s.statKeys || []).join(", ");
      document.getElementById("story-submit-btn").textContent = "Guardar cambios";
      document.querySelector("#new-story-form").closest("details").open = true;
    })
  );

  storyList.querySelectorAll(".delete-story-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta historia? Esto NO borra sus capítulos/protagonistas/waifus, solo el documento de la historia.")) return;
      await deleteDoc(doc(db, "stories", btn.dataset.id));
      refreshStoryList();
    })
  );
}

document.getElementById("new-story-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = document.getElementById("story-id").value;
  const statKeysRaw = document.getElementById("story-stat-keys").value;
  const payload = {
    title: document.getElementById("story-title").value,
    ageRating: document.getElementById("story-age-rating").value,
    status: document.getElementById("story-status").value,
    statKeys: statKeysRaw.split(",").map((s) => s.trim()).filter(Boolean)
  };

  if (storyId) {
    await updateDoc(doc(db, "stories", storyId), payload);
    alert("Historia actualizada.");
  } else {
    payload.createdAt = Date.now();
    const ref = await addDoc(collection(db, "stories"), payload);
    alert(`Historia creada. ID: ${ref.id}\nAhora agregá protagonistas, waifus y capítulos.`);
  }

  e.target.reset();
  document.getElementById("story-id").value = "";
  document.getElementById("story-submit-btn").textContent = "Crear historia";
  refreshStoryList();
});

document.getElementById("story-form-reset").addEventListener("click", () => {
  document.getElementById("new-story-form").reset();
  document.getElementById("story-id").value = "";
  document.getElementById("story-submit-btn").textContent = "Crear historia";
});
