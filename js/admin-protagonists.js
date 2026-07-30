// admin-protagonists.js — sección "Protagonistas", ahora en su propia página.
import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  requireAdmin, wireLogout, renderAdminNav, populateStorySelect,
  getActiveStoryId, wireImageUploadButton
} from "./admin-shared.js";

const storySelect = document.getElementById("story-select");
const protagonistList = document.getElementById("protagonist-list");

requireAdmin(async () => {
  wireLogout();
  renderAdminNav("protagonists");
  wireImageUploadButton("protagonist-upload-btn", "protagonist-image");

  await populateStorySelect(storySelect);
  await loadProtagonists();

  storySelect.addEventListener("change", loadProtagonists);
});

async function loadProtagonists() {
  const storyId = getActiveStoryId();
  protagonistList.innerHTML = "Cargando...";
  if (!storyId) {
    protagonistList.innerHTML = '<p class="helper-text">Elegí una historia primero (o creá una en la sección Historias).</p>';
    return;
  }

  const snap = await getDocs(collection(db, "stories", storyId, "protagonists"));
  const protagonists = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  protagonistList.innerHTML = "";
  if (!protagonists.length) {
    protagonistList.innerHTML = '<p class="helper-text">Todavía no hay protagonistas en esta historia.</p>';
    return;
  }

  protagonists.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${p.imageUrl ? `<img class="thumb" src="${p.imageUrl}" alt="">` : ""}
      <strong>${p.name}</strong>
      <span class="tag">${Object.keys(p.baseStats || {}).length} stats</span>
      <button data-id="${p.id}" class="edit-protagonist-btn secondary">Editar</button>
      <button data-id="${p.id}" class="delete-protagonist-btn secondary">Eliminar</button>
    `;
    protagonistList.appendChild(row);
  });

  protagonistList.querySelectorAll(".delete-protagonist-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este protagonista?")) return;
      await deleteDoc(doc(db, "stories", storySelect.value, "protagonists", btn.dataset.id));
      loadProtagonists();
    })
  );

  protagonistList.querySelectorAll(".edit-protagonist-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadProtagonistIntoForm(storySelect.value, btn.dataset.id))
  );
}

async function loadProtagonistIntoForm(storyId, protagonistId) {
  const snap = await getDoc(doc(db, "stories", storyId, "protagonists", protagonistId));
  const data = snap.data();
  document.getElementById("protagonist-id").value = protagonistId;
  document.getElementById("protagonist-name").value = data.name ?? "";
  document.getElementById("protagonist-description").value = data.description ?? "";
  document.getElementById("protagonist-image").value = data.imageUrl ?? "";
  const preview = document.querySelector('img[data-preview-for="protagonist-image"]');
  if (data.imageUrl) { preview.src = data.imageUrl; preview.style.display = "block"; }
  else { preview.style.display = "none"; }
  document.getElementById("protagonist-basestats").value = JSON.stringify(data.baseStats || {}, null, 2);
  document.getElementById("protagonist-route-vanilla").value = data.routes?.vanilla?.startChapterId ?? "";
  document.getElementById("protagonist-route-ntr").value = data.routes?.ntr?.startChapterId ?? "";
  document.getElementById("protagonist-form-title").textContent = `Editando: ${data.name}`;
  document.getElementById("protagonist-form").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("protagonist-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = getActiveStoryId();
  if (!storyId) return alert("Elegí una historia primero.");
  const protagonistId = document.getElementById("protagonist-id").value;

  let baseStats = {};
  try {
    baseStats = JSON.parse(document.getElementById("protagonist-basestats").value || "{}");
  } catch (err) {
    return alert("El JSON de stats base tiene un error: " + err.message);
  }

  const payload = {
    name: document.getElementById("protagonist-name").value,
    description: document.getElementById("protagonist-description").value,
    imageUrl: document.getElementById("protagonist-image").value || null,
    baseStats,
    routes: {
      vanilla: { startChapterId: document.getElementById("protagonist-route-vanilla").value || null },
      ntr: { startChapterId: document.getElementById("protagonist-route-ntr").value || null }
    }
  };

  if (protagonistId) {
    await updateDoc(doc(db, "stories", storyId, "protagonists", protagonistId), payload);
  } else {
    await addDoc(collection(db, "stories", storyId, "protagonists"), payload);
  }

  alert("Protagonista guardado.");
  resetProtagonistForm();
  loadProtagonists();
});

document.getElementById("protagonist-form-reset").addEventListener("click", resetProtagonistForm);

function resetProtagonistForm() {
  document.getElementById("protagonist-form").reset();
  document.getElementById("protagonist-id").value = "";
  document.getElementById("protagonist-form-title").textContent = "Nuevo protagonista";
  const preview = document.querySelector('img[data-preview-for="protagonist-image"]');
  preview.style.display = "none";
}
