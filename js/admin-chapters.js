// admin-chapters.js — sección "Capítulos y decisiones", ahora en su propia página.
import { db } from "./firebase-config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  requireAdmin, wireLogout, renderAdminNav, populateStorySelect,
  getActiveStoryId, wireImageUploadButton
} from "./admin-shared.js";

const storySelect = document.getElementById("story-select");
const chapterList = document.getElementById("chapter-list");

requireAdmin(async () => {
  wireLogout();
  renderAdminNav("chapters");
  wireImageUploadButton("chapter-upload-btn", "chapter-image");

  await populateStorySelect(storySelect);
  await loadChapters();

  storySelect.addEventListener("change", loadChapters);
});

async function loadChapters() {
  const storyId = getActiveStoryId();
  chapterList.innerHTML = "Cargando...";
  if (!storyId) {
    chapterList.innerHTML = '<p class="helper-text">Elegí una historia primero (o creá una en la sección Historias).</p>';
    return;
  }

  const snap = await getDocs(collection(db, "stories", storyId, "chapters"));
  const chapters = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  chapterList.innerHTML = "";
  if (!chapters.length) {
    chapterList.innerHTML = '<p class="helper-text">Todavía no hay capítulos en esta historia.</p>';
    return;
  }

  chapters.forEach((ch) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${ch.imageUrl ? `<img class="thumb" src="${ch.imageUrl}" alt="">` : ""}
      <strong>#${ch.order ?? "?"} — ${ch.title}</strong>
      <span class="tag">${ch.isEnding ? "FINAL" : `${(ch.choices || []).length} decisiones`}</span>
      <button data-id="${ch.id}" class="edit-chapter-btn secondary">Editar</button>
      <button data-id="${ch.id}" class="delete-chapter-btn secondary">Eliminar</button>
    `;
    chapterList.appendChild(row);
  });

  chapterList.querySelectorAll(".delete-chapter-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este capítulo?")) return;
      await deleteDoc(doc(db, "stories", storySelect.value, "chapters", btn.dataset.id));
      loadChapters();
    })
  );

  chapterList.querySelectorAll(".edit-chapter-btn").forEach((btn) =>
    btn.addEventListener("click", () => loadChapterIntoForm(storySelect.value, btn.dataset.id))
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
  const preview = document.querySelector('img[data-preview-for="chapter-image"]');
  if (data.imageUrl) { preview.src = data.imageUrl; preview.style.display = "block"; }
  else { preview.style.display = "none"; }
  document.getElementById("chapter-warnings").value = (data.contentWarnings || []).join(", ");
  document.getElementById("chapter-is-ending").checked = !!data.isEnding;
  document.getElementById("chapter-ending-id").value = data.endingId ?? "";
  document.getElementById("chapter-choices").value = JSON.stringify(data.choices || [], null, 2);
  document.getElementById("chapter-form-title").textContent = `Editando: ${data.title}`;
  document.getElementById("chapter-form").scrollIntoView({ behavior: "smooth" });
}

document.getElementById("chapter-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storyId = getActiveStoryId();
  if (!storyId) return alert("Elegí una historia primero.");
  const chapterId = document.getElementById("chapter-id").value;

  let choices = [];
  try {
    choices = JSON.parse(document.getElementById("chapter-choices").value || "[]");
  } catch (err) {
    return alert("El JSON de decisiones tiene un error de sintaxis: " + err.message);
  }

  const payload = {
    order: Number(document.getElementById("chapter-order").value),
    title: document.getElementById("chapter-title").value,
    sceneText: document.getElementById("chapter-text").value,
    imageUrl: document.getElementById("chapter-image").value || null,
    contentWarnings: document.getElementById("chapter-warnings")
      .value.split(",").map((s) => s.trim()).filter(Boolean),
    isEnding: document.getElementById("chapter-is-ending").checked,
    endingId: document.getElementById("chapter-ending-id").value || null,
    choices
  };

  if (chapterId) {
    await updateDoc(doc(db, "stories", storyId, "chapters", chapterId), payload);
  } else {
    await addDoc(collection(db, "stories", storyId, "chapters"), payload);
  }

  alert("Capítulo guardado. Recordá: el capítulo de arranque de cada ruta se define en " +
    "Protagonistas, no acá.");
  resetChapterForm();
  loadChapters();
});

document.getElementById("chapter-form-reset").addEventListener("click", resetChapterForm);

function resetChapterForm() {
  document.getElementById("chapter-form").reset();
  document.getElementById("chapter-id").value = "";
  document.getElementById("chapter-form-title").textContent = "Nuevo capítulo";
  const preview = document.querySelector('img[data-preview-for="chapter-image"]');
  preview.style.display = "none";
}
