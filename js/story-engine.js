// story-engine.js
// Motor central del juego. No conoce nada de UI ni de contenido narrativo:
// solo sabe cargar capítulos desde Firestore, aplicar efectos de las
// decisiones sobre el estado del jugador, y resolver el final correspondiente.
//
// El contenido (textos, imágenes, decisiones, finales) vive 100% en Firestore
// y lo carga el equipo desde el panel admin. Este archivo es reutilizable
// para cualquier historia, con cualquier temática o clasificación de edad.

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const STORAGE_KEY_PREFIX = "manhwa-legend:progress:";

/**
 * Forma esperada de un documento de capítulo en Firestore:
 * stories/{storyId}/chapters/{chapterId}
 * {
 *   order: number,
 *   title: string,
 *   sceneText: string,
 *   imageUrl: string | null,
 *   ageRating: "13+" | "16+" | "18+",
 *   contentWarnings: string[],       // ej: ["violencia", "temática adulta"]
 *   isEnding: boolean,
 *   endingId: string | null,         // solo si isEnding = true
 *   choices: [
 *     {
 *       id: string,
 *       text: string,
 *       nextChapterId: string | null,  // null si esta choice lleva directo a un final
 *       nextEndingId: string | null,
 *       effects: { [statKey: string]: number },  // ej: { carisma: 2, honor: -1 }
 *       requires: { [statKey: string]: { min?: number, max?: number } } // opcional, gating
 *     }
 *   ]
 * }
 *
 * Forma esperada de un final:
 * stories/{storyId}/endings/{endingId}
 * {
 *   title: string,
 *   description: string,
 *   imageUrl: string,
 *   // condición para que este final se elija automáticamente cuando isEnding
 *   // se resuelve por stats en vez de por choice explícita:
 *   condition: { [statKey: string]: { min?: number, max?: number } },
 *   priority: number // finales con mayor prioridad se evalúan primero
 * }
 */

export class StoryEngine {
  constructor(storyId) {
    this.storyId = storyId;
    this.storyRef = doc(db, "stories", storyId);
    this.state = this._freshState();
  }

  _freshState() {
    return {
      storyId: this.storyId,
      currentChapterId: null,
      stats: {},          // se inicializa según defaultStats de la historia
      history: [],         // [{chapterId, choiceId, text}]
      flags: {},           // banderas booleanas para gating narrativo
      startedAt: Date.now(),
      finished: false,
      endingId: null
    };
  }

  // ---------- Persistencia local (progreso del jugador, sin login) ----------

  saveProgress() {
    localStorage.setItem(
      STORAGE_KEY_PREFIX + this.storyId,
      JSON.stringify(this.state)
    );
  }

  loadProgress() {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + this.storyId);
    if (!raw) return false;
    this.state = JSON.parse(raw);
    return true;
  }

  clearProgress() {
    localStorage.removeItem(STORAGE_KEY_PREFIX + this.storyId);
    this.state = this._freshState();
  }

  // ---------- Carga de contenido ----------

  async loadStoryMeta() {
    const snap = await getDoc(this.storyRef);
    if (!snap.exists()) throw new Error(`Historia "${this.storyId}" no existe`);
    this.meta = snap.data();
    // Inicializa stats en 0 según lo definido por la historia
    if (Object.keys(this.state.stats).length === 0) {
      (this.meta.statKeys || []).forEach((key) => (this.state.stats[key] = 0));
    }
    return this.meta;
  }

  async getChapter(chapterId) {
    const ref = doc(db, "stories", this.storyId, "chapters", chapterId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Capítulo "${chapterId}" no existe`);
    return { id: snap.id, ...snap.data() };
  }

  async getEnding(endingId) {
    const ref = doc(db, "stories", this.storyId, "endings", endingId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Final "${endingId}" no existe`);
    return { id: snap.id, ...snap.data() };
  }

  async getAllEndings() {
    const snap = await getDocs(
      collection(db, "stories", this.storyId, "endings")
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async start() {
    if (!this.meta) await this.loadStoryMeta();
    this.state.currentChapterId = this.meta.firstChapterId;
    this.saveProgress();
    return this.getChapter(this.state.currentChapterId);
  }

  // ---------- Lógica de decisiones ----------

  /** Devuelve solo las choices que el jugador puede tomar según sus stats actuales */
  getAvailableChoices(chapter) {
    return (chapter.choices || []).filter((choice) =>
      this._meetsRequirements(choice.requires)
    );
  }

  _meetsRequirements(requires) {
    if (!requires) return true;
    return Object.entries(requires).every(([statKey, range]) => {
      const value = this.state.stats[statKey] ?? 0;
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
      return true;
    });
  }

  /**
   * Aplica una decisión: suma los efectos a los stats, guarda historial,
   * y devuelve el siguiente paso (capítulo o final).
   */
  async applyChoice(chapter, choiceId) {
    const choice = (chapter.choices || []).find((c) => c.id === choiceId);
    if (!choice) throw new Error(`Choice "${choiceId}" no existe en este capítulo`);

    Object.entries(choice.effects || {}).forEach(([statKey, delta]) => {
      this.state.stats[statKey] = (this.state.stats[statKey] ?? 0) + delta;
    });

    this.state.history.push({
      chapterId: chapter.id,
      choiceId: choice.id,
      text: choice.text
    });

    if (choice.nextEndingId) {
      return this._resolveEnding(choice.nextEndingId);
    }

    if (choice.nextChapterId) {
      this.state.currentChapterId = choice.nextChapterId;
      this.saveProgress();
      const nextChapter = await this.getChapter(choice.nextChapterId);
      if (nextChapter.isEnding) {
        return this._resolveEnding(nextChapter.endingId);
      }
      return { type: "chapter", data: nextChapter };
    }

    // Si la choice no define next explícito, se resuelve el final por stats
    return this._resolveEndingByStats();
  }

  async _resolveEnding(endingId) {
    const ending = await this.getEnding(endingId);
    this.state.finished = true;
    this.state.endingId = ending.id;
    this.saveProgress();
    return { type: "ending", data: ending };
  }

  /** Cuando no hay un final explícito, se elige el que mejor matchea los stats finales */
  async _resolveEndingByStats() {
    const endings = await this.getAllEndings();
    const sorted = endings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const match =
      sorted.find((e) => this._meetsRequirements(e.condition)) || sorted[sorted.length - 1];
    return this._resolveEnding(match.id);
  }

  // ---------- Tarjeta de resultado ----------

  buildResultCard() {
    return {
      storyTitle: this.meta?.title,
      endingId: this.state.endingId,
      stats: { ...this.state.stats },
      decisionsCount: this.state.history.length,
      durationMs: Date.now() - this.state.startedAt
    };
  }
}
