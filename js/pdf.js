/* Construcción de los PDF Vivo 47 Center con jsPDF (port de reporte_pdf.py). */
(function (root) {
  "use strict";
  const C = {
    negro: "#0b0b0b", tinta2: "#52514e", tenue: "#8a8984", linea: "#e6e5e1", suave: "#f5f4f1", azul: "#2a78d6", naranja: "#eb6834",
    gris: "#c3c2b7", ok: "#0ca30c", aviso: "#fab219", falla: "#d03b3b",
    rampa: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab", "#104281"],
    zona: ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"],
    zonaFondo: ["#e7f0fc", "#d5e5f9", "#c3d9f6", "#b0cdf2", "#9ec1ef"],
  };
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const W = 612, H = 792, M = 42, ANCHO = W - 2 * M, TOP = 86, BOTTOM = 742;
  const F = { r: "InterR", m: "InterM", s: "InterS", b: "InterB" };
  const USOS = { Z1: "Calentar, recuperarte entre días duros y caminatas activas.", Z2: "Construir tu base: la mayor parte de tu semana. Mejora el uso de grasa y la resistencia.", Z3: "Ritmo sostenido de carrera larga o tempo. Úsala con moderación.", Z4: "Intervalos de 5 a 15 min para subir tu umbral y correr más rápido sin fatigarte.", Z5: "Series cortas de 1 a 4 min para subir tu VO₂max." };

  // ---------- textos ----------
  const isNum = (x) => typeof x === "number" && isFinite(x);
  const f0 = (x) => x.toFixed(0), f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
  const fechaLarga = (f) => `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
  const kmh = (v, medio) => { if (!isNum(v)) return "—"; if (medio) v = Math.round(v * 2) / 2; return v.toFixed(1).replace(".0", ""); };
  const grupoEdad = (e) => { const g = Math.max(20, Math.min(80, Math.floor(e / 10) * 10)); return `${g} a ${g + 9} años`; };
  const genero = (s, plural = true) => { const m = /^[MF]/i.test(String(s || "")); return plural ? (m ? "mujeres" : "hombres") : (m ? "mujer" : "hombre"); };
  const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0];
  function rangoVel(z, primera, ultima) {
    const a = z.velMin, b = z.velMax, aok = isNum(a), bok = isNum(b);
    if (primera) return bok ? `hasta ${kmh(b, 1)} km/h` : "caminar / trote suave";
    if (ultima) return aok ? `más de ${kmh(a, 1)} km/h` : "máxima velocidad";
    if (aok && bok) return kmh(a, 1) === kmh(b, 1) ? `~${kmh(a, 1)} km/h` : `${kmh(a, 1)}–${kmh(b, 1)} km/h`;
    if (bok) return `hasta ${kmh(b, 1)} km/h`; if (aok) return `más de ${kmh(a, 1)} km/h`; return "—";
  }
  function titular(r) {
    if (r.percentil == null) return `Tu ${r.etiquetaVo2} es de ${f1(r.vo2max)} mL/kg/min`;
    return { Excelente: "Tienes una capacidad aeróbica excelente", "Muy bueno": "Tienes una capacidad aeróbica muy buena", Bueno: "Tienes una buena capacidad aeróbica", Promedio: "Tu capacidad aeróbica está en el promedio", Regular: "Tu capacidad aeróbica tiene mucho margen para crecer", Bajo: "Tu capacidad aeróbica es el mejor punto de partida para mejorar" }[r.categoria];
  }
  function frasePercentil(r) {
    const s = r.socio; if (r.percentil == null) return "Para compararte con personas de tu edad necesitamos tu edad y sexo; pídele al personal que los registre.";
    const p = Math.round(r.percentil); return `Estás en el percentil ${p} de ${genero(s.sexo)} de ${grupoEdad(s.edad)}: de cada 100 ${genero(s.sexo)} de tu edad, tu condición supera a ${p}.`;
  }
  function resumenSocio(r) {
    const s = r.socio, v1 = r.vt1, v2 = r.vt2, ps = [];
    ps.push(`Tu cuerpo puede usar hasta <b>${f1(r.vo2max)} mililitros de oxígeno por cada kilo, cada minuto</b>. Ese es tu motor: entre más oxígeno aprovechas, más energía produces y más rápido o más tiempo puedes moverte. ${frasePercentil(r)}`);
    if (!r.maxima) ps.push("En esta prueba no llegaste del todo a tu límite, así que este valor es tu <b>VO₂ pico</b>: tu capacidad real probablemente es un poco mayor. Te recomendamos repetir la prueba.");
    ps.push(`Tu <b>umbral aeróbico (VT1)</b> está en <b>${v1.fc} lpm</b>, alrededor de ${kmh(v1.velocidad)} km/h. Por debajo de ese ritmo puedes hablar, tu cuerpo usa bastante grasa como combustible y puedes sostener el esfuerzo por mucho tiempo. Tu <b>umbral anaeróbico (VT2)</b> está en <b>${v2.fc} lpm</b>, alrededor de ${kmh(v2.velocidad)} km/h. Arriba de ese punto el cansancio se acumula rápido y solo aguantas unos minutos.`);
    const base = v1.pctVo2max >= 70 ? "Tu base aeróbica está muy desarrollada: trabajas cómodo hasta un porcentaje alto de tu capacidad." : v1.pctVo2max >= 55 ? "Tu base aeróbica es sólida." : "Tu umbral aeróbico llega pronto: entrenar más tiempo en zona 2 hará que puedas correr más rápido con el mismo esfuerzo.";
    const umb = v2.pctVo2max >= 88 ? "Además, aguantas ritmos muy cercanos a tu máximo antes de fatigarte." : v2.pctVo2max >= 78 ? "Tu umbral anaeróbico está en un rango típico de personas entrenadas." : "El trabajo de umbral (zona 4) te ayudará a sostener ritmos más rápidos sin fatigarte.";
    ps.push(base + " " + umb);
    if (s.edad) {
      const pred = Math.round(208 - 0.7 * s.edad), dif = r.fcMax - pred;
      if (Math.abs(dif) >= 10) ps.push(`Tu frecuencia cardiaca máxima fue de ${r.fcMax} lpm, ${dif > 0 ? "más alta" : "más baja"} que la que calcula una fórmula por edad (${pred} lpm). Por eso tus zonas salen de tu prueba y no de fórmulas: las zonas genéricas de un reloj o una app no te funcionarían bien.`);
    }
    return ps;
  }
  function recomendaciones(r) {
    const z = Object.fromEntries(r.zonas.map((x) => [x.codigo, x])), recs = [`Haz la mayor parte de tu entrenamiento (alrededor del 80 % del tiempo) en <b>zona 1 y 2</b>, por debajo de <b>${r.vt1.fc} lpm</b>.`];
    if (["Bajo", "Regular", "Promedio", "Sin referencia (falta edad)"].includes(r.categoria)) {
      recs.push("Empieza con 3 sesiones por semana de 30 a 45 minutos en zona 2. La constancia pesa más que la intensidad.");
      recs.push(`Cuando lleves 4 semanas constantes, agrega una sesión de intervalos en zona 4 (${z.Z4.fcMin}–${z.Z4.fcMax} lpm).`);
    } else {
      recs.push(`Una o dos sesiones por semana de calidad: intervalos en zona 4 (${z.Z4.fcMin}–${z.Z4.fcMax} lpm) o series cortas en zona 5.`);
      recs.push("Evita que tus rodajes \"fáciles\" se vuelvan zona 3: ese ritmo cansa sin dar los beneficios de las zonas 2 ni 4.");
    }
    recs.push("Repite la prueba en 8 a 12 semanas para medir tu avance y ajustar tus zonas.");
    return recs;
  }
  const NOTA_ALTITUD = "Guadalajara está a unos 1,560 m sobre el nivel del mar. A esta altura el VO₂max sale entre 3 y 5 % más bajo que a nivel del mar, así que tu valor a nivel del mar sería un poco mayor.";
  const QUE_ES = "El VO₂max es la cantidad máxima de oxígeno que tu cuerpo puede tomar y usar durante el ejercicio. Es el mejor indicador de tu condición cardiovascular y uno de los que más se relacionan con la salud y la longevidad. Se mide en mililitros de oxígeno por kilo de peso por minuto (mL/kg/min).";
  const AVISO = "Este reporte es una evaluación de condición física y no sustituye una valoración médica. Si tienes alguna condición de salud, consulta a tu médico antes de cambiar tu entrenamiento.";
  function decisionEntrega(r) {
    const auto = r.vt1.metodo !== "validado" || r.vt2.metodo !== "validado", rojas = r.validaciones.filter((v) => v.estado === "falla");
    if (rojas.length) return ["revisar", "Revisar antes de entregar", `Validaciones en rojo: <b>${rojas.map((v) => v.nombre.toLowerCase()).join(", ")}</b>. Lee el detalle abajo antes de decidir si se entrega o se repite la prueba.`];
    if (auto) return ["validar", "Listo para validar umbrales", "La calidad de los datos es suficiente. Antes de entregar, confirma VT1 y VT2 en las gráficas de la página 2."];
    return ["ok", "Listo para entregar", "Datos de buena calidad y umbrales validados por el personal."];
  }
  function mensajesClave(r) {
    const s = r.socio, z2 = r.zonas[1], ms = [];
    ms.push(r.percentil != null ? `Su ${r.etiquetaVo2} es ${f1(r.vo2max)}: nivel <b>${r.categoria.toLowerCase()}</b> (percentil ${Math.round(r.percentil)} de ${genero(s.sexo)} de ${grupoEdad(s.edad)}).` : `Su ${r.etiquetaVo2} es ${f1(r.vo2max)} mL/kg/min (falta edad para el percentil).`);
    ms.push(`Su ritmo "fácil" de verdad es por debajo de <b>${r.vt1.fc} lpm</b> (zona 2: ${z2.fcMin}–${z2.fcMax} lpm, ${rangoVel(z2)}).`);
    ms.push(`Su límite sostenible (VT2) es <b>${r.vt2.fc} lpm</b> a ~${kmh(r.vt2.velocidad)} km/h.`);
    return ms;
  }
  function guion(r) {
    const s = r.socio, n = primerNombre(s.nombre);
    const pasos = [
      ["Abre con el resultado", `"${n}, tu motor aeróbico, el VO₂max, es de ${f1(r.vo2max)}.` + (r.percentil != null ? ` Comparado con ${genero(s.sexo)} de tu edad estás en el percentil ${Math.round(r.percentil)}: es un nivel ${r.categoria.toLowerCase()}."` : `"`)],
      ["Explica qué significa", "\"Es cuánto oxígeno puede usar tu cuerpo por cada kilo en un minuto de esfuerzo máximo. Es como los caballos de fuerza de un coche.\""],
      ["Enseña sus dos umbrales", `"Hasta ${r.vt1.fc} pulsaciones puedes platicar y aguantar mucho tiempo; es tu zona de base. A partir de ${r.vt2.fc} el cansancio se acumula rápido."`],
      ["Entrega sus zonas", "Recorre la tabla de zonas de la página 2 y relaciona cada zona con un tipo de sesión de su plan actual."],
      ["Cierra con un plan", "Acuerden la siguiente prueba en 8 a 12 semanas y 1 o 2 cambios concretos para su semana."],
    ];
    if (r.historial) pasos.splice(pasos.length - 1, 0, ["Muestra su evolución", r.historial.guion + " Apóyate en la sección «Tu evolución» de su reporte."]);
    if (!r.maxima) pasos.splice(1, 0, ["Aclara que no fue máxima", "\"En esta prueba no llegaste a tu límite, así que el valor real es probablemente más alto. Vale la pena repetirla.\""]);
    return pasos;
  }
  function faq(r) {
    const dif = r.vo2maxApp ? 100 * (r.vo2max / r.vo2maxApp - 1) : 0;
    return [
      ["¿Por qué la app de Spiro Fit me dio otro número?", `La app dio ${f1(r.vo2maxApp)} y el reporte ${f1(r.vo2max)} (${dif >= 0 ? "+" : ""}${f0(dif)} %). La app resta un volumen de aire que no participa en el intercambio y eso subestima el oxígeno entre 10 y 20 %. Nosotros recalculamos con el método que validó nuestro especialista en laboratorio, y lo comprobamos con el costo de oxígeno de correr.`],
      ["¿Por qué mis zonas no coinciden con las de mi reloj o la app?", "El reloj usa fórmulas por edad y la app coloca el primer umbral demasiado alto. Tus zonas salen de tu respiración real durante la prueba."],
      ["¿Cuánto puedo mejorar?", "Con 8 a 12 semanas de entrenamiento constante es común subir entre 5 y 15 %. Quien parte de un nivel más bajo suele mejorar más."],
      ["¿Cada cuánto repito la prueba?", "Cada 8 a 12 semanas, en condiciones similares: sin entrenamiento fuerte el día anterior, 2 a 3 horas después de comer y con la misma banda."],
    ];
  }
  function alertas(r) {
    const al = [];
    for (const v of r.validaciones) {
      if (v.estado === "ok") continue;
      if (v.nombre === "Calentamiento") al.push("El inicio de la prueba sugiere nervios o hiperventilación. Si repite, dale 3 a 5 min de reposo con la mascarilla puesta antes de empezar.");
      else if (v.nombre === "Esfuerzo máximo" && !r.maxima) al.push("No presentes el valor como su máximo; propón repetir la prueba en 1 a 2 semanas animándolo más en la última etapa.");
      else if (v.nombre === "Final de la prueba") al.push("El VO₂ cayó al final: revisa que la mascarilla no se haya movido. El VO₂max reportado es el pico antes de la caída.");
      else if (v.nombre === "Peso") al.push("Corrige el peso en el perfil de la app para la próxima prueba.");
      else if (v.nombre === "Duración del ejercicio") al.push("La prueba fue más larga o corta de lo ideal; ajusta los incrementos de velocidad en la siguiente.");
    }
    if (r.socio.edad) { const pred = 208 - 0.7 * r.socio.edad; if (Math.abs(r.fcMax - pred) >= 12) al.push(`Su FC máxima (${r.fcMax}) se aleja ${f0(Math.abs(r.fcMax - pred))} lpm de la fórmula por edad: insiste en que no use zonas automáticas del reloj.`); }
    return al;
  }

  // ---------- motor de maquetación ----------
  function Doc(assets, res, titulo, interno) {
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    for (const [k, file] of Object.entries({ r: "Regular", m: "Medium", s: "SemiBold", b: "Bold" })) {
      doc.addFileToVFS(`Inter-${file}.ttf`, assets.fonts[file]); doc.addFont(`Inter-${file}.ttf`, F[k], "normal");
    }
    doc.setProperties({ title: `${titulo} · ${res.socio.nombre}`, author: "Vivo 47 Center" });
    const L = { doc, y: TOP, page: 1 };
    L.font = (f, size, color) => { doc.setFont(F[f], "normal"); doc.setFontSize(size); doc.setTextColor(color || C.negro); };
    L.decorar = () => {
      doc.setFillColor(C.negro); doc.rect(0, 0, W, 62, "F");
      const lh = 20, lw = lh * assets.logoRatio; doc.addImage(assets.logoBlanco, "PNG", M, 31 - lh / 2, lw, lh, "logo", "FAST");
      L.font("s", 9.5, "#ffffff"); doc.text(titulo, W - M, 27, { align: "right" });
      L.font("r", 8, C.gris); doc.text(`${res.socio.nombre} · ${fechaLarga(res.fecha)}`, W - M, 40, { align: "right" });
      if (interno) { L.font("b", 7, C.aviso); doc.text("USO INTERNO · NO ENTREGAR AL SOCIO", M, 55); }
      L.font("r", 7, C.tenue); doc.text(`Vivo 47 Center · Evaluación cardiopulmonar con Spiro Fit · Generado el ${fechaLarga(new Date())}`, M, H - 28);
      doc.text(String(L.page), W - M, H - 28, { align: "right" });
    };
    L.nueva = () => { doc.addPage(); L.page++; L.y = TOP; L.decorar(); };
    L.espacio = (h) => { if (L.y + h > BOTTOM) L.nueva(); };
    L.decorar();

    // texto enriquecido con <b>...</b>
    L.tokens = (txt) => {
      const out = []; let bold = false;
      for (const part of String(txt).split(/(<\/?b>)/)) {
        if (part === "<b>") { bold = true; continue; } if (part === "</b>") { bold = false; continue; }
        for (const w of part.split(/(\s+)/)) if (w) out.push({ w, bold });
      }
      return out;
    };
    L.lineas = (txt, width, size, f = "r", fb = "s") => {
      const lines = [[]]; let cur = 0;
      for (const t of L.tokens(txt)) {
        doc.setFont(F[t.bold ? fb : f], "normal"); doc.setFontSize(size);
        const tw = doc.getTextWidth(t.w);
        if (/^\s+$/.test(t.w)) { if (lines[lines.length - 1].length) { lines[lines.length - 1].push(t); cur += tw; } continue; }
        if (cur + tw > width && lines[lines.length - 1].length) {
          const last = lines[lines.length - 1]; while (last.length && /^\s+$/.test(last[last.length - 1].w)) last.pop();
          lines.push([]); cur = 0;
        }
        lines[lines.length - 1].push(t); cur += tw;
      }
      return lines;
    };
    L.dibujaLineas = (lines, x, y, size, leading, color, f = "r", fb = "s") => {
      lines.forEach((ln, i) => {
        let cx = x;
        for (const t of ln) { L.font(t.bold ? fb : f, size, color); doc.text(t.w, cx, y + i * leading + size * 0.8); cx += doc.getTextWidth(t.w); }
      });
      return lines.length * leading;
    };
    L.alto = (txt, width, size, leading, f, fb) => L.lineas(txt, width, size, f, fb).length * leading;
    L.parrafo = (txt, o = {}) => {
      const size = o.size || 9.5, lead = o.leading || size * 1.47, w = o.width || ANCHO, x = o.x || M, f = o.f || "r";
      const lines = L.lineas(txt, w - (o.bullet ? 12 : 0), size, f, o.fb || "s");
      if (o.spaceBefore) L.y += o.spaceBefore;
      L.espacio(Math.min(lines.length, 2) * lead);
      let i = 0;
      while (i < lines.length) {
        const cabe = Math.max(1, Math.floor((BOTTOM - L.y) / lead)), chunk = lines.slice(i, i + cabe);
        if (o.bullet && i === 0) { L.font("r", size, o.color || C.negro); doc.text(o.bullet, x, L.y + size * 0.8); }
        L.dibujaLineas(chunk, x + (o.bullet ? 12 : 0), L.y, size, lead, o.color || C.negro, f, o.fb || "s");
        L.y += chunk.length * lead; i += chunk.length;
        if (i < lines.length) L.nueva();
      }
      L.y += o.after != null ? o.after : 6;
    };
    L.kick = (t) => { L.espacio(40); L.font("s", 8, C.tenue); doc.text(t, M, L.y + 7); L.y += 12; };
    L.h1 = (t) => { L.parrafo(t, { size: 22, leading: 27, f: "b", fb: "b", after: 4 }); };
    L.h2 = (t) => { L.y += 10; L.espacio(50); L.parrafo(t, { size: 13.5, leading: 18, f: "s", after: 6 }); };
    L.h3 = (t) => { L.y += 6; L.espacio(40); L.parrafo(t, { size: 10.5, leading: 14, f: "s", after: 3 }); };
    L.pc = (t) => L.parrafo(t, { size: 8.5, leading: 12, color: C.tinta2, after: 4 });

    /** Tabla: cols = anchos; filas = [[celda]]; celda = string | {t, f, color, icono, stripe} */
    L.tabla = (filas, cols, o = {}) => {
      const pad = o.pad != null ? o.pad : 5, size = o.size || 8.5, lead = size * 1.35;
      const celda = (c) => (typeof c === "object" && c !== null ? c : { t: String(c) });
      const altoFila = (fila, esCab) => Math.max(...fila.map((c, j) => { c = celda(c); if (c.icono) return 12; const s = esCab ? 7.5 : size; return L.alto(c.t, cols[j] - 12, s, s * 1.35, c.f || (esCab ? "s" : "r"), "s"); })) + 2 * pad;
      const dibujaFila = (fila, i, esCab) => {
        const h = altoFila(fila, esCab);
        L.espacio(h);
        if (o.zebra && !esCab && i % 2 === 1) { doc.setFillColor(C.suave); doc.rect(M, L.y, ANCHO, h, "F"); }
        if (o.fondos && o.fondos[i]) { let x = M; fila.forEach((c, j) => { if (o.fondos[i][j]) { doc.setFillColor(o.fondos[i][j]); doc.rect(x, L.y, cols[j], h, "F"); } x += cols[j]; }); }
        let x = M;
        fila.forEach((c, j) => {
          c = celda(c);
          if (c.stripe) { doc.setFillColor(c.stripe); doc.rect(x - 2, L.y, 4, h, "F"); }
          if (c.icono) icono(doc, c.icono, x + 6, L.y + h / 2 - 6, 12);
          else { const s = esCab ? 7.5 : size; const ls = L.lineas(c.t, cols[j] - 12, s, c.f || (esCab ? "s" : "r"), "s"); const th = ls.length * s * 1.35; L.dibujaLineas(ls, x + 6, L.y + (h - th) / 2, s, s * 1.35, c.color || (esCab ? C.tinta2 : C.negro), c.f || (esCab ? "s" : "r"), "s"); }
          x += cols[j];
        });
        L.y += h;
        doc.setDrawColor(esCab ? C.negro : C.linea); doc.setLineWidth(esCab ? 1 : 0.5); doc.line(M, L.y, M + cols.reduce((a, b) => a + b, 0), L.y);
      };
      filas.forEach((f, i) => dibujaFila(f, i, o.cabecera && i === 0));
    };
    return L;
  }

  function icono(doc, estado, x, y, d) {
    const col = { ok: C.ok, aviso: C.aviso, falla: C.falla }[estado], sim = { ok: "✓", aviso: "!", falla: "×" }[estado];
    doc.setFillColor(col); doc.circle(x + d / 2, y + d / 2, d / 2, "F");
    doc.setFont(F.b, "normal"); doc.setFontSize(8); doc.setTextColor(estado === "aviso" ? C.negro : "#ffffff");
    doc.text(sim, x + d / 2, y + d / 2 + 2.9, { align: "center" });
  }

  // ---------- gráficas vectoriales ----------
  function niceTicks(lo, hi, n = 5) {
    const span = hi - lo, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  function panel(L, o) {
    const { doc } = L, x0 = o.x + 30, y0 = o.y + 24, w = o.w - 36, h = o.h - 24 - (o.xlabel ? 24 : 12);
    const X = (v) => x0 + (v - o.xmin) / (o.xmax - o.xmin) * w, Y = (v) => y0 + h - (v - o.ymin) / (o.ymax - o.ymin) * h;
    L.font("s", 8.5, C.negro); doc.text(o.title, o.x, o.y + 8);
    if (o.fondo) o.fondo(X, Y, x0, y0, w, h);
    doc.setDrawColor(C.linea); doc.setLineWidth(0.5);
    for (const t of niceTicks(o.ymin, o.ymax, o.ny || 5)) { doc.line(x0, Y(t), x0 + w, Y(t)); L.font("r", 6.8, C.tinta2); doc.text(String(t), x0 - 4, Y(t) + 2.3, { align: "right" }); }
    for (const t of niceTicks(o.xmin, o.xmax, o.nx || 7)) { L.font("r", 6.8, C.tinta2); doc.text(String(t), X(t), y0 + h + 9, { align: "center" }); }
    if (o.xlabel) { L.font("r", 7, C.tinta2); doc.text(o.xlabel, x0 + w / 2, y0 + h + 20, { align: "center" }); }
    return { X, Y, x0, y0, w, h };
  }
  function linea(doc, xs, ys, X, Y, color, lw) {
    doc.setDrawColor(color); doc.setLineWidth(lw); doc.setLineCap("round"); doc.setLineJoin("round");
    let seg = [];
    const flush = () => { if (seg.length > 1) { const d = []; for (let i = 1; i < seg.length; i++) d.push([seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]]); doc.lines(d, seg[0][0], seg[0][1], [1, 1], "S", false); } seg = []; };
    for (let i = 0; i < xs.length; i++) { if (isNum(xs[i]) && isNum(ys[i])) seg.push([X(xs[i]), Y(ys[i])]); else flush(); }
    flush();
  }
  function punto(doc, x, y, color) { doc.setFillColor("#ffffff"); doc.circle(x, y, 4.5, "F"); doc.setFillColor(color); doc.circle(x, y, 3, "F"); }
  function rollMed(a, w) { const h = Math.floor(w / 2); return a.map((_, i) => { const v = a.slice(Math.max(0, i - h), i + w - h).filter(isNum).sort((p, q) => p - q); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN; }); }

  function graficaPrueba(L, r, y, alto) {
    const { doc } = L, d = r.datos.filter((x) => x.t >= r.inicioEjercicio - 30 && x.t <= r.finEjercicio + 120), mins = (t) => (t - r.inicioEjercicio) / 60;
    const xs = d.map((x) => mins(x.t)), xmin = xs[0], xmax = xs[xs.length - 1], ph = alto / 2 - 6;
    const etapasFondo = (X, Y, x0, y0, w, h, etiquetas) => r.etapas.forEach((e, i) => {
      const a = X(mins(e.inicio)), b = X(mins(e.fin)); if (i % 2 === 0) { doc.setFillColor(C.suave); doc.rect(a, y0, b - a, h, "F"); }
      if (etiquetas) { L.font("r", 6.5, C.tenue); doc.text(kmh(e.velocidad), (a + b) / 2, y0 - 2, { align: "center" }); }
    });
    const p1 = panel(L, { x: M, y, w: ANCHO, h: ph, xmin, xmax, ymin: 0, ymax: r.vo2max * 1.18, title: "Consumo de oxígeno (mL/kg/min)", fondo: (X, Y, x0, y0, w, h) => etapasFondo(X, Y, x0, y0 + 8, w, h - 8, true) });
    linea(doc, xs, d.map((x) => x.vo2kg30s), p1.X, p1.Y, C.azul, 2);
    const px = p1.X(mins(r.vo2maxTiempo)), py = p1.Y(r.vo2max); punto(doc, px, py, C.azul);
    L.font("s", 8, C.negro); doc.text(`${r.etiquetaVo2} ${f1(r.vo2max)}`, px - 7, py - 5, { align: "right" });
    const zmin = Math.min(r.zonas[0].fcMin, ...d.map((x) => x.hr).filter((h) => h > 30)) - 5;
    const p2 = panel(L, { x: M, y: y + ph + 12, w: ANCHO, h: ph, xmin, xmax, ymin: zmin, ymax: r.fcMax + 8, title: "Frecuencia cardiaca (lpm) y tus zonas", xlabel: "Minutos de carrera", fondo: (X, Y, x0, y0, w, h) => r.zonas.forEach((z, i) => {
      const a = Y(Math.min(z.fcMax, r.fcMax + 8)), b = Y(Math.max(z.fcMin, zmin)); doc.setFillColor(C.zonaFondo[i]); doc.rect(x0, a, w, b - a, "F");
      if (z.fcMax - z.fcMin >= 6) { L.font("r", 6.5, C.tinta2); doc.text(z.codigo, x0 + w + 3, (a + b) / 2 + 2); }
    }) });
    const hr = rollMed(d.map((x) => (x.hr > 30 ? x.hr : NaN)), 5);
    linea(doc, xs, hr, p2.X, p2.Y, C.negro, 2);
    for (const [u, n] of [[r.vt1, "VT1"], [r.vt2, "VT2"]]) { const ux = p2.X(mins(u.tiempo)), uy = p2.Y(u.fc); punto(doc, ux, uy, C.negro); L.font("s", 7.5, C.negro); doc.text(`${n} · ${u.fc} lpm`, ux - 7, uy - 5, { align: "right" }); }
    L.y = y + alto + 8;
  }

  function graficasUmbrales(L, r, y) {
    const { doc } = L, b = r.bins.filter((x) => x.t >= r.inicioEjercicio + 45), mins = (t) => (t - r.inicioEjercicio) / 60, xs = b.map((x) => mins(x.t));
    const xmin = Math.min(...xs), xmax = Math.max(...xs), pw = ANCHO / 2 - 8, ph = 175;
    const rng = (a, pad = 0.06) => { const v = a.filter(isNum), lo = Math.min(...v), hi = Math.max(...v), p = (hi - lo) * pad; return [lo - p, hi + p]; };
    const marcas = (p) => { for (const [u, n] of [[r.vt1, "VT1"], [r.vt2, "VT2"]]) { const x = p.X(mins(u.tiempo)); doc.setDrawColor(C.negro); doc.setLineWidth(0.8); doc.setLineDashPattern([3, 2], 0); doc.line(x, p.y0, x, p.y0 + p.h); doc.setLineDashPattern([], 0); L.font("s", 7, C.negro); doc.text(n, x, p.y0 - 2, { align: "center" }); } };
    let [lo, hi] = rng(b.map((x) => x.eqo2_s).concat(b.map((x) => x.eqco2_s)));
    const a = panel(L, { x: M, y, w: pw, h: ph, xmin, xmax, ymin: lo, ymax: hi, title: "Equivalentes ventilatorios", xlabel: "Minutos de carrera" });
    linea(doc, xs, b.map((x) => x.eqo2_s), a.X, a.Y, C.azul, 1.8); linea(doc, xs, b.map((x) => x.eqco2_s), a.X, a.Y, C.naranja, 1.8); marcas(a);
    doc.setFillColor(C.azul); doc.rect(a.x0 + a.w - 92, a.y0 - 17, 10, 2.5, "F"); L.font("r", 7, C.negro); doc.text("VE/VO₂", a.x0 + a.w - 78, a.y0 - 14);
    doc.setFillColor(C.naranja); doc.rect(a.x0 + a.w - 45, a.y0 - 17, 10, 2.5, "F"); doc.text("VE/VCO₂", a.x0 + a.w - 31, a.y0 - 14);
    [lo, hi] = rng(b.map((x) => x.peto2_s));
    const p = panel(L, { x: M + pw + 16, y, w: pw, h: ph, xmin, xmax, ymin: lo, ymax: hi, title: "PetO₂ (mmHg)", xlabel: "Minutos de carrera" });
    linea(doc, xs, b.map((x) => x.peto2_s), p.X, p.Y, C.azul, 1.8); marcas(p);
    const vx = b.map((x) => x.vo2_s / 1000), vy = b.map((x) => x.vco2_s / 1000), [xl, xh] = rng(vx), [yl, yh] = rng(vy);
    const v = panel(L, { x: M, y: y + ph + 14, w: pw, h: ph, xmin: xl, xmax: xh, ymin: yl, ymax: yh, title: "V-slope: VCO₂ vs VO₂ (L/min)", xlabel: "VO₂ (L/min)" });
    doc.setDrawColor(C.tenue); doc.setLineWidth(0.6); doc.setLineDashPattern([2, 2], 0); doc.line(v.X(Math.max(xl, yl)), v.Y(Math.max(xl, yl)), v.X(Math.min(xh, yh)), v.Y(Math.min(xh, yh))); doc.setLineDashPattern([], 0);
    doc.setFillColor(C.azul); vx.forEach((x, i) => { if (isNum(x) && isNum(vy[i])) doc.circle(v.X(x), v.Y(vy[i]), 1.8, "F"); });
    for (const [u, n] of [[r.vt1, "VT1"], [r.vt2, "VT2"]]) { let j = 0; b.forEach((x, i) => { if (Math.abs(x.t - u.tiempo) < Math.abs(b[j].t - u.tiempo)) j = i; }); const px = v.X(vx[j]), py = v.Y(vy[j]); punto(doc, px, py, C.negro); L.font("s", 7, C.negro); doc.text(n, px - 7, py - 4, { align: "right" }); }
    [lo, hi] = rng(b.map((x) => x.petco2_s));
    const c = panel(L, { x: M + pw + 16, y: y + ph + 14, w: pw, h: ph, xmin, xmax, ymin: lo, ymax: hi, title: "PetCO₂ (mmHg)", xlabel: "Minutos de carrera" });
    linea(doc, xs, b.map((x) => x.petco2_s), c.X, c.Y, C.naranja, 1.8); marcas(c);
    L.y = y + 2 * ph + 22;
  }

  function heroe(L, r) {
    const { doc } = L, y = L.y;
    L.font("s", 8, C.tenue); doc.text(`TU ${r.etiquetaVo2.toUpperCase()}`, M, y + 8);
    L.font("b", 54, C.negro); const txt = f1(r.vo2max); doc.text(txt, M - 2, y + 58); const tw = doc.getTextWidth(txt);
    L.font("m", 11, C.tinta2); doc.text("mL/kg/min", M + tw + 6, y + 58);
    if (r.percentil != null) {
      const et = `${r.categoria}  ·  Percentil ${Math.round(r.percentil)}`; L.font("s", 9.5, "#ffffff"); const pw = doc.getTextWidth(et) + 22;
      doc.setFillColor(C.negro); doc.roundedRect(M, y + 70, pw, 20, 10, 10, "F"); doc.text(et, M + 11, y + 83.5);
      barraPercentil(L, r, M + 250, y + 40, ANCHO - 250);
    }
    L.y = y + 104;
  }
  function barraPercentil(L, r, x0, y, w) {
    const { doc } = L, t = root.VO2.tablaFriend(r.socio.edad, r.socio.sexo);
    let lo = t[10] - (t[20] - t[10]), hi = t[90] + (t[90] - t[80]) * 1.6; lo = Math.min(lo, r.vo2max - 2); hi = Math.max(hi, r.vo2max + 2);
    const cortes = [lo, t[20], t[40], t[60], t[80], t[90], hi], nombres = ["Bajo", "Regular", "Promedio", "Bueno", "Muy bueno", "Excelente"], X = (v) => x0 + (v - lo) / (hi - lo) * w;
    L.font("s", 8, C.tenue); doc.text(`COMPARADO CON ${genero(r.socio.sexo).toUpperCase()} DE ${grupoEdad(r.socio.edad).toUpperCase()} (FRIEND 2022)`, x0, y - 38);
    const hb = 12;
    for (let i = 0; i < 6; i++) {
      const a = X(cortes[i]), b = X(cortes[i + 1]); doc.setFillColor(C.rampa[i]); doc.roundedRect(a + 1, y, b - a - 2, hb, 3, 3, "F");
      L.font("m", 6.8, C.tinta2); doc.text(nombres[i], (a + b) / 2, y + hb + 10, { align: "center" });
      if (i > 0) { L.font("r", 6.5, C.tenue); doc.text(f1(cortes[i]), a, y + hb + 20, { align: "center" }); }
    }
    const xm = X(r.vo2max); doc.setFillColor(C.negro); doc.triangle(xm, y - 1, xm - 5, y - 9, xm + 5, y - 9, "F");
    doc.setDrawColor(C.negro); doc.setLineWidth(2); doc.line(xm, y - 2, xm, y + hb + 2);
    L.font("s", 8.5, C.negro); doc.text(`Tú: ${f1(r.vo2max)}`, Math.min(Math.max(xm, x0 + 20), x0 + w - 20), y - 13, { align: "center" });
  }
  function tarjetas(L, items) {
    const { doc } = L, n = items.length, gap = 8, w = (ANCHO - gap * (n - 1)) / n, h = 58, y = L.y;
    items.forEach(([etq, val, uni, nota], i) => {
      const x = M + i * (w + gap); doc.setFillColor(C.suave); doc.roundedRect(x, y, w, h, 6, 6, "F");
      L.font("s", 7, C.tenue); doc.text(etq.toUpperCase(), x + 10, y + 15);
      L.font("b", 17, C.negro); doc.text(val, x + 10, y + 36); const vw = doc.getTextWidth(val);
      L.font("m", 8, C.tinta2); doc.text(uni, x + 13 + vw, y + 36);
      L.font("r", 7, C.tenue); doc.text(nota, x + 10, y + h - 9);
    });
    L.y += h;
  }
  function barraZonas(L, r) {
    const { doc } = L, zs = r.zonas, lo = zs[0].fcMin, hi = zs[4].fcMax, X = (v) => M + (v - lo) / (hi - lo) * ANCHO, y = L.y + 24, h = 18;
    zs.forEach((z, i) => {
      const a = X(z.fcMin), b = X(z.fcMax); doc.setFillColor(C.zona[i]); doc.roundedRect(a + 1, y, Math.max(b - a - 2, 2), h, 3, 3, "F");
      if (b - a > 18) { L.font("s", 8, i < 2 ? C.negro : "#ffffff"); doc.text(z.codigo, (a + b) / 2, y + 12.5, { align: "center" }); }
      L.font("r", 7, C.tinta2); doc.text(String(z.fcMin), i ? a : a + 6, y + h + 11, { align: "center" });
    });
    doc.text(String(hi), M + ANCHO - 6, y + h + 11, { align: "center" });
    for (const [u, n] of [[r.vt1, "VT1"], [r.vt2, "VT2"]]) { const xu = X(u.fc); doc.setDrawColor(C.negro); doc.setLineWidth(1.2); doc.line(xu, y - 8, xu, y + h + 2); L.font("s", 7.5, C.negro); doc.text(`${n} · ${u.fc} lpm`, xu, y - 12, { align: "center" }); }
    L.y = y + h + 20;
  }


  // ---------- evolución entre pruebas (r.historial = VO2H.comparar(...)) ----------
  const MES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const fCorta = (iso) => { const f = new Date(iso); return `${f.getDate()} ${MES_C[f.getMonth()]} ${String(f.getFullYear()).slice(2)}`; };
  const ICONO_CAMBIO = { mejora: "ok", baja: "aviso" };
  function celdaCambio(it) {
    if (it.delta == null) return { t: "—", color: C.tenue };
    if (it.estado === "estable") return { t: `${it.texto} · igual`, color: C.tinta2 };
    return { t: `<b>${it.texto}</b>`, color: it.estado === "baja" ? "#9a5b00" : it.estado === "mejora" ? "#0a6e0a" : C.negro };
  }
  function tablaCambios(L, c, claves, o = {}) {
    const by = Object.fromEntries(c.items.map((x) => [x.k, x])), v = (x, dec) => (isNum(x) ? x.toFixed(dec) : "—");
    const filas = [["", "INDICADOR", fCorta(c.previa.fecha).toUpperCase(), "HOY", "CAMBIO"]];
    for (const k of claves) {
      const it = by[k]; if (!it || (it.antes == null && it.ahora == null)) continue;
      const ic = o.sinIconos ? null : ICONO_CAMBIO[it.estado];
      filas.push([ic ? { icono: ic } : "", `<b>${it.nombre}</b>${it.uni === "%" ? "" : ` · ${it.uni}`}`, v(it.antes, it.dec), `<b>${v(it.ahora, it.dec)}</b>`, celdaCambio(it)]);
    }
    L.tabla(filas, o.cols || [22, 190, 80, 80, ANCHO - 372], { cabecera: true, pad: o.pad != null ? o.pad : 4 });
  }
  function graficaEvolucion(L, c, alto) {
    const { doc } = L, ts = c.todas.slice(-8), y0 = L.y + 18, h = alto - 40, n = ts.length;
    L.font("s", 8.5, C.negro); doc.text("VO₂max en cada prueba (mL/kg/min)", M, L.y + 8);
    const vals = ts.map((t) => t.vo2max), hi = Math.max(...vals) * 1.12, lo = Math.max(0, Math.min(...vals) * 0.75);
    const gap = 14, bw = Math.min(70, (ANCHO - gap * (n - 1)) / n), x0 = M + (ANCHO - (bw * n + gap * (n - 1))) / 2, Y = (v) => y0 + h - (v - lo) / (hi - lo) * h;
    doc.setDrawColor(C.linea); doc.setLineWidth(0.5); doc.line(M, y0 + h, M + ANCHO, y0 + h);
    ts.forEach((t, i) => {
      const x = x0 + i * (bw + gap), ult = i === n - 1;
      doc.setFillColor(ult ? C.azul : C.rampa[1]); doc.roundedRect(x, Y(t.vo2max), bw, y0 + h - Y(t.vo2max), 3, 3, "F");
      L.font("b", 10, C.negro); doc.text(f1(t.vo2max), x + bw / 2, Y(t.vo2max) - 5, { align: "center" });
      L.font(ult ? "s" : "r", 7.5, ult ? C.negro : C.tinta2); doc.text(ult ? "Hoy" : fCorta(t.fecha), x + bw / 2, y0 + h + 11, { align: "center" });
      if (!t.maxima) { L.font("r", 6.5, C.tenue); doc.text("pico", x + bw / 2, y0 + h + 20, { align: "center" }); }
    });
    L.y = y0 + h + 26;
  }
  function paginaEvolucionSocio(L, r) {
    const c = r.historial;
    L.nueva(); L.kick("TU EVOLUCIÓN"); L.h1(c.titular);
    L.parrafo(c.socio.intro);
    L.y += 2; graficaEvolucion(L, c, c.todas.length > 1 ? 150 : 0);
    tablaCambios(L, c, ["vo2max", "vt1vel", "vt1fc", "vt2vel", "vt2fc", "velMax", "duracion", "costo", "peso"], { sinIconos: c.cercanas });
    L.y += 3; L.pc("Un cambio menor a ~3 % en el VO₂max, o a media etapa de velocidad, está dentro de la variación normal entre una prueba y otra.");
    if (c.socio.mejoras.length) { L.h2("Lo que mejoró"); for (const t of c.socio.mejoras) L.parrafo(t, { bullet: "•", after: 4 }); }
    if (c.socio.oportunidades.length) { L.h2("Tus áreas de oportunidad"); for (const t of c.socio.oportunidades) L.parrafo(t, { bullet: "•", after: 4 }); }
    if (c.socio.notas.length) { L.h2("Para leer esta comparación"); for (const t of c.socio.notas) L.parrafo(t, { bullet: "•", after: 4 }); }
  }
  function paginaHistorialPersonal(L, r) {
    const c = r.historial, v = (x, d) => (isNum(x) ? x.toFixed(d) : "—");
    L.nueva(); L.kick("HISTORIAL DEL SOCIO"); L.h1(`${c.todas.length} pruebas · ${c.titularPersonal}`);
    L.pc(`Comparación contra la prueba anterior (${fCorta(c.previa.fecha)}, ${c.periodo} antes). Teléfono del registro: ${r.telefonoLegible || "—"}.`);
    L.h3("Todas sus pruebas");
    const filas = [["FECHA", "VO₂", "PERC.", "VT1 lpm · km/h", "VT2 lpm · km/h", "VEL. MÁX", "COSTO O₂", "PESO", "CALIDAD"]];
    for (const t of c.todas) filas.push([`<b>${fCorta(t.fecha)}</b>`, `<b>${v(t.vo2max, 1)}</b>${t.maxima ? "" : " pico"}`, t.percentil != null ? String(t.percentil) : "—", `${t.vt1.fc} · ${v(t.vt1.velocidad, 1)}`, `${t.vt2.fc} · ${v(t.vt2.velocidad, 1)}`, v(t.velMax, 1), v(t.costo, 0), v(t.peso, 1), t.calidad]);
    L.tabla(filas, [60, 52, 40, 76, 76, 52, 54, 44, ANCHO - 454], { cabecera: true, zebra: true, pad: 2.5, size: 8 });
    L.h3("Cambio contra la prueba anterior");
    tablaCambios(L, c, c.items.map((x) => x.k), { pad: 2.5, cols: [22, 170, 80, 80, ANCHO - 352] });
    if (c.personal.mejoras.length) { L.h3("Mejoras"); L.tabla(c.personal.mejoras.map(([t, x]) => [{ icono: "ok" }, `<b>${t}</b>`, x]), [22, 130, ANCHO - 152], { pad: 3 }); }
    if (c.personal.oportunidades.length) { L.h3("Áreas de oportunidad"); L.tabla(c.personal.oportunidades.map(([t, x]) => [{ icono: "aviso" }, `<b>${t}</b>`, x]), [22, 130, ANCHO - 152], { pad: 3 }); }
    if (c.personal.cautelas.length) { L.h3("Antes de presentar la comparación"); for (const t of c.personal.cautelas) L.parrafo(t, { bullet: "!", after: 3, size: 8.5, leading: 12 }); }
    if (c.cercanas && (c.mejoras.length || c.oportunidades.length)) L.pc("Pruebas muy cercanas: el reporte del socio no presenta estas mejoras ni áreas de oportunidad como cambios de entrenamiento.");
  }

  // ---------- reporte para el socio ----------
  function reporteSocio(r, assets) {
    const L = Doc(assets, r, "Evaluación de VO₂max", false), { doc } = L, s = r.socio;
    L.kick(`Hola, ${primerNombre(s.nombre)}`); L.h1(titular(r));
    L.pc([fechaLarga(r.fecha)].concat(s.edad ? [`${s.edad} años`] : [], [`${f1(r.peso)} kg`]).join(" · "));
    L.y += 10; heroe(L, r); L.y += 6;
    tarjetas(L, [["FC máxima", String(r.fcMax), "lpm", "La más alta en la prueba"], ["Umbral aeróbico", String(r.vt1.fc), "lpm", `VT1 · ~${kmh(r.vt1.velocidad)} km/h`], ["Umbral anaeróbico", String(r.vt2.fc), "lpm", `VT2 · ~${kmh(r.vt2.velocidad)} km/h`], ["Velocidad máxima", kmh(r.velMax), "km/h", "Última etapa alcanzada"]]);
    L.y += 8; L.h2("¿Qué es el VO₂max?"); L.parrafo(QUE_ES);
    L.h2("Tu resultado en palabras"); for (const p of resumenSocio(r)) L.parrafo(p);
    if (r.historial) L.parrafo(`${r.historial.socio.intro} Mira tu evolución completa en la sección «Tu evolución», al final de este reporte.`);

    L.nueva(); L.kick("TUS ZONAS DE ENTRENAMIENTO"); L.h1("Entrena con tu propio corazón");
    L.parrafo("Tus zonas salen de tu respiración real durante la prueba, no de una fórmula. Úsalas con tu banda de frecuencia cardiaca o tu reloj (configúralas a mano).");
    L.y += 4; barraZonas(L, r); L.y += 6;
    const filas = [["ZONA", "FC (lpm)", "VELOCIDAD EN BANDA", "CÓMO SE SIENTE", "PARA QUÉ SIRVE"]];
    r.zonas.forEach((z, i) => filas.push([{ t: `<b>${z.codigo}</b> ${z.nombre}`, stripe: C.zona[i] }, `<b>${z.fcMin}–${z.fcMax}</b>`, rangoVel(z, i === 0, i === 4), z.sensacion, USOS[z.codigo]]));
    L.tabla(filas, [88, 62, 82, 128, ANCHO - 360], { cabecera: true });
    L.y += 4; L.pc("Velocidades estimadas en caminadora sin inclinación, a partir de tu prueba.");
    L.h2("Tus dos umbrales");
    L.tabla([[`<b>Umbral aeróbico · VT1</b>`, `<b>${r.vt1.fc} lpm</b>`, `~${kmh(r.vt1.velocidad)} km/h`, "Hasta aquí puedes platicar y sostener el esfuerzo por horas. Es el límite de tu entrenamiento \"fácil\"."], [`<b>Umbral anaeróbico · VT2</b>`, `<b>${r.vt2.fc} lpm</b>`, `~${kmh(r.vt2.velocidad)} km/h`, "Por encima, el ácido láctico se acumula más rápido de lo que lo eliminas y solo aguantas unos minutos."]], [140, 62, 62, ANCHO - 264]);
    L.h2("Recomendaciones para ti"); for (const x of recomendaciones(r)) L.parrafo(x, { bullet: "•", after: 4 });

    L.nueva(); L.kick("TU PRUEBA"); L.h1("Así respondió tu cuerpo");
    L.parrafo("Cada franja es una etapa de la prueba; el número arriba es la velocidad (km/h). Arriba ves cómo subió tu consumo de oxígeno hasta su punto más alto; abajo, tu frecuencia cardiaca atravesando tus zonas.");
    graficaPrueba(L, r, L.y + 4, 330);
    L.h2("Cómo leer tu resultado");
    const notas = [NOTA_ALTITUD, `Tu ${r.etiquetaVo2} se calculó como el promedio más alto de 30 segundos, con el método de nuestro especialista en fisiología, validado en laboratorio.`, "Tu próxima prueba: en 8 a 12 semanas. Llega descansado, 2 a 3 horas después de comer y con ropa para correr."];
    if (!r.maxima) notas.unshift("Esta prueba no alcanzó criterios de esfuerzo máximo, por eso se reporta como VO₂ pico. Tu VO₂max real probablemente es mayor.");
    for (const n of notas) L.parrafo(n, { bullet: "•", after: 4 });
    L.y += 8; L.pc(AVISO);
    if (r.historial) paginaEvolucionSocio(L, r);
    return doc.output("arraybuffer");
  }

  // ---------- hoja del personal ----------
  function reportePersonal(r, assets) {
    const L = Doc(assets, r, "Hoja técnica y guion de entrega", true), { doc } = L, s = r.socio;
    const [clave, titulo, detalle] = decisionEntrega(r), col = { revisar: C.falla, validar: C.aviso, ok: C.ok }[clave];
    L.kick("RESUMEN TÉCNICO"); L.h1(`${s.nombre} · ${fechaLarga(r.fecha)}`);
    const hb = Math.max(36, L.alto(detalle, ANCHO - 172, 8.5, 11.5) + 16);
    doc.setFillColor(col); doc.rect(M, L.y, 150, hb, "F"); doc.setFillColor(C.suave); doc.rect(M + 150, L.y, ANCHO - 150, hb, "F");
    const lt = L.lineas(titulo, 130, 10.5, "s", "s"); L.dibujaLineas(lt, M + 10, L.y + (hb - lt.length * 14) / 2, 10.5, 14, clave === "validar" ? C.negro : "#ffffff", "s", "s");
    const ld = L.lineas(detalle, ANCHO - 172, 8.5); L.dibujaLineas(ld, M + 160, L.y + (hb - ld.length * 11.5) / 2, 8.5, 11.5, C.negro);
    L.y += hb + 10;
    const edad = s.edad ? `${s.edad} años` : "falta edad", sexo = s.edad ? genero(s.sexo, false) : "—", dur = (r.finEjercicio - r.inicioEjercicio) / 60;
    const fecha = `${String(r.fecha.getDate()).padStart(2, "0")}/${String(r.fecha.getMonth() + 1).padStart(2, "0")}/${r.fecha.getFullYear()}`;
    const datos = [
      ["Socio", `${s.nombre} · ${sexo} · ${edad}`, "Fecha de la prueba", fecha],
      ["Peso", `${f1(r.peso)} kg (${r.pesoFuente})`, "Duración corriendo", `${f1(dur)} min`],
      [`${r.etiquetaVo2} recalculado`, `<b>${f1(r.vo2max)}</b> mL/kg/min · ${f2(r.vo2maxAbs)} L/min`, "VO₂max de la app", `${f1(r.vo2maxApp)} mL/kg/min`],
      ["Percentil FRIEND", r.percentil != null ? `${Math.round(r.percentil)} · ${r.categoria}` : "—", "Calidad de los datos", `<b>${r.calidad}</b>`],
      ["FC reposo / máx", `${r.fcReposo} / ${r.fcMax} lpm`, "RER pico (30 s)", f2(r.rerMax)],
      ["VT1", `${r.vt1.fc} lpm · ${kmh(r.vt1.velocidad)} km/h · ${f0(r.vt1.pctFcmax)} % FCmáx · ${f0(r.vt1.pctVo2max)} % VO₂max (${r.vt1.metodo})`, "Costo O₂ al correr", r.costoPromedio ? `${f0(r.costoPromedio)} mL/kg/km` : "—"],
      ["VT2", `${r.vt2.fc} lpm · ${kmh(r.vt2.velocidad)} km/h · ${f0(r.vt2.pctFcmax)} % FCmáx · ${f0(r.vt2.pctVo2max)} % VO₂max (${r.vt2.metodo})`, "Velocidad máxima", `${kmh(r.velMax)} km/h`],
    ].map(([a, b, c, d]) => [{ t: a, f: "s", color: C.tinta2 }, b, { t: c, f: "s", color: C.tinta2 }, d]);
    L.tabla(datos, [88, 210, 92, ANCHO - 390], { pad: 3 });
    L.y += 3; L.pc(`Archivo: ${r.archivo}`);
    L.h2("Validaciones de calidad");
    const lab = { ok: "Correcto", aviso: "Revisar", falla: "Atención" };
    L.tabla([["", "CONTROL", "RESULTADO"]].concat(r.validaciones.map((v) => [{ icono: v.estado }, `<b>${v.nombre}</b> · ${lab[v.estado]}`, v.detalle])), [22, 150, ANCHO - 172], { cabecera: true, pad: 3 });
    L.h3("Criterios de esfuerzo máximo");
    L.tabla(r.criteriosMax.map(([n, ok, det]) => [{ icono: ok ? "ok" : "aviso" }, `<b>${n}</b>`, det]), [22, 170, ANCHO - 192], { pad: 3 });

    L.nueva(); L.kick("VALIDACIÓN DE UMBRALES"); L.h1("Confirma VT1 y VT2 en las gráficas");
    L.pc("<b>VT1</b>: primer aumento sostenido de VE/VO₂ y de PetO₂ sin que suba VE/VCO₂; cambio de pendiente en el V-slope. <b>VT2</b>: VE/VCO₂ empieza a subir y PetCO₂ empieza a bajar. Las líneas punteadas son la propuesta automática.");
    graficasUmbrales(L, r, L.y + 4);
    L.h3("Etapas de la prueba (último minuto de cada etapa)");
    const et = [["KM/H", "MIN", "FC", "VO₂ mL/kg/min", "RER", "VE/VO₂", "VE/VCO₂", "PetO₂", "PetCO₂", "COSTO mL/kg/km"]];
    r.etapas.forEach((e, i) => { const m = r.metricasEtapas[i]; et.push([`<b>${kmh(e.velocidad)}</b>`, `${f1((e.inicio - r.inicioEjercicio) / 60)}–${f1((e.fin - r.inicioEjercicio) / 60)}`, f0(e.fcFinal), f1(e.vo2Final), f2(e.rerFinal), f1(m.eqo2), f1(m.eqco2), f1(m.peto2), f1(m.petco2), e.costoO2 ? f0(e.costoO2) : "—"]); });
    L.tabla(et, [40, 54, 36, 66, 40, 50, 54, 44, 48, ANCHO - 432], { cabecera: true, zebra: true, pad: 2.5, size: 8 });
    L.y += 6; L.pc("¿Corriges un umbral? Escribe la FC en los campos <b>VT1 validado</b> y <b>VT2 validado</b> de la página del generador, tu nombre en <b>Evaluador</b>, y vuelve a generar: las zonas y los textos se recalculan solos.");

    if (r.historial) paginaHistorialPersonal(L, r);

    L.nueva(); L.kick("GUION DE ENTREGA"); L.h1("Cómo explicarle su resultado");
    L.h2("Mensajes clave"); for (const m of mensajesClave(r)) L.parrafo(m, { bullet: "•", after: 4 });
    L.h2("Paso a paso"); L.tabla(guion(r).map(([t, x], i) => [`<b>${i + 1}</b>`, `<b>${t}</b>`, x]), [20, 120, ANCHO - 140]);
    const al = alertas(r); if (al.length) { L.h2("Cuida estos puntos"); for (const a of al) L.parrafo(a, { bullet: "!", after: 4 }); }
    L.h2("Preguntas frecuentes");
    for (const [q, a] of faq(r)) { L.espacio(50); L.parrafo(`<b>${q}</b>`, { after: 2 }); L.pc(a); }
    L.y += 18; L.espacio(40);
    doc.setDrawColor(C.negro); doc.setLineWidth(0.8); doc.line(M, L.y, M + ANCHO, L.y);
    L.font("r", 8.5, C.negro); const ev = s.evaluador || "______________________________";
    L.dibujaLineas(L.lineas(`Validó: <b>${ev}</b>`, ANCHO / 3 - 6, 8.5), M, L.y + 8, 8.5, 11.5, C.negro);
    doc.text("Fecha de entrega: ________________", M + ANCHO / 3, L.y + 15); doc.text("Firma: ______________________", M + 2 * ANCHO / 3, L.y + 15);
    return doc.output("arraybuffer");
  }

  const api = { reporteSocio, reportePersonal, fechaLarga, rangoVel, kmh, titular, decisionEntrega };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VO2PDF = api;
})(typeof window !== "undefined" ? window : globalThis);
