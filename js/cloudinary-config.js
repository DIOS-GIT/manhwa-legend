// cloudinary-config.js
// Configuración para subir imágenes directo desde el panel admin (protagonistas,
// waifus, capítulos y finales) sin pasar por tu servidor.
//
// Pasos para completar esto (una sola vez):
// 1. Andá a https://console.cloudinary.com → ícono de engranaje (Settings) → pestaña "Upload".
// 2. Bajá hasta "Upload presets" → "Add upload preset".
// 3. En "Signing Mode" elegí "Unsigned" (así el panel admin puede subir sin exponer tu API secret).
// 4. Guardalo y copiá el nombre del preset (ej: "manhwa_unsigned") acá abajo.
//
// El cloud name ya lo tenés (se ve en la URL de tu Media Library, ej. console.cloudinary.com/app/c-XXXX/...
// y arriba a la izquierda del dashboard). Según tu captura de pantalla es "dy66brku6" — confirmalo en
// tu dashboard antes de subir a producción.

export const CLOUDINARY_CLOUD_NAME = "dy66brku6"; // <-- confirmá que sea el tuyo
export const CLOUDINARY_UPLOAD_PRESET = "PEGAR_TU_UPLOAD_PRESET_UNSIGNED_ACA";
export const CLOUDINARY_FOLDER = "HERO MANHWA"; // opcional, carpeta donde se guardan las subidas
