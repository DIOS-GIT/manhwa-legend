// main.js — v2
// Ahora el flujo arranca con: 1) elegir protagonista, 2) elegir ruta (ntr/vanilla).
// Trabajo, vivienda y harem se resuelven como capítulos normales con decisiones
// (usando el mismo motor de siempre), así que no necesitan pantallas especiales.

import { StoryEngine } from "./story-engine.js";

const params = new URLSearchParams(location.search);
const storyId = params.get("story") || "demo-story";
const deck = document.getElementById("panel-deck");

const engine = new StoryEngine(storyId);

async function init() {
  await engine.loadStoryMeta();

  const hadProgress = engine.loadProgress();

  if (hadProgress && engine.state.finished) {
    return renderEnding(await engine.getEnding(engine.state.endingId));
  }

  if (hadProgress && engine.state.currentChapterId) {
    // Ya eligió protagonista y ruta antes, seguimos desde el capítulo guardado
    const chapter = await engine.getChapter(engine.state.currentChapterId);
    return renderChapter(chapter);
  }

  // Sin progreso: arrancar el onboarding (protagonista → ruta → primer capítulo)
  renderProtagonistSelect();
}

// ---------------- Paso 1: elegir protagonista ----------------

async function renderProtagonistSelect() {
  const protagonists = await engine.getProtagonists();

  const panel = document.createElement("section");
  panel.className = "chapter-panel";
  panel.dataset.chapterNum = "ELEGÍ TU PERSONAJE";

  panel.innerHTML = `
    <h2>¿Quién vas a ser?</h2>
    <div class="protagonist-grid"></div>
  `;

  const grid = panel.querySelector(".protagonist-grid");
  protagonists.forEach((p) => {
    const card = document.createElement("button");
    card.className = "choice-btn protagonist-card";
    card.innerHTML = `
      ${p.imageUrl ? `<img src="${p.imageUrl}" alt="">` : ""}
      <strong>${p.name}</strong>
      <p>${p.description || ""}</p>
    `;
    card.addEventListener("click", () => handleProtagonistPick(p.id, panel));
    grid.appendChild(card);
  });

  deck.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleProtagonistPick(protagonistId, prevPanel) {
  await engine.selectProtagonist(protagonistId);
  prevPanel.querySelectorAll("button").forEach((b) => (b.disabled = true));
  renderRouteSelect();
}

// ---------------- Paso 2: elegir ruta ----------------

function renderRouteSelect() {
  const panel = document.createElement("section");
  panel.className = "chapter-panel";
  panel.dataset.chapterNum = "ELEGÍ TU CAMINO";

  panel.innerHTML = `
    <h2>¿Qué tipo de historia querés vivir?</h2>
    <div class="choices"></div>
  `;

  const choicesWrap = panel.querySelector(".choices");

  const routes = [
    { id: "vanilla", label: "Vanilla" },
    { id: "ntr", label: "NTR" }
  ];

  routes.forEach((r) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = r.label;
    btn.addEventListener("click", async () => {
      choicesWrap.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const chapter = await engine.selectRouteAndStart(r.id);
      renderChapter(chapter);
    });
    choicesWrap.appendChild(btn);
  });

  deck.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------- Capítulos normales (igual que antes) ----------------

function renderChapter(chapter) {
  const num = chapter.order ?? "?";
  const warnings = (chapter.contentWarnings || []).join(" · ");

  const panel = document.createElement("section");
  panel.className = "chapter-panel";
  panel.dataset.chapterNum = `CAP. ${num}`;

  panel.innerHTML = `
    ${chapter.imageUrl ? `<img src="${chapter.imageUrl}" alt="">` : ""}
    ${warnings ? `<span class="content-warning">${warnings}</span>` : ""}
    <h2>${chapter.title}</h2>
    <p>${chapter.sceneText}</p>
    <div class="choices"></div>
  `;

  deck.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  const choicesWrap = panel.querySelector(".choices");
  const available = engine.getAvailableChoices(chapter);

  available.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = choice.text;
    btn.addEventListener("click", () => handleChoice(chapter, choice.id, choicesWrap));
    choicesWrap.appendChild(btn);
  });
}

async function handleChoice(chapter, choiceId, choicesWrap) {
  [...choicesWrap.children].forEach((b) => (b.disabled = true));
  const result = await engine.applyChoice(chapter, choiceId);
  if (result.type === "ending") {
    renderEnding(result.data);
  } else {
    renderChapter(result.data);
  }
}

function renderEnding(ending) {
  const card = engine.buildResultCard();

  const panel = document.createElement("section");
  panel.className = "result-card";
  panel.innerHTML = `
    ${ending.imageUrl ? `<img src="${ending.imageUrl}" alt="" style="width:100%;border-radius:2px;margin-bottom:16px;">` : ""}
    <h1>${ending.title}</h1>
    <p>${ending.description}</p>
    <div class="stats-summary">
      ${Object.entries(card.stats)
        .map(([key, value]) => `<div class="stat-row"><span>${key}</span><span>${value}</span></div>`)
        .join("")}
    </div>
    <button class="share-btn" id="share-btn">Compartir resultado</button>
    <button class="share-btn" id="restart-btn" style="background:transparent;border:1px solid var(--gold);color:var(--gold);margin-left:8px;">Jugar de nuevo</button>
  `;

  deck.appendChild(panel);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  panel.querySelector("#restart-btn").addEventListener("click", () => {
    engine.clearProgress();
    deck.innerHTML = "";
    init();
  });

  panel.querySelector("#share-btn").addEventListener("click", () => {
    const text = `Terminé "${card.storyTitle}" como ${card.protagonistName}: ${ending.title} 🔥`;
    if (navigator.share) {
      navigator.share({ text, url: location.href });
    } else {
      navigator.clipboard.writeText(`${text} ${location.href}`);
      alert("Resultado copiado al portapapeles");
    }
  });
}

init();
