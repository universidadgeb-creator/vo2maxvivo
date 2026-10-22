/* Conexión a Firebase (Firestore + Authentication) para el historial de socios.
 * Pega aquí el objeto firebaseConfig de tu app web (Firebase console → Configuración del proyecto → Tus apps → Web).
 * Esos valores son públicos por diseño: las reglas de herramientas/firestore.rules son las que limitan qué se puede leer y escribir.
 * Si apiKey está vacío, el historial se guarda solo en este navegador. */
window.VIVO47_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};
