// admin-shared.js
// Funciones comunes a TODAS las páginas del panel admin (historias, protagonistas,
// waifus, capítulos, finales): chequeo de sesión/admin, selector de "historia activa"
// persistido en localStorage (así no hay que re-elegirla al cambiar de página), navegación
// entre secciones, y el widget de subida de imágenes de Cloudinary.

import { db, auth } from "./firebase-config.js";
import {
  doc, getDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, CLOUDINARY_FOLDER } from "./cloudinary-config.js";

const ACTIVE_STORY_KEY = "manhwa-admin:activeStoryId";

// ---------------- Sesión ----------------

/** Llamar al arrancar cada página admin-*.html. Redirige a admin.html si no hay sesión
 *  o si el usuario no está en /admins/{uid}. Si todo bien, ejecuta onReady(user). */
export function requireAdmin(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "admin.html";
      return;
    }
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (!adminDoc.exists()) {
      alert("Tu cuenta no tiene permisos de administrador de contenido.");
      await signOut(auth);
      location.href = "admin.html";
      return;
    }
    onReady(user);
  });
}

export function wireLogout(buttonId = "logout-btn") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    await signOut(auth);
    location.href = "admin.html";
  });
}

// ---------------- Navegación entre secciones ----------------

const NAV_ITEMS = [
  { id: "stories", href: "admin.html", label: "Historias" },
  { id: "protagonists", href: "admin-protagonists.html", label: "Protagonistas" },
  { id: "waifus", href: "admin-waifus.html", label: "Waifus" },
  { id: "chapters", href: "admin-chapters.html", label: "Capítulos" },
  { id: "endings", href: "admin-endings.html", label: "Finales" }
];

export function renderAdminNav(activeId) {
  const nav = document.getElementById("admin-nav");
  if (!nav) return;
  nav.innerHTML = NAV_ITEMS.map(
    (it) => `<a href="${it.href}" class="admin-nav-link${it.id === activeId ? " active" : ""}">${it.label}</a>`
  ).join("");
}

// ---------------- Historia activa (compartida entre páginas) ----------------

/** Llena un <select> con todas las historias y deja seleccionada la última usada.
 *  Devuelve el storyId activo. Guarda en localStorage cada vez que cambia. */
export async function populateStorySelect(selectEl) {
  selectEl.innerHTML = "";
  const snap = await getDocs(collection(db, "stories"));
  snap.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.data().title} (${d.data().status || "borrador"})`;
    selectEl.appendChild(opt);
  });

  const saved = getActiveStoryId();
  if (saved && [...selectEl.options].some((o) => o.value === saved)) {
    selectEl.value = saved;
  } else if (selectEl.options.length) {
    selectEl.value = selectEl.options[0].value;
  }

  if (selectEl.value) setActiveStoryId(selectEl.value);

  selectEl.addEventListener("change", () => setActiveStoryId(selectEl.value));

  return selectEl.value;
}

export function getActiveStoryId() {
  return localStorage.getItem(ACTIVE_STORY_KEY) || "";
}

export function setActiveStoryId(id) {
  localStorage.setItem(ACTIVE_STORY_KEY, id);
}

// ---------------- Subida de imágenes (Cloudinary) ----------------

let widgetInstance = null;

/** Abre el widget de subida de Cloudinary y llama onUploaded(secureUrl) cuando termina.
 *  Requiere que el script https://upload-widget.cloudinary.com/global/all.js esté cargado
 *  en la página (lo agregamos en cada admin-*.html). */
export function openCloudinaryWidget(onUploaded) {
  if (!window.cloudinary) {
    alert("El widget de subida todavía está cargando, esperá un segundo y probá de nuevo.");
    return;
  }
  if (CLOUDINARY_UPLOAD_PRESET.startsWith("PEGAR_")) {
    alert(
      "Falta configurar Cloudinary: abrí js/cloudinary-config.js y pegá el nombre de tu " +
      "upload preset (sin firmar). Mientras tanto podés seguir pegando URLs de imagen a mano."
    );
    return;
  }

  if (!widgetInstance) {
    widgetInstance = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        folder: CLOUDINARY_FOLDER,
        multiple: false,
        sources: ["local", "url", "camera"],
        styles: {
          palette: {
            window: "#151015",
            windowBorder: "#332B33",
            tabIcon: "#C9A34E",
            link: "#C9A34E",
            action: "#C9A34E",
            inProgress: "#C9A34E",
            complete: "#4CAF50",
            error: "#B23A48",
            textDark: "#151015",
            textLight: "#EDE3D0"
          }
        }
      },
      (error, result) => {
        if (!error && result && result.event === "success") {
          onUploaded(result.info.secure_url);
        }
      }
    );
  }
  widgetInstance.open();
}

/** Conecta un botón "Subir imagen" a un <input> de texto: al subir, pega la URL en el input
 *  y refresca la miniatura de preview si existe un <img data-preview-for="inputId">. */
export function wireImageUploadButton(buttonId, inputId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    openCloudinaryWidget((url) => {
      input.value = url;
      const preview = document.querySelector(`img[data-preview-for="${inputId}"]`);
      if (preview) {
        preview.src = url;
        preview.style.display = "block";
      }
    });
  });
}
