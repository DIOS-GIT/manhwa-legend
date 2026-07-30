// story-engine.js — v2
// Ahora soporta: selección de protagonista (con stats propias), selección
// de ruta (ntr/vanilla) que decide el capítulo de arranque, y "flags"
// (banderas de texto/booleanas: job, housing, route, harem, etc.) además
// de los stats numéricos que ya existían.
//
// El motor sigue sin saber nada del CONTENIDO (texto, imágenes) — eso vive
// 100% en Firestore y lo carga el equipo desde admin.html.

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const STORAGE_KEY_PREFIX = "manhwa-legend:progress:";

/**
 * stories/{storyId}/protagonists/{protagonistId}
 * {
 *   name, description, imageUrl,
 *   baseStats: { statKey: number, ... },
 *   routes: {
 *     ntr:     { startChapterId: "cap-ntr-1" },
 *     vanilla: { startChapterId: "cap-vanilla-1" }
 *   }
 * }
 *
 * choice.requires ahora acepta, por cada key:
 *   - { min, max }     → chequea contra state.stats[key] (numérico, como antes)
 *   - { equals: val }  → chequea contra state.flags[key] (texto/booleano)
 *
 * choice.setFlags (nuevo, opcional): { job: "detective", route: "ntr" }
 *   asigna directamente esos valores a state.flags (no suma, reemplaza).
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
      stats: {},
      flags: {},          // route, job, housing, protagonistId, harem, etc.
      history: [],
      startedAt: Date.now(),
      finished: false,
      endingId: null
    };
  }

  // ---------- Persistencia local ----------

  saveProgress() {
    localStorage.setItem(STORAGE_KEY_PREFIX + this.storyId, JSON.stringify(this.state));
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

  // ---------- Carga de metadata / protagonistas ----------

  async loadStoryMeta() {
    const snap = await getDoc(this.storyRef);
    if (!snap.exists()) throw new Error(`Historia "${this.storyId}" no existe`);
    this.meta = snap.data();
    return this.meta;
  }

  async getProtagonists() {
    const snap = await getDocs(collection(db, "stories", this.storyId, "protagonists"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  /** Paso 1 del onboarding: elegir protagonista → carga sus stats base */
  async selectProtagonist(protagonistId) {
    const snap = await getDoc(doc(db, "stories", this.storyId, "protagonists", protagonistId));
    if (!snap.exists()) throw new Error(`Protagonista "${protagonistId}" no existe`);
    this._protagonist = { id: snap.id, ...snap.data() };
    this.state.flags.protagonistId = protagonistId;
    this.state.stats = { ...(this._protagonist.baseStats || {}) };
    this.saveProgress();
    return this._protagonist;
  }

  /** Paso 2 del onboarding: elegir ruta (ntr/vanilla) → decide el capítulo de arranque */
  async selectRouteAndStart(route) {
    if (!this._protagonist) throw new Error("Primero hay que elegir un protagonista");
    this.state.flags.route = route;
    const routeInfo = (this._protagonist.routes || {})[route];
    if (!routeInfo || !routeInfo.startChapterId) {
      throw new Error(`La ruta "${route}" no tiene capítulo de arranque configurado`);
    }
    this.state.currentChapterId = routeInfo.startChapterId;
    this.saveProgress();
    return this.getChapter(this.state.currentChapterId);
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
    const snap = await getDocs(collection(db, "stories", this.storyId, "endings"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // ---------- Decisiones ----------

  getAvailableChoices(chapter) {
    return (chapter.choices || []).filter((choice) => this._meetsRequirements(choice.requires));
  }

  _meetsRequirements(requires) {
    if (!requires) return true;
    return Object.entries(requires).every(([key, cond]) => {
      if (cond && typeof cond === "object" && "equals" in cond) {
        return (this.state.flags[key] ?? null) === cond.equals;
      }
      const value = this.state.stats[key] ?? 0;
      if (cond.min !== undefined && value < cond.min) return false;
      if (cond.max !== undefined && value > cond.max) return false;
      return true;
    });
  }

  async applyChoice(chapter, choiceId) {
    const choice = (chapter.choices || []).find((c) => c.id === choiceId);
    if (!choice) throw new Error(`Choice "${choiceId}" no existe en este capítulo`);

    Object.entries(choice.effects || {}).forEach(([statKey, delta]) => {
      this.state.stats[statKey] = (this.state.stats[statKey] ?? 0) + delta;
    });

    if (choice.setFlags) {
      Object.entries(choice.setFlags).forEach(([flagKey, value]) => {
        this.state.flags[flagKey] = value;
      });
    }

    this.state.history.push({ chapterId: chapter.id, choiceId: choice.id, text: choice.text });

    if (choice.nextEndingId) return this._resolveEnding(choice.nextEndingId);

    if (choice.nextChapterId) {
      this.state.currentChapterId = choice.nextChapterId;
      this.saveProgress();
      const nextChapter = await this.getChapter(choice.nextChapterId);
      if (nextChapter.isEnding) return this._resolveEnding(nextChapter.endingId);
      return { type: "chapter", data: nextChapter };
    }

    return this._resolveEndingByStats();
  }

  async _resolveEnding(endingId) {
    const ending = await this.getEnding(endingId);
    this.state.finished = true;
    this.state.endingId = ending.id;
    this.saveProgress();
    return { type: "ending", data: ending };
  }

  async _resolveEndingByStats() {
    const endings = await this.getAllEndings();
    const sorted = endings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const match = sorted.find((e) => this._meetsRequirements(e.condition)) || sorted[sorted.length - 1];
    return this._resolveEnding(match.id);
  }

  buildResultCard() {
    return {
      storyTitle: this.meta?.title,
      protagonistName: this._protagonist?.name,
      route: this.state.flags.route,
      endingId: this.state.endingId,
      stats: { ...this.state.stats },
      decisionsCount: this.state.history.length,
      durationMs: Date.now() - this.state.startedAt
    };
  }
}
