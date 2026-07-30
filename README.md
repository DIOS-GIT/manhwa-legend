# Convertite en Leyenda — motor de historias interactivas

Estructura tipo "Copero" pero de historia lineal por capítulos con decisiones
(elegí tu propia aventura), armada sobre Firebase + GitHub Pages, sin build
tools — mismo stack que tus otros proyectos.

## Estructura de archivos

```
/index.html          → pantalla del jugador
/admin.html           → panel de carga de contenido (requiere login)
/js/firebase-config.js
/js/story-engine.js   → motor: estado, stats, decisiones, finales (sin UI)
/js/main.js           → pinta capítulos y decisiones en pantalla
/js/admin.js           → CRUD de historias / capítulos / finales
/css/styles.css
```

## Modelo de datos (Firestore)

```
stories/{storyId}
  title, ageRating, statKeys[], status, firstChapterId

stories/{storyId}/chapters/{chapterId}
  order, title, sceneText, imageUrl, contentWarnings[],
  isEnding, endingId, choices[]

  choices: [{
    id, text,
    nextChapterId | nextEndingId,
    effects: { statKey: number, ... },       // ej: { "honor": 2 }
    requires: { statKey: { min, max } }       // opcional: oculta la choice
                                                // si el jugador no cumple
  }]

stories/{storyId}/endings/{endingId}
  title, description, imageUrl,
  condition: { statKey: { min, max } },
  priority
```

El **motor no sabe nada del contenido**: todo el texto, imágenes y ramas
narrativas se cargan desde `admin.html`. Podés tener historias de distinta
clasificación de edad (`ageRating: "13+" | "16+" | "18+"`) usando exactamente
el mismo motor.

## Reglas de seguridad recomendadas (Firestore)

Igual patrón de roles que usás en Punto Frío Bocagrande: un documento en
`/admins/{uid}` habilita edición.

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

Para dar de alta a un admin: creá manualmente en la consola de Firebase un
documento `admins/{uid_del_usuario}` con cualquier campo (ej. `{ role: "editor" }`).

## Clasificación de edad y verificación (+18)

El motor deja el campo `ageRating` a nivel de historia y `contentWarnings` a
nivel de capítulo, pero **no implementa verificación de edad real** — eso lo
tienen que decidir ustedes según dónde publiquen. Dos caminos comunes:

1. **Gate simple**: un interstitial antes de `index.html` que pide confirmar
   mayoría de edad (`localStorage` flag), sin validación real — rápido pero débil.
2. **Verificación real**: requiere un proveedor externo de verificación de edad
   o, como mínimo, login obligatorio con fecha de nacimiento almacenada. Si van
   a publicar esto públicamente (no solo para uso interno del equipo), les
   recomiendo investigar los requisitos legales de verificación de edad para
   contenido +18 en las jurisdicciones donde lo van a distribuir — varían
   bastante y siguen cambiando.

## Formato de decisiones (JSON) que carga el equipo de escritores

```json
[
  {
    "id": "aceptar",
    "text": "Aceptar la propuesta del clan rival",
    "nextChapterId": "cap-04",
    "effects": { "honor": -1, "poder": 2 }
  },
  {
    "id": "rechazar",
    "text": "Rechazarla y quedarte leal a tu maestro",
    "nextChapterId": "cap-05",
    "effects": { "honor": 2 },
    "requires": { "honor": { "min": 0 } }
  }
]
```

- `effects` suma/resta a los stats definidos en `statKeys` de la historia.
- `requires` es opcional: si el jugador no cumple el rango, esa opción no
  aparece (permite ramas que solo se desbloquean según decisiones previas).
- Si una choice no tiene `nextChapterId` ni `nextEndingId`, el motor resuelve
  automáticamente el final que mejor matchea los stats acumulados
  (usando `condition` + `priority` de cada final).

## Cómo probar localmente

Igual que tus otros proyectos: como usa GitHub Pages sin build tools, podés
abrirlo con cualquier servidor estático simple, por ejemplo:

```bash
npx serve .
```

Y recordá el issue que ya conocés: el CDN de GitHub Pages cachea agresivo,
así que testeá cambios recientes en incógnito.

## Próximos pasos sugeridos

- [ ] Cargar `firebase-config.js` con las credenciales reales del proyecto
- [ ] Crear el primer usuario admin en Firestore (`admins/{uid}`)
- [ ] Publicar las reglas de seguridad de arriba
- [ ] Cargar una historia de prueba corta (3-4 capítulos) para validar el flujo
- [ ] Decidir el mecanismo de verificación de edad antes de publicar contenido +18
- [ ] (Opcional) Agregar Cloudinary para las imágenes de cada capítulo, mismo
      patrón que usás en agencia-de-turismo
