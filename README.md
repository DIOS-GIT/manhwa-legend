# Convertite en Leyenda — motor v3 (panel admin separado + waifus + Cloudinary)

## Qué cambió respecto a la v2

1. **Panel admin dividido en páginas separadas.** Antes todo vivía en un solo
   `admin.html` gigante. Ahora cada sección es su propia página, con una barra
   de navegación arriba para moverte entre ellas:
   - `admin.html` → Historias (y es también la puerta de login)
   - `admin-protagonists.html` → Protagonistas
   - `admin-waifus.html` → Waifus (nuevo)
   - `admin-chapters.html` → Capítulos y decisiones
   - `admin-endings.html` → Finales (ahora con lista, antes solo tenía el formulario)

   La "historia activa" que elegís en cualquiera de estas páginas queda guardada
   (en `localStorage`) y te sigue al pasar a la siguiente sección, así no la
   tenés que volver a elegir cada vez.

2. **Nueva colección `waifus`.** Cada una tiene nombre, descripción, imagen,
   una "clave de afecto" (el stat que subís/bajás desde las decisiones de los
   capítulos, igual que cualquier otro stat), afecto inicial, en qué ruta(s)
   puede aparecer, y una condición de desbloqueo opcional (mismo formato que
   ya usás en `requires` de las decisiones o `condition` de los finales).

   Esto deja lista la ficha de cada waifu tal como la definimos. Lo que
   **todavía no está conectado** es la lógica del *motor del jugador*
   (`story-engine.js` / `main.js`) para: mostrar automáticamente qué waifus
   se desbloquearon después de cada decisión, y armar rutas de harem con
   varias a la vez. Eso lo dejamos como siguiente paso — avisame cuando
   quieras que lo armemos, ya con las fichas cargadas es más simple.

3. **Subida de imágenes con Cloudinary.** Cada formulario (protagonistas,
   waifus, capítulos, finales) tiene un botón "Subir imagen" al lado del
   campo de URL. Al usarlo se abre el widget de Cloudinary, subís la imagen
   desde tu compu, y el campo de URL se completa solo. Si preferís, podés
   seguir pegando URLs a mano — el botón es un atajo, no obligatorio.

## Estructura de archivos

```
/index.html
/admin.html                 → login + Historias
/admin-protagonists.html
/admin-waifus.html
/admin-chapters.html
/admin-endings.html

/js/firebase-config.js      → sin cambios
/js/cloudinary-config.js    → NUEVO — completá acá tu cloud name y upload preset
/js/admin-shared.js         → NUEVO — login/logout, nav, historia activa, widget Cloudinary
/js/admin-stories.js        → NUEVO — antes vivía dentro de admin.js
/js/admin-protagonists.js   → NUEVO — antes vivía dentro de admin.js
/js/admin-waifus.js         → NUEVO
/js/admin-chapters.js       → NUEVO — antes vivía dentro de admin.js
/js/admin-endings.js        → NUEVO — antes vivía dentro de admin.js
/js/story-engine.js         → motor del jugador, sin cambios
/js/main.js                 → pantallas del jugador, sin cambios

/css/styles.css             → tu hoja de estilos base (no incluida acá, ya la tenés)
/css/admin.css               → NUEVO — todo el estilo del panel admin (antes iba inline en admin.html)
/css/additions-protagonists.css → el archivo que ya tenías (grilla de selección de protagonista
                                    en el juego); pegá su contenido al final de css/styles.css
                                    si todavía no lo hiciste
```

`admin.js` (el archivo viejo que combinaba historias + protagonistas + capítulos
+ finales en un solo módulo) queda reemplazado por los 5 archivos `admin-*.js`
de arriba — podés borrarlo del repo.

## Configurar Cloudinary (una sola vez)

1. Entrá a [console.cloudinary.com](https://console.cloudinary.com) → ícono de
   engranaje (Settings) → pestaña **Upload**.
2. Bajá hasta **Upload presets** → **Add upload preset**.
3. En **Signing Mode** elegí **Unsigned** (así el panel puede subir imágenes
   sin exponer tu API secret) → guardá y copiá el nombre del preset.
4. Abrí `js/cloudinary-config.js` y pegá ese nombre en `CLOUDINARY_UPLOAD_PRESET`.
5. Confirmá que `CLOUDINARY_CLOUD_NAME` sea el tuyo (se ve arriba a la
   izquierda del dashboard de Cloudinary).

Hasta que completes el preset, el botón "Subir imagen" te va a avisar que
falta configurarlo — mientras tanto podés seguir pegando URLs a mano sin
problema.

## Modelo de datos (Firestore)

```
stories/{storyId}
  title, ageRating, statKeys[], status

stories/{storyId}/protagonists/{protagonistId}
  name, description, imageUrl
  baseStats: { statKey: number, ... }
  routes: {
    vanilla: { startChapterId: "cap-vanilla-1" },
    ntr:     { startChapterId: "cap-ntr-1" }
  }

stories/{storyId}/waifus/{waifuId}          ← NUEVO
  name, description, imageUrl
  affectionStatKey: "afecto_yuna"
  affectionBase: 0
  routes: ["vanilla"] | ["ntr"] | []          // vacío = ambas rutas
  unlockRequires: {
    statKey: { min, max },
    flagKey: { equals: valor }
  }

stories/{storyId}/chapters/{chapterId}
  order, title, sceneText, imageUrl, contentWarnings[],
  isEnding, endingId, choices[]

  choices: [{
    id, text,
    nextChapterId | nextEndingId,
    effects:  { statKey: number, ... },     // suma a stats (incluida la clave de afecto de una waifu)
    setFlags: { flagKey: valor, ... },
    requires: {
      statKey: { min, max },
      flagKey: { equals: valor }
    }
  }]

stories/{storyId}/endings/{endingId}
  title, description, imageUrl,
  condition: { statKey: { min, max } },
  priority
```

## Reglas de seguridad de Firestore

Reemplazá el bloque de reglas por este (agrega `waifus` al lado de
`protagonists`, `chapters` y `endings`):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /stories/{storyId} {
      allow read: if resource.data.status == "publicado" || isAdmin();
      allow write: if isAdmin();

      match /chapters/{chapterId} {
        allow read: if true;
        allow write: if isAdmin();
      }
      match /endings/{endingId} {
        allow read: if true;
        allow write: if isAdmin();
      }
      match /protagonists/{protagonistId} {
        allow read: if true;
        allow write: if isAdmin();
      }
      match /waifus/{waifuId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }

    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // se crea manualmente desde la consola de Firebase
    }

    function isAdmin() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
  }
}
```

## Pendiente

- **Conectar waifus al motor del jugador** (mostrar desbloqueos, armar rutas
  de harem) — la ficha de datos ya está lista, falta la lógica en
  `story-engine.js`/`main.js`.
- **Gestión de administradores desde el panel** (dar permisos a otros
  usuarios sin tocar la consola de Firebase a mano) — requiere una Cloud
  Function, proyecto en plan Blaze, y `firebase deploy --only functions`.
