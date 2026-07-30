// admin-endings.js — sección "Finales", ahora en su propia página y con lista
// completa (antes solo existía el formulario de creación, sin ver los finales guardados).
import { db } from "./firebase-config.js";
import {
  collection, doc, setDoc, deleteDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  requireAdmin, wireLogout, renderAdminNav, populateStorySelect,
  getActiveStoryId, wireImageUploadButton
} from "./admin-shared.js";

const storySelect = document.getElementById("story-select");
const endingList = document.getElementById("ending-list");
const endingIdInput = document.getElementById("ending-id");

requireAdmin(async () => {
  wireLogout();
  renderAdminNav("endings");
  wireImageUploadButton("ending-upload-btn", "ending-image");

  await populateStorySelect(storySelect);
  await loadEndings();

  storySelect.addEventListener("change", loadEndings);
});

async function loadEndings() {
  const storyId = getActiveStoryId();
  endingList.innerHTML = "Cargando...";
  if (!storyId) {
    endingList.innerHTML = '<p class="helper-text">Elegí una historia primero (o creá una en la sección Historias).</p>';
    return;
  }

  const snap = await getDocs(collection(db, "stories", storyId, "endings"));
  const endings = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  endingList.innerHTML = "";
  if (!endings.length) {
    endingList.innerHTML = '<p class="helper-text">Todavía no hay finales en esta historia.</p>';
    return;
  }

  endings.forEach((en) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${en.imageUrl ? `<img class="thumb" src="${en.imageUrl}" alt="">` : ""}
      <strong>${en.title}</strong>
      <span class="desc">${en.id}</span>
      <span class="tag">prioridad ${en.priority ?? 0}</span>
      <button data-id="${en.id}" class="edit-ending-btn secondary">Editar</button>
      <button data-id="${en.id}" class="delete-ending-btn secondary">Eliminar</button>
    `;
    endingList.appendChild(row);
  });

  endingList.querySelectorAll(".delete-ending-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este final? Revisá antes que ningún capítulo apunte a este endingId.")) return;
      await deleteDoc(doc(db, "stories", storySelect.value, "endings", btn.dataset.id));
      loadEndings();
    })
  );

  endingList.querySelectorAll(".edit-ending-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadEndingIntoForm(storySelect.value, btn.dataset.id))
  );
}

async function loadEndingIntoForm(storyId, endingId) {
  const snap = await getDoc(doc(db, "stories", storyId, "endings", endingId));
  const data = snap.data();
  endingIdInput.value = endingId;
  endingIdInput.disabled = true;
  document.getElementById("ending-title").value = data.title ?? "";
  document.getElementById("ending-description").value = data.description ?? "";
  document.getElementById("ending-image").value = data.imageUrl ?? "";
  const preview = document.querySelector('img[data-preview-for="ending-image"]');
  if (data.imageUrl) { preview.src = data.imageUrl; preview.style.display = "block"; }
  else { preview.style.display = "none"; }
  document.getElementById("ending-condition").value = JSON.stringify(data.condition || {}, null, 2);
  document.getElementById("ending-priority").value = data.priority ?? 0;
  document.getElementById("ending-form-title").textContent = `Editando: ${data.title}`;
  document.getElementById("ending-form").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("ending-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = getActiveStoryId();
  if (!storyId) return alert("Elegí una historia primero.");
  const endingId = endingIdInput.value.trim();
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
  resetEndingForm();
  loadEndings();
});

document.getElementById("ending-form-reset").addEventListener("click", resetEndingForm);

function resetEndingForm() {
  document.getElementById("ending-form").reset();
  endingIdInput.disabled = false;
  document.getElementById("ending-form-title").textContent = "Nuevo final";
  const preview = document.querySelector('img[data-preview-for="ending-image"]');
  preview.style.display = "none";
}
