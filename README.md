# Reportes VO₂max · Vivo 47 Center

Página web que lee el Excel que exporta Spiro Fit, analiza la prueba de VO₂max y genera dos PDF por socio:

- **Reporte del socio** (3 páginas, para entregar).
- **Hoja del personal** (validaciones de calidad y guion, uso interno).

Todo el cálculo se hace en el navegador de quien usa la página. Los Excel y los datos de los socios **no se suben a ningún servidor**.

## Ajustes de la retro del experto (octubre 2026)

- **Edad y sexo obligatorios.** El percentil se compara contra personas de la misma edad y sexo; ya no se autollenan por nombre (dos socios con el mismo nombre daban la edad equivocada).
- **Sin RER > 1.1 como criterio.** El esfuerzo máximo se juzga por meseta de VO₂ y FC ≥ 85 % de la esperada (Tanaka). El RER pico solo se muestra como dato informativo.
- **UV1 / UV2 (antes VT1 / VT2).** UV1 se propone sola y se confirma; UV2 con este equipo debe definirse **a mano**: clic en la gráfica de equivalentes + PetO₂/PetCO₂ (eje secundario) o escribe la FC en "Umbrales".
- **Inicio del calentamiento.** El Excel marca 8 km/h desde el tiempo 0; la página detecta el inicio real (se puede escribir a mano en mm:ss), muestra una fila "Base" a 0 km/h y usa tiempos absolutos en tablas y gráficas.
- **Textos quitados:** "¿Cuánto puedo mejorar?" y "¿Cada cuánto repito la prueba?" (criterio del evaluador y entrenador).
- Se mantiene el recálculo de VO₂ con Haldane (el VO₂max no cambia).

## Cómo se usa

1. Abre la página.
2. Arrastra o elige el Excel de Spiro Fit.
3. Escribe edad y sexo del socio (peso, VT1/VT2 validados y evaluador son opcionales).
4. Da clic en **Analizar prueba** y luego descarga los PDF.

## Historial y evolución de cada socio

- Escribe el **teléfono del socio** (clave del país, +52 por defecto, y el número) al analizar la prueba. La prueba queda guardada ligada a ese teléfono.
- Al analizar una prueba nueva con un teléfono que ya tiene pruebas, la página las busca y compara: VO₂max, umbrales VT1/VT2 (velocidad, FC y % del VO₂max), velocidad máxima, tiempo corriendo, costo de O₂ al correr, FC de reposo y peso.
- Un cambio cuenta como real cuando supera la variación normal entre pruebas (±3 % en VO₂max y costo de O₂, media etapa de velocidad, 3 puntos de % VO₂max). Si entre pruebas pasaron menos de 3 semanas, se presenta como prueba de reproducibilidad, no como progreso.
- El **reporte del socio** agrega la sección «Tu evolución» (gráfica, tabla de cambios, lo que mejoró y áreas de oportunidad). La **hoja del personal** agrega «Historial del socio» (todas sus pruebas, tabla completa de cambios, mejoras, áreas de oportunidad, cautelas) y un paso de guion para explicar la evolución.
- Tipos de mejora que reconoce: capacidad aeróbica máxima, composición corporal (cuando el VO₂max sube por bajar de peso), umbral anaeróbico, base aeróbica, economía de carrera, rendimiento y recuperación.

**Dónde se guarda:** en **Firebase (Firestore)**, protegido con inicio de sesión del personal. No queda nada en el navegador y se ve desde cualquier computadora. Sin Firebase configurado (`js/config.js` vacío), la página funciona como antes: guarda en el navegador (localStorage). Todo cabe en el plan gratuito **Spark** (no pide tarjeta).

### Activar Firebase (una sola vez)
1. En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto (puedes desactivar Google Analytics).
2. **Build → Firestore Database → Crear base de datos** (modo producción, región cercana).
3. **Build → Authentication → Comenzar → Correo/contraseña → Habilitar**. En la pestaña *Usuarios* usa «Agregar usuario» para crear las cuentas del personal.
4. En Firestore → **Reglas**, pega `herramientas/firestore.rules`, cambia los correos de ejemplo por los del personal y publica. Esa lista es lo que realmente protege los datos: aunque alguien cree una cuenta, sin su correo en la lista no lee ni escribe nada.
5. **Configuración del proyecto → Tus apps → Web (`</>`)**: registra la app y copia el objeto `firebaseConfig` a `js/config.js`. Esos valores son públicos por diseño.
6. **Authentication → Configuración → Dominios autorizados**: agrega `universidadgeb-creator.github.io`.
7. Sube el cambio a GitHub; Pages lo publica.

Al primer inicio de sesión, lo que hubiera guardado en ese navegador se sube a Firebase y se borra del navegador. «Exportar/Importar respaldo» sigue disponible.

Los límites gratuitos de Spark (1 GiB almacenado, 50 mil lecturas y 20 mil escrituras al día) sobran para este uso: cada prueba pesa unos pocos KB.

## Publicarla con GitHub Pages

1. Crea un repositorio en GitHub (puede ser privado si tu plan lo permite; en el plan gratis, Pages requiere repositorio público).
2. Sube **el contenido** de esta carpeta a la raíz del repositorio (`index.html` debe quedar en la raíz). Desde la web: *Add file → Upload files* y arrastra todo.
3. Ve a *Settings → Pages*. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guarda.
4. En uno o dos minutos la página queda en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

También funciona en Netlify, Vercel o cualquier hosting de archivos estáticos, y abriendo `index.html` directo con doble clic.

## Estructura

```
index.html                 página
css/estilos.css            estilos
js/historial.js            historial por teléfono (Firebase) y comparación entre pruebas
js/config.js               configuración pública de Firebase
herramientas/firestore.rules  reglas de seguridad del historial
js/engine.js               cálculo: VO₂ (método del especialista), VO₂max, umbrales, percentiles FRIEND, validaciones
js/pdf.js                  armado de los dos PDF (jsPDF)
js/app.js                  interfaz: carga del Excel, formulario, descargas
js/recursos.js             GENERADO: fuentes, logo y prueba de ejemplo en base64
js/vendor/                 SheetJS 0.18.5 (Apache-2.0) y jsPDF 2.5.1 (MIT), incluidas para no depender de internet
assets/fonts/              Inter (SIL Open Font License)
assets/logos/              logos Vivo 47 Center
herramientas/              script para regenerar recursos.js y la prueba de ejemplo
```

## Hacer cambios

- Textos, reglas o cálculos: edita `js/engine.js` o `js/pdf.js`.
- Diseño de la página: `css/estilos.css` e `index.html`.
- Si cambias una fuente, el logo o la prueba de ejemplo, regenera los recursos:

  ```
  python herramientas/generar_recursos.py
  ```

Para probar en tu computadora basta con abrir `index.html`. Si prefieres un servidor local: `python -m http.server` y entra a `http://localhost:8000`.

Los logos son propiedad de Vivo 47 Center.
