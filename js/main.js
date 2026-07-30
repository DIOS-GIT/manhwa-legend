// main.js — controla la pantalla del jugador.
// Toda la lógica de estado vive en story-engine.js; este archivo solo pinta.

import { StoryEngine } from "./story-engine.js";

const params = new URLSearchParams(location.search);
const storyId = params.get("story") || "demo-story";
const deck = document.getElementById("panel-deck");

const engine = new StoryEngine(storyId);

async function init() {
  await engine.loadStoryMeta();

  const hadProgress = engine.loadProgress();
  let chapter;

  if (hadProgress && !engine.state.finished) {
    chapter = await engine.getChapter(engine.state.currentChapterId);
  } else if (hadProgress && engine.state.finished) {
    return renderEnding(await engine.getEnding(engine.state.endingId));
  } else {
    chapter = await engine.start();
  }

  renderChapter(chapter);
}

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
  // Deshabilita todos los botones para evitar doble click
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
        .map(
          ([key, value]) => `<div class="stat-row"><span>${key}</span><span>${value}</span></div>`
        )
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
    const text = `Terminé "${card.storyTitle}" como: ${ending.title} 🔥`;
    if (navigator.share) {
      navigator.share({ text, url: location.href });
    } else {
      navigator.clipboard.writeText(`${text} ${location.href}`);
      alert("Resultado copiado al portapapeles");
    }
  });
}

init();
