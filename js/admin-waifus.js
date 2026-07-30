// admin-waifus.js — sección "Waifus" (nueva).
//
// Modelo en Firestore: stories/{storyId}/waifus/{waifuId}
// {
//   name, description, imageUrl,
//   affectionStatKey,      // stat que sumás/restás desde choice.effects en los capítulos
//   affectionBase,         // afecto inicial (normalmente 0)
//   routes: ["vanilla","ntr"]   // vacío = disponible en ambas rutas
//   unlockRequires: {...}       // mismo formato que "requires"/"condition" ya usado en el motor
// }
import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  requireAdmin, wireLogout, renderAdminNav, populateStorySelect,
  getActiveStoryId, wireImageUploadButton
} from "./admin-shared.js";

const storySelect = document.getElementById("story-select");
const waifuList = document.getElementById("waifu-list");

requireAdmin(async () => {
  wireLogout();
  renderAdminNav("waifus");
  wireImageUploadButton("waifu-upload-btn", "waifu-image");

  await populateStorySelect(storySelect);
  await loadWaifus();

  storySelect.addEventListener("change", loadWaifus);
});

async function loadWaifus() {
  const storyId = getActiveStoryId();
  waifuList.innerHTML = "Cargando...";
  if (!storyId) {
    waifuList.innerHTML = '<p class="helper-text">Elegí una historia primero (o creá una en la sección Historias).</p>';
    return;
  }

  const snap = await getDocs(collection(db, "stories", storyId, "waifus"));
  const waifus = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  waifuList.innerHTML = "";
  if (!waifus.length) {
    waifuList.innerHTML = '<p class="helper-text">Todavía no hay waifus en esta historia.</p>';
    return;
  }

  waifus.forEach((w) => {
    const routes = (w.routes && w.routes.length) ? w.routes.join(" / ") : "todas las rutas";
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${w.imageUrl ? `<img class="thumb" src="${w.imageUrl}" alt="">` : ""}
      <strong>${w.name}</strong>
      <span class="desc">${w.affectionStatKey || "(sin clave de afecto)"} · ${routes}</span>
      <button data-id="${w.id}" class="edit-waifu-btn secondary">Editar</button>
      <button data-id="${w.id}" class="delete-waifu-btn secondary">Eliminar</button>
    `;
    waifuList.appendChild(row);
  });

  waifuList.querySelectorAll(".delete-waifu-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta waifu?")) return;
      await deleteDoc(doc(db, "stories", storySelect.value, "waifus", btn.dataset.id));
      loadWaifus();
    })
  );

  waifuList.querySelectorAll(".edit-waifu-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadWaifuIntoForm(storySelect.value, btn.dataset.id))
  );
}

async function loadWaifuIntoForm(storyId, waifuId) {
  const snap = await getDoc(doc(db, "stories", storyId, "waifus", waifuId));
  const data = snap.data();
  document.getElementById("waifu-id").value = waifuId;
  document.getElementById("waifu-name").value = data.name ?? "";
  document.getElementById("waifu-description").value = data.description ?? "";
  document.getElementById("waifu-image").value = data.imageUrl ?? "";
  const preview = document.querySelector('img[data-preview-for="waifu-image"]');
  if (data.imageUrl) { preview.src = data.imageUrl; preview.style.display = "block"; }
  else { preview.style.display = "none"; }
  document.getElementById("waifu-affection-key").value = data.affectionStatKey ?? "";
  document.getElementById("waifu-affection-base").value = data.affectionBase ?? 0;
  document.getElementById("waifu-route-vanilla").checked = (data.routes || []).includes("vanilla");
  document.getElementById("waifu-route-ntr").checked = (data.routes || []).includes("ntr");
  document.getElementById("waifu-unlock-requires").value = JSON.stringify(data.unlockRequires || {}, null, 2);
  document.getElementById("waifu-form-title").textContent = `Editando: ${data.name}`;
  document.getElementById("waifu-form").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("waifu-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = getActiveStoryId();
  if (!storyId) return alert("Elegí una historia primero.");
  const waifuId = document.getElementById("waifu-id").value;

  let unlockRequires = {};
  try {
    unlockRequires = JSON.parse(document.getElementById("waifu-unlock-requires").value || "{}");
  } catch (err) {
    return alert("El JSON de la condición de desbloqueo tiene un error: " + err.message);
  }

  const routes = [];
  if (document.getElementById("waifu-route-vanilla").checked) routes.push("vanilla");
  if (document.getElementById("waifu-route-ntr").checked) routes.push("ntr");

  const payload = {
    name: document.getElementById("waifu-name").value,
    description: document.getElementById("waifu-description").value,
    imageUrl: document.getElementById("waifu-image").value || null,
    affectionStatKey: document.getElementById("waifu-affection-key").value.trim() || null,
    affectionBase: Number(document.getElementById("waifu-affection-base").value || 0),
    routes,
    unlockRequires
  };

  if (waifuId) {
    await updateDoc(doc(db, "stories", storyId, "waifus", waifuId), payload);
  } else {
    await addDoc(collection(db, "stories", storyId, "waifus"), payload);
  }

  alert("Waifu guardada.");
  resetWaifuForm();
  loadWaifus();
});

document.getElementById("waifu-form-reset").addEventListener("click", resetWaifuForm);

function resetWaifuForm() {
  document.getElementById("waifu-form").reset();
  document.getElementById("waifu-id").value = "";
  document.getElementById("waifu-form-title").textContent = "Nueva waifu";
  const preview = document.querySelector('img[data-preview-for="waifu-image"]');
  preview.style.display = "none";
}
