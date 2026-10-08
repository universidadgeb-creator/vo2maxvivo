/* Historial de pruebas por socio (ligado a su teléfono) y comparación entre pruebas.
 * Los registros viven en Supabase (con inicio de sesión del personal); sin Supabase configurado, en localStorage. */
(function (root) {
  "use strict";
  const CLAVE = "vivo47-historial-v1";
  const isNum = (x) => typeof x === "number" && isFinite(x);
  const r1 = (x) => (isNum(x) ? Math.round(x * 10) / 10 : null);
  const r0 = (x) => (isNum(x) ? Math.round(x) : null);
  const DIA = 86400000;

  const LADAS = [
    ["+52", "México"], ["+1", "EE. UU. / Canadá"], ["+34", "España"], ["+57", "Colombia"], ["+54", "Argentina"], ["+56", "Chile"],
    ["+51", "Perú"], ["+593", "Ecuador"], ["+58", "Venezuela"], ["+502", "Guatemala"], ["+503", "El Salvador"], ["+504", "Honduras"],
    ["+505", "Nicaragua"], ["+506", "Costa Rica"], ["+507", "Panamá"], ["+591", "Bolivia"], ["+595", "Paraguay"], ["+598", "Uruguay"],
    ["+53", "Cuba"], ["+1809", "Rep. Dominicana"], ["+44", "Reino Unido"], ["+33", "Francia"], ["+49", "Alemania"], ["+39", "Italia"],
  ];

  /** "+52" + "33 1234 5678" -> "+523312345678" (o null si el número no parece válido). */
  function normalizarTelefono(lada, numero) {
    const l = "+" + String(lada || "").replace(/\D/g, ""), n = String(numero || "").replace(/\D/g, "");
    if (l === "+" || n.length < 7 || n.length > 13) return null;
    return l + n;
  }
  function telefonoLegible(tel) {
    const m = LADAS.map(([l]) => l).sort((a, b) => b.length - a.length).find((l) => tel.startsWith(l));
    const lada = m || tel.slice(0, 3), n = tel.slice(lada.length);
    const n10 = n.length === 10 ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}` : n;
    return `${lada} ${n10}`;
  }

  // ---------- almacenamiento ----------
  // Copia en memoria (cache). Si hay Supabase configurado, el historial vive solo allí (tabla "pruebas", con inicio de
  // sesión del personal) y no se guarda nada en el navegador. Sin Supabase, se usa localStorage como respaldo local.
  const idDe = (rec) => `${rec.telefono}|${rec.fecha}`;
  const idDoc = (rec) => `${rec.telefono}_${rec.fecha}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, "-");
  const orden = (a) => a.sort((x, y) => x.telefono.localeCompare(y.telefono) || x.fecha.localeCompare(y.fecha));
  const valido = (x) => x && typeof x.telefono === "string" && typeof x.fecha === "string" && isNum(x.vo2max);
  let cache = null, back = null, nube = false, avisar = () => {};
  function leerLocal() { try { const a = JSON.parse(localStorage.getItem(CLAVE) || "[]"); return Array.isArray(a) ? a.filter(valido) : []; } catch (e) { return []; } }
  function espejo() { if (nube) return; try { localStorage.setItem(CLAVE, JSON.stringify(cache)); } catch (e) { /* sin espacio o bloqueado */ } }
  function leer() { if (!cache) cache = nube ? [] : orden(leerLocal()); return cache; }
  const sinSesion = () => Object.assign(new Error("Inicia sesión para usar el historial."), { code: "sin-sesion" });
  const escrituras = (fn) => { if (!back) return Promise.resolve(); return Promise.resolve().then(fn).catch((e) => { avisar((e && e.code) || "error", e); throw e; }); };

  /** Resumen compacto de un análisis: lo que se guarda y se compara. */
  function resumen(r, telefono) {
    const umb = (u) => ({ fc: u.fc, velocidad: r1(u.velocidad), pctVo2max: r0(u.pctVo2max), pctFcmax: r0(u.pctFcmax), metodo: u.metodo });
    return {
      telefono, nombre: r.socio.nombre || "", sexo: r.socio.sexo, edad: r.socio.edad || null, evaluador: r.socio.evaluador || "",
      fecha: r.fecha.toISOString(), archivo: r.archivo, peso: r1(r.peso),
      vo2max: Math.round(r.vo2max * 100) / 100, vo2maxAbs: Math.round(r.vo2maxAbs * 1000) / 1000, etiqueta: r.etiquetaVo2, maxima: !!r.maxima,
      percentil: r0(r.percentil), categoria: r.categoria, fcMax: r.fcMax, fcReposo: r.fcReposo, rerMax: Math.round(r.rerMax * 100) / 100,
      velMax: r1(r.velMax), duracion: r1((r.finEjercicio - r.inicioEjercicio) / 60), costo: r0(r.costoPromedio), calidad: r.calidad,
      vt1: umb(r.vt1), vt2: umb(r.vt2), guardado: new Date().toISOString(),
    };
  }
  /** Guarda (o reemplaza, si se re-analiza la misma prueba). Devuelve una promesa que se resuelve al confirmarse en Supabase. */
  function guardar(rec) {
    if (nube && !back) return Promise.reject(sinSesion());
    cache = orden(leer().filter((x) => idDe(x) !== idDe(rec)).concat([rec])); espejo();
    return escrituras(() => back.guardar([rec]));
  }
  function borrar(tel, fecha) {
    if (nube && !back) return Promise.reject(sinSesion());
    const rec = leer().find((x) => x.telefono === tel && x.fecha === fecha);
    cache = leer().filter((x) => !(x.telefono === tel && x.fecha === fecha)); espejo();
    return rec ? escrituras(() => back.borrar(rec)) : Promise.resolve();
  }
  /** Conecta Supabase (cliente ya con sesión iniciada): carga el historial y sube lo que solo estaba en este navegador. */
  async function conectarSupabase(sb, alFallar) {
    avisar = alFallar || (() => {}); nube = true;
    const tabla = () => sb.from("pruebas");
    const b = {
      async listar() { const { data, error } = await tabla().select("datos").order("fecha"); if (error) throw error; return data.map((d) => d.datos).filter(valido); },
      async guardar(recs) { const { error } = await tabla().upsert(recs.map((x) => ({ id: idDoc(x), telefono: x.telefono, fecha: x.fecha, datos: x }))); if (error) throw error; },
      async borrar(rec) { const { error } = await tabla().delete().eq("id", idDoc(rec)); if (error) throw error; },
    };
    const remotos = await b.listar(), ids = new Set(remotos.map(idDe));
    const solosLocal = leerLocal().filter((x) => !ids.has(idDe(x)));
    if (solosLocal.length) await b.guardar(solosLocal);
    try { localStorage.removeItem(CLAVE); } catch (e) { /* bloqueado */ }
    back = b; cache = orden(remotos.concat(solosLocal));
    return { remotos: remotos.length, subidos: solosLocal.length };
  }
  /** Al cerrar sesión se vacía la copia en memoria. */
  function desconectar() { back = null; cache = []; }
  const conectado = () => !!back;
  /** Activa el modo nube (hay Supabase configurado) aunque aún no haya sesión: así no se escribe nada en el navegador. */
  function modoNube() { nube = true; if (!back) cache = []; }

  function deTelefono(tel) { return leer().filter((x) => x.telefono === tel).sort((x, y) => x.fecha.localeCompare(y.fecha)); }
  function socios() {
    const m = new Map();
    for (const x of leer()) { const s = m.get(x.telefono) || { telefono: x.telefono, nombre: x.nombre, pruebas: 0, ultima: x.fecha }; s.pruebas++; if (x.fecha >= s.ultima) { s.ultima = x.fecha; s.nombre = x.nombre || s.nombre; } m.set(x.telefono, s); }
    return [...m.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  }
  function exportar() { return JSON.stringify({ formato: "vivo47-historial", version: 1, exportado: new Date().toISOString(), pruebas: leer() }, null, 1); }
  async function importar(texto) {
    const d = JSON.parse(texto), nuevos = Array.isArray(d) ? d : d && d.pruebas;
    if (!Array.isArray(nuevos)) throw new Error("El archivo no es un respaldo del historial.");
    const ok = nuevos.filter(valido), m = new Map(leer().map((x) => [idDe(x), x]));
    let agregadas = 0; for (const x of ok) { if (!m.has(idDe(x))) agregadas++; m.set(idDe(x), x); }
    if (nube && !back) throw sinSesion();
    if (back) await back.guardar(ok);
    cache = orden([...m.values()]); espejo();
    return { leidas: ok.length, agregadas };
  }

  // ---------- comparación ----------
  /* Cambio mínimo que se considera real (más allá de la variación normal de un día a otro). */
  const METRICAS = [
    { k: "vo2max", nombre: "VO₂max", uni: "mL/kg/min", dec: 1, mejor: +1, umbral: (a) => 0.03 * a, val: (x) => x.vo2max },
    { k: "vo2maxAbs", nombre: "VO₂ absoluto", uni: "L/min", dec: 2, mejor: +1, umbral: (a) => 0.03 * a, val: (x) => x.vo2maxAbs },
    { k: "vt2vel", nombre: "Velocidad en VT2", uni: "km/h", dec: 1, mejor: +1, umbral: () => 0.5, val: (x) => x.vt2 && x.vt2.velocidad },
    { k: "vt2pct", nombre: "VT2 (% del VO₂max)", uni: "%", dec: 0, mejor: +1, umbral: () => 3, val: (x) => x.vt2 && x.vt2.pctVo2max },
    { k: "vt1vel", nombre: "Velocidad en VT1", uni: "km/h", dec: 1, mejor: +1, umbral: () => 0.5, val: (x) => x.vt1 && x.vt1.velocidad },
    { k: "vt1pct", nombre: "VT1 (% del VO₂max)", uni: "%", dec: 0, mejor: +1, umbral: () => 3, val: (x) => x.vt1 && x.vt1.pctVo2max },
    { k: "velMax", nombre: "Velocidad máxima", uni: "km/h", dec: 1, mejor: +1, umbral: () => 0.5, val: (x) => x.velMax },
    { k: "duracion", nombre: "Tiempo corriendo", uni: "min", dec: 1, mejor: +1, umbral: () => 0.5, val: (x) => x.duracion },
    { k: "costo", nombre: "Costo de O₂ al correr", uni: "mL/kg/km", dec: 0, mejor: -1, umbral: (a) => 0.03 * a, val: (x) => x.costo },
    { k: "fcReposo", nombre: "FC en reposo", uni: "lpm", dec: 0, mejor: -1, umbral: () => 4, val: (x) => x.fcReposo },
    { k: "vt1fc", nombre: "FC en VT1", uni: "lpm", dec: 0, mejor: 0, umbral: () => 4, val: (x) => x.vt1 && x.vt1.fc },
    { k: "vt2fc", nombre: "FC en VT2", uni: "lpm", dec: 0, mejor: 0, umbral: () => 4, val: (x) => x.vt2 && x.vt2.fc },
    { k: "fcMax", nombre: "FC máxima", uni: "lpm", dec: 0, mejor: 0, umbral: () => 4, val: (x) => x.fcMax },
    { k: "peso", nombre: "Peso", uni: "kg", dec: 1, mejor: 0, umbral: () => 1, val: (x) => x.peso },
  ];
  const fmt = (v, dec) => (isNum(v) ? v.toFixed(dec) : "—");
  const signo = (v, dec) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(dec);

  function compararPar(antes, ahora) {
    return METRICAS.map((m) => {
      const a = m.val(antes), b = m.val(ahora);
      if (!isNum(a) || !isNum(b)) return { ...m, antes: a, ahora: b, delta: null, pct: null, estado: "sin-dato" };
      const delta = b - a, pct = a ? (100 * delta) / a : null, real = Math.abs(delta) >= m.umbral(a) - 1e-9;
      const estado = !real ? "estable" : m.mejor === 0 ? "cambio" : delta * m.mejor > 0 ? "mejora" : "baja";
      return { ...m, antes: a, ahora: b, delta, pct, estado, texto: m.uni === "%" ? `${signo(delta, 0)} puntos` : `${signo(delta, m.dec)} ${m.uni}` + (pct != null && Math.abs(pct) >= 0.5 ? `, ${signo(pct, 0)} %` : "") };
    });
  }

  /**
   * actual: resumen de la prueba nueva; previas: resúmenes anteriores (cualquier orden).
   * Devuelve null si no hay pruebas anteriores.
   */
  function comparar(actual, previas) {
    const ant = previas.filter((x) => x.fecha < actual.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!ant.length) return null;
    const previa = ant[ant.length - 1], primera = ant[0], todas = ant.concat([actual]);
    const dias = Math.round((new Date(actual.fecha) - new Date(previa.fecha)) / DIA);
    const diasPrimera = Math.round((new Date(actual.fecha) - new Date(primera.fecha)) / DIA);
    const items = compararPar(previa, actual), vsPrimera = ant.length > 1 ? compararPar(primera, actual) : null;
    const it = Object.fromEntries(items.map((x) => [x.k, x]));
    const cercanas = dias < 21, noMax = !actual.maxima || !previa.maxima;
    const calidadDudosa = [actual.calidad, previa.calidad].includes("Revisar");
    const umbralesAuto = [actual, previa].some((x) => (x.vt1 && x.vt1.metodo !== "validado") || (x.vt2 && x.vt2.metodo !== "validado"));

    // --- tipos de mejora / áreas de oportunidad ---
    const mejoras = [], oportunidades = [];
    const est = (k) => it[k] && it[k].estado;
    if (est("vo2max") === "mejora") {
      const porPeso = est("vo2maxAbs") === "estable" && it.peso.delta != null && it.peso.delta <= -1;
      mejoras.push(porPeso
        ? { tipo: "Composición corporal", socio: `Tu VO₂max subió <b>${it.vo2max.texto}</b> sobre todo porque bajaste ${fmt(Math.abs(it.peso.delta), 1)} kg: cada kilo ahora recibe más oxígeno.`, personal: `VO₂max relativo ${it.vo2max.texto} explicado por el peso (${it.peso.texto}); el VO₂ absoluto no cambió (${it.vo2maxAbs.texto}).` }
        : { tipo: "Capacidad aeróbica máxima", socio: `Tu motor creció: tu VO₂max subió <b>${it.vo2max.texto}</b>. Tu cuerpo ya puede usar más oxígeno en el esfuerzo máximo.`, personal: `VO₂max ${it.vo2max.texto}; VO₂ absoluto ${it.vo2maxAbs.texto}. Mejora central (cardiaca) y/o periférica.` });
    } else if (est("vo2max") === "baja") {
      oportunidades.push({ tipo: "Capacidad aeróbica máxima", socio: `Tu VO₂max bajó <b>${it.vo2max.texto}</b>. Suele pasar con semanas de menos constancia, poco descanso o un mal día; vale la pena revisar cómo han ido tus entrenamientos.`, personal: `VO₂max ${it.vo2max.texto}. Preguntar por constancia, enfermedad, sueño y carga reciente antes de concluir. Sugerir 1 sesión semanal de Z5 (series de 2 a 4 min) cuando la base esté estable.` });
    }
    if (est("vt2vel") === "mejora" || est("vt2pct") === "mejora") {
      const t = est("vt2vel") === "mejora" ? `ahora llega a <b>${fmt(it.vt2vel.ahora, 1)} km/h</b> (${it.vt2vel.texto})` : `ahora está al <b>${fmt(it.vt2pct.ahora, 0)} %</b> de tu capacidad (${it.vt2pct.texto})`;
      mejoras.push({ tipo: "Umbral anaeróbico", socio: `Tu umbral anaeróbico (VT2) ${t}: puedes sostener ritmos más rápidos antes de que el cansancio se dispare.`, personal: `VT2: velocidad ${it.vt2vel.texto || "—"}, % VO₂max ${it.vt2pct.texto || "—"}. El trabajo de Z4 está dando resultado.` });
    } else if (est("vt2vel") === "baja" || est("vt2pct") === "baja") {
      oportunidades.push({ tipo: "Umbral anaeróbico", socio: `Tu umbral anaeróbico (VT2) llega un poco antes que en tu prueba anterior. Intervalos en zona 4 de 8 a 15 minutos te ayudarán a subirlo.`, personal: `VT2 bajó (velocidad ${it.vt2vel.texto || "—"}, % VO₂max ${it.vt2pct.texto || "—"}). Confirmar VT2 en las gráficas; si se sostiene, priorizar Z4.` });
    }
    if (est("vt1vel") === "mejora" || est("vt1pct") === "mejora") {
      mejoras.push({ tipo: "Base aeróbica", socio: `Tu base aeróbica mejoró: tu umbral aeróbico (VT1) ${est("vt1vel") === "mejora" ? `ahora está en <b>${fmt(it.vt1vel.ahora, 1)} km/h</b> (${it.vt1vel.texto})` : `subió a <b>${fmt(it.vt1pct.ahora, 0)} %</b> de tu capacidad`}. Corres más rápido con el mismo esfuerzo cómodo.`, personal: `VT1: velocidad ${it.vt1vel.texto || "—"}, % VO₂max ${it.vt1pct.texto || "—"}. El volumen en Z2 está funcionando.` });
    } else if (est("vt1vel") === "baja" || est("vt1pct") === "baja") {
      oportunidades.push({ tipo: "Base aeróbica", socio: "Tu umbral aeróbico (VT1) llegó antes que la vez pasada. Más tiempo en zona 2, a ritmo de plática, es lo que más lo sube.", personal: `VT1 bajó (velocidad ${it.vt1vel.texto || "—"}, % VO₂max ${it.vt1pct.texto || "—"}). Revisar si sus rodajes fáciles se están yendo a Z3; reforzar volumen en Z2.` });
    }
    if (est("costo") === "mejora") mejoras.push({ tipo: "Economía de carrera", socio: `Corres más eficiente: gastas <b>${fmt(Math.abs(it.costo.pct), 0)} % menos oxígeno</b> por kilómetro a la misma velocidad.`, personal: `Costo de O₂ ${it.costo.texto}. Mejor economía (técnica, fuerza o adaptación a la banda).` });
    else if (est("costo") === "baja") oportunidades.push({ tipo: "Economía de carrera", socio: "Gastaste un poco más de oxígeno por kilómetro que la vez pasada. Trabajo de fuerza y técnica de carrera ayudan a correr más eficiente.", personal: `Costo de O₂ ${it.costo.texto}. Puede ser técnica, fatiga o menos adaptación a la banda; sugerir fuerza 2×/semana y drills de técnica.` });
    if (est("velMax") === "mejora" && !mejoras.some((m) => m.tipo === "Capacidad aeróbica máxima")) mejoras.push({ tipo: "Rendimiento", socio: `Llegaste más lejos en la prueba: tu velocidad máxima subió a <b>${fmt(it.velMax.ahora, 1)} km/h</b>.`, personal: `Velocidad máxima ${it.velMax.texto}, tiempo corriendo ${it.duracion.texto || "—"}.` });
    if (est("fcReposo") === "mejora") mejoras.push({ tipo: "Recuperación", socio: `Tu frecuencia cardiaca en reposo bajó ${fmt(Math.abs(it.fcReposo.delta), 0)} lpm, señal de un corazón más eficiente.`, personal: `FC reposo ${it.fcReposo.texto} (tomar con cautela: depende de nervios y reposo previo).` });

    // --- titular y narrativa ---
    const dv = it.vo2max;
    let titular, tono;
    if (cercanas) { titular = "Tus pruebas son muy cercanas para hablar de cambios"; tono = "estable"; }
    else if (dv.estado === "mejora") { titular = mejoras.length > 1 ? "Mejoraste en varios frentes" : "Tu capacidad aeróbica mejoró"; tono = "mejora"; }
    else if (dv.estado === "baja") { titular = mejoras.length ? "Tu VO₂max bajó, pero hay avances" : "Tu VO₂max bajó respecto a tu prueba anterior"; tono = "baja"; }
    else { titular = mejoras.length ? "Tu VO₂max se mantiene y mejoraste en otras áreas" : "Te mantienes estable"; tono = mejoras.length ? "mejora" : "estable"; }

    const periodo = dias < 14 ? `${dias} día${dias === 1 ? "" : "s"}` : dias < 60 ? `${Math.round(dias / 7)} semanas` : `${Math.round(dias / 30.4)} meses`;
    // socio: intro + (mejoras / oportunidades) + notas
    const intro = `Comparamos tu prueba de hoy con la del <b>${fechaCorta(previa.fecha)}</b> (${periodo} antes). Tu ${actual.etiqueta} pasó de ${fmt(previa.vo2max, 1)} a <b>${fmt(actual.vo2max, 1)} mL/kg/min</b>` +
      (dv.estado === "estable" ? ", un cambio dentro de la variación normal de una prueba a otra (alrededor de ±3 %)." : `: ${dv.texto}.`);
    const notas = [];
    if (cercanas) notas.push(dv.estado === "estable"
      ? "Entre las dos pruebas pasó muy poco tiempo para que el entrenamiento cambie tu condición, y los resultados salieron consistentes: eso nos da confianza en tus números."
      : "Entre las dos pruebas pasó muy poco tiempo para que el entrenamiento cambie tu condición. La diferencia refleja sobre todo cómo llegaste cada día (descanso, nervios, comida, qué tanto llegaste a tu límite), no un cambio real.");
    else if (!mejoras.length && !oportunidades.length) notas.push("Tus umbrales y tu eficiencia se mantienen en el mismo lugar. Para volver a progresar, cambia el estímulo: más volumen en zona 2 o una sesión semanal de intervalos.");
    if (ant.length > 1) notas.push(`Desde tu primera prueba (${fechaCorta(primera.fecha)}) tu ${actual.etiqueta} ${cambioTexto(primera.vo2max, actual.vo2max)}.`);
    if (noMax) notas.push("Una de las dos pruebas no llegó a tu esfuerzo máximo, así que la comparación del VO₂max es aproximada.");
    const socio = { intro, notas, mejoras: cercanas ? [] : mejoras.map((m) => m.socio), oportunidades: cercanas ? [] : oportunidades.map((o) => o.socio) };

    const personal = { mejoras: mejoras.map((m) => [m.tipo, m.personal]), oportunidades: oportunidades.map((o) => [o.tipo, o.personal]), cautelas: [] };
    if (cercanas) personal.cautelas.push(`Solo ${dias} día(s) entre pruebas: tómalo como prueba de reproducibilidad, no de entrenamiento. Diferencias <3 % en VO₂max son variación normal.`);
    if (noMax) personal.cautelas.push("Al menos una prueba fue VO₂pico (sin criterios de máximo): no atribuyas la diferencia de VO₂max al entrenamiento sin repetir.");
    if (calidadDudosa) personal.cautelas.push("Una de las pruebas tiene calidad «Revisar»: revisa sus validaciones antes de presentar la comparación.");
    if (umbralesAuto) personal.cautelas.push("Alguna prueba tiene umbrales automáticos: valida VT1/VT2 en ambas para que la comparación de umbrales sea confiable.");
    if (it.peso.estado === "cambio") personal.cautelas.push(`El peso cambió ${it.peso.texto}: compara también el VO₂ absoluto (${it.vo2maxAbs.texto}) para separar el efecto del peso.`);

    const consistentes = dv.estado === "estable";
    const ref = previa.maxima !== actual.maxima ? (actual.maxima ? actual : previa) : (actual.vo2max >= previa.vo2max ? actual : previa);
    const guion = cercanas
      ? (consistentes
        ? `"Hiciste dos pruebas muy seguidas y salieron consistentes (${fmt(previa.vo2max, 1)} y ${fmt(actual.vo2max, 1)}): eso nos da confianza en tus números. La próxima comparación útil es en 8 a 12 semanas."`
        : `"Hiciste dos pruebas muy seguidas (${fmt(previa.vo2max, 1)} y ${fmt(actual.vo2max, 1)}). En tan poco tiempo tu condición no cambia: la diferencia viene de cómo llegaste cada día${noMax ? " y de que una de las pruebas no llegó a tu máximo" : ""}. Tomamos como referencia la de ${fmt(ref.vo2max, 1)}${ref.maxima && noMax ? ", que sí fue máxima" : ""}, y la próxima comparación útil es en 8 a 12 semanas."`)
      : `"Desde tu prueba del ${fechaCorta(previa.fecha)} tu VO₂max ${cambioTexto(previa.vo2max, actual.vo2max)}.` + (mejoras.length ? ` Lo que más mejoró: ${mejoras.map((m) => m.tipo.toLowerCase()).join(", ")}.` : "") + (oportunidades.length ? ` Donde podemos crecer: ${oportunidades.map((o) => o.tipo.toLowerCase()).join(", ")}."` : `"`);

    const titularPersonal = cercanas ? "Pruebas muy cercanas (reproducibilidad)" : dv.estado === "mejora" ? (mejoras.length > 1 ? "Mejoró en varios frentes" : "Mejoró su VO₂max")
      : dv.estado === "baja" ? (mejoras.length ? "Bajó su VO₂max, con avances" : "Bajó su VO₂max") : mejoras.length ? "VO₂max estable, con avances" : "Sin cambios relevantes";
    return { titularPersonal, previa, primera, anteriores: ant, todas, dias, diasPrimera, periodo, items, vsPrimera, mejoras, oportunidades, titular, tono, cercanas, noMax, socio, personal, guion };
  }
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCorta(iso) { const f = new Date(iso); return `${f.getDate()} ${MES[f.getMonth()]} ${f.getFullYear()}`; }
  function cambioTexto(a, b) {
    const p = (100 * (b - a)) / a;
    if (Math.abs(p) < 3) return `se mantiene (de ${a.toFixed(1)} a ${b.toFixed(1)})`;
    return `${p > 0 ? "subió" : "bajó"} de ${a.toFixed(1)} a ${b.toFixed(1)} (${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(0)} %)`;
  }

  const api = { LADAS, normalizarTelefono, telefonoLegible, resumen, guardar, leer, deTelefono, borrar, socios, exportar, importar, conectarSupabase, desconectar, modoNube, conectado, comparar, compararPar, fechaCorta };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VO2H = api;
})(typeof window !== "undefined" ? window : globalThis);
