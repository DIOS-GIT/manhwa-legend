# Convertite en Leyenda — motor v2 (protagonistas + rutas)

## Qué cambió respecto a la v1

- Nuevo flujo de arranque: el jugador elige **Protagonista** (con sus propias
  stats iniciales) y después **Ruta** (Vanilla / NTR) — recién ahí entra al
  primer capítulo. Ya no hay un `firstChapterId` único por historia: cada
  combinación Protagonista + Ruta define su propio capítulo de arranque.
- Trabajo, vivienda y harem/FMC **no son pantallas nuevas**: se resuelven como
  capítulos normales con decisiones (`choices`), igual que cualquier otro
  punto de la trama. Así aprovechamos el mismo motor sin duplicar lógica.
- `choices` ahora soporta, además de `effects` (suma a stats numéricos):
  - `setFlags`: asigna directamente valores de texto/booleanos
    (ej: `{"job": "detective"}`, `{"housing": "departamento-compartido"}`).
  - `requires` acepta `{"equals": valor}` para chequear flags, además del
    `{"min", "max"}` de siempre para stats numéricos.

## Estructura de archivos (igual que antes + protagonistas)

```
/index.html
/admin.html
/js/firebase-config.js
/js/story-engine.js   → motor v2
/js/main.js            → agrega pantallas de selección de protagonista/ruta
/js/admin.js           → agrega CRUD de protagonistas
/css/styles.css
/css/additions.css     → PEGAR su contenido al final de styles.css
```

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

stories/{storyId}/chapters/{chapterId}
  order, title, sceneText, imageUrl, contentWarnings[],
  isEnding, endingId, choices[]

  choices: [{
    id, text,
    nextChapterId | nextEndingId,
    effects:  { statKey: number, ... },     // suma a stats
    setFlags: { flagKey: valor, ... },       // asigna flags (texto/booleano) — NUEVO
    requires: {
      statKey: { min, max },                 // chequeo numérico, como antes
      flagKey: { equals: valor }             // chequeo de flag — NUEVO
    }
  }]

stories/{storyId}/endings/{endingId}
  title, description, imageUrl,
  condition: { statKey: { min, max } },
  priority
```

## Ejemplo de capítulo con selección de trabajo (usando setFlags)

```json
[
  {
    "id": "detective",
    "text": "Trabajar como detective privado",
    "nextChapterId": "cap-trabajo-detective-1",
    "setFlags": { "job": "detective" }
  },
  {
    "id": "estudiante",
    "text": "Volver a estudiar en la universidad",
    "nextChapterId": "cap-estudio-1",
    "setFlags": { "job": "estudiante" }
  }
]
```

Y más adelante, un capítulo que solo aparece si el jugador eligió ser detective:

```json
{
  "requires": { "job": { "equals": "detective" } }
}
```

## Reglas de seguridad de Firestore (agregar protagonists)

Agregar este bloque dentro de `match /stories/{storyId} { ... }`, junto a
`chapters` y `endings` que ya tenías:

```
match /protagonists/{protagonistId} {
  allow read: if true;
  allow write: if isAdmin();
}
```

## Pendiente: gestión de administradores desde el panel

Se decidió que el admin principal pueda dar permisos a otros usuarios desde
una pestaña del panel (en vez de hacerlo a mano en la consola de Firebase).
Esto requiere una **Cloud Function** (porque las reglas de Firestore no
permiten que un cliente escriba en `/admins/{uid}` de otro usuario por
seguridad). Para desplegar Cloud Functions:

1. El proyecto de Firebase debe estar en el plan **Blaze** (pago por uso —
   el uso real de esta función específica cuesta prácticamente $0).
2. Se necesita Node.js + Firebase CLI instalados y usar la terminal para
   `firebase deploy --only functions`.

Queda pendiente como siguiente paso, a definir si se hace ahora o más
adelante.

## Cloudinary (imágenes)

Pendiente de conectar: subir imagen desde el panel admin directo a
Cloudinary (unsigned upload) y auto-completar el campo `imageUrl` del
capítulo/protagonista/final. Falta el Cloud name y el Upload preset del
usuario para integrarlo.
