/* Conexión a Firebase (Firestore + Authentication) para el historial de socios.
 * Pega aquí el objeto firebaseConfig de tu app web (Firebase console → Configuración del proyecto → Tus apps → Web).
 * Esos valores son públicos por diseño: los datos los protegen el inicio de sesión y las reglas de herramientas/firestore.rules.
 * Si apiKey está vacío, el historial se guarda solo en este navegador. */
window.VIVO47_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
};
