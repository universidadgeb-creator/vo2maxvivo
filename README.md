# Reportes VO₂max · Vivo 47 Center

Página web que lee el Excel que exporta Spiro Fit, analiza la prueba de VO₂max y genera dos PDF por socio:

- **Reporte del socio** (3 páginas, para entregar).
- **Hoja del personal** (validaciones de calidad y guion, uso interno).

Todo el cálculo se hace en el navegador de quien usa la página. Los Excel y los datos de los socios **no se suben a ningún servidor**.

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

**Dónde se guarda:** en una base de datos de **Supabase**, protegida con inicio de sesión del personal. No queda nada en el navegador y se ve desde cualquier computadora. Sin Supabase configurado (`js/config.js` vacío), la página funciona como antes: guarda en el navegador (localStorage).

### Activar Supabase (una sola vez)
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** pega y ejecuta `herramientas/supabase.sql` (crea la tabla `pruebas` con RLS: solo usuarios con sesión leen y escriben).
3. En **Authentication → Providers → Email** deja activo el correo y **desactiva «Allow new users to sign up»**. En **Authentication → Users → Add user** crea las cuentas del personal (correo + contraseña, marca «Auto confirm»).
4. En **Project Settings → API** copia la *Project URL* y la clave *anon public* y pégalas en `js/config.js`. La clave anon es pública por diseño; nunca pongas la `service_role`.
5. Sube el cambio a GitHub; Pages lo publica.

Al primer inicio de sesión, lo que hubiera guardado en ese navegador se sube a Supabase y se borra del navegador. «Exportar/Importar respaldo» sigue disponible.

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
js/historial.js            historial por teléfono (Supabase) y comparación entre pruebas
js/config.js               URL y clave pública de Supabase
herramientas/supabase.sql  tabla y políticas de seguridad del historial
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
