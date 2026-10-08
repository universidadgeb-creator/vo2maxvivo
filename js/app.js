const ASSETS = window.VO2_RECURSOS.assets;
const EJEMPLO = window.VO2_RECURSOS.ejemplo;
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const f1 = (x) => x.toFixed(1), kmh = (v) => (isFinite(v) ? v.toFixed(1).replace(".0", "") : "—");
  const SIM = { ok: "✓", aviso: "!", falla: "×" }, LAB = { ok: "Correcto", aviso: "Revisar", falla: "Atención" };
  let filas = null, archivo = null, actual = null, esEjemplo = false;
  // La descarga la concede el visor de Claude: se pide al hacer clic, no al cargar.
  function usar(nombre) {
    if (!window.claude || typeof window.claude.use !== "function") return Promise.resolve(null);
    return window.claude.use(nombre).catch(() => null);
  }
  async function abrirPermisos() {
    const p = await usar("permissions");
    try { if (p) await p.manage(); } catch (e) { /* el panel no abrió */ }
  }

  // ---- memoria local de socios (solo en este navegador) ----
  const memoria = {
    leer() { try { return JSON.parse(localStorage.getItem("vivo47-socios") || "{}"); } catch (e) { return {}; } },
    guardar(clave, d) { try { const m = memoria.leer(); m[clave] = d; localStorage.setItem("vivo47-socios", JSON.stringify(m)); } catch (e) {} },
  };
  const claveDe = (n) => String(n).split("-Basic")[0].split("-")[0].toLowerCase();

  function listo() { return !!(window.XLSX && window.jspdf); }
  function okMsg(t) { $("okmsg").innerHTML = t || ""; $("okmsg").hidden = !t; }

  function mostrarError(msg) { $("error").textContent = msg; $("error").hidden = !msg; }

  async function cargarArchivo(file) {
    mostrarError(""); okMsg("");
    if (!window.XLSX) { mostrarError("No se pudo cargar el lector de Excel. Recarga la página; si sigue igual, revisa tu conexión a internet."); return; }
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      // la hoja de respiraciones se llama "Atem"; si la app la nombra distinto, se busca por sus columnas
      let hoja = wb.Sheets.Atem;
      if (!hoja) for (const n of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, range: 0 })[0] || []; if (r.includes("time [s]") && r.includes("VT [l]")) { hoja = wb.Sheets[n]; break; } }
      if (!hoja) throw new Error("No encontré los datos de respiración en este archivo (hoja «Atem»). Usa el Excel que exporta Spiro Fit para la prueba.");
      filas = XLSX.utils.sheet_to_json(hoja, { defval: null });
      archivo = file.name; esEjemplo = false;
      const info = VO2.infoDesdeNombre(file.name), mem = memoria.leer()[claveDe(file.name)] || {};
      $("nombre").value = mem.nombre || info.nombre;
      $("edad").value = mem.edad || "";
      (mem.sexo === "M" ? $("sexoM") : $("sexoH")).checked = true;
      if (mem.lada) $("lada").value = mem.lada;
      $("telnum").value = mem.telnum || ""; revisarTelefono(false);
      $("peso").value = ""; $("vt1").value = ""; $("vt2").value = ""; $("evaluador").value = mem.evaluador || "";
      const pesoApp = (() => { const v = filas.map((r) => r["V'O₂ [l/min]"] / r["V'O₂/kg [l/min/kg]"]).filter((x) => isFinite(x)).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : NaN; })();
      $("peso").placeholder = isFinite(pesoApp) ? `Del perfil de la app: ${pesoApp.toFixed(1)} kg` : "Se toma del perfil de la app";
      $("fileinfo").innerHTML = `<b>${esc(file.name)}</b><span>${filas.length} respiraciones · ${VO2_PDF_fecha(info.fecha)}</span>`;
      $("fileinfo").hidden = false;
      if ($("edad").value) analizar(); else { okMsg("Archivo cargado. Escribe la edad y da clic en <b>Analizar prueba</b>."); $("edad").focus(); }
    } catch (e) { filas = null; mostrarError(e.message || "No se pudo leer el archivo."); }
  }
  const VO2_PDF_fecha = (f) => VO2PDF.fechaLarga(f);

  function socioDelForm() {
    const num = (id) => { const v = parseFloat($(id).value); return isFinite(v) && v > 0 ? v : null; };
    return { nombre: $("nombre").value.trim(), sexo: $("sexoM").checked ? "M" : "H", edad: num("edad") ? Math.round(num("edad")) : null, peso: num("peso"), vt1Fc: num("vt1"), vt2Fc: num("vt2"), evaluador: $("evaluador").value.trim() };
  }

  function analizar() {
    mostrarError(""); okMsg("");
    if (!listo()) { mostrarError("Las herramientas de la página no cargaron. Recarga la página; si sigue igual, revisa tu conexión a internet."); return; }
    if (!filas) { mostrarError("Primero elige el Excel de la prueba en el paso 1."); return; }
    const s = socioDelForm();
    if (!s.edad) { mostrarError("Escribe la edad del socio: sin ella no hay percentil ni comparación por edad."); $("edad").focus(); return; }
    try {
      actual = VO2.analizar(filas, archivo, s);
      memoria.guardar(claveDe(archivo), { nombre: s.nombre, sexo: s.sexo, edad: s.edad, evaluador: s.evaluador, lada: $("lada").value, telnum: $("telnum").value.trim() });
      const tel = telefonoForm();
      let nota = "";
      if (tel) {
        const rec = VO2H.resumen(actual, tel);
        actual.historial = VO2H.comparar(rec, VO2H.deTelefono(tel));
        actual.telefonoLegible = VO2H.telefonoLegible(tel);
        try { VO2H.guardar(rec).then(() => { if (VO2H.conectado()) histMsg("Prueba guardada en el historial compartido de Claude."); }, () => {}); nota = actual.historial ? ` Comparada con ${actual.historial.anteriores.length} prueba${actual.historial.anteriores.length > 1 ? "s" : ""} anterior${actual.historial.anteriores.length > 1 ? "es" : ""}.` : " Guardada en el historial (primera prueba de este teléfono)."; }
        catch (e) { nota = " No se pudo guardar en el historial de este navegador."; }
        try { localStorage.setItem(PREF_LADA, $("lada").value); } catch (e) {}
        pintarHistorial();
      } else if ($("telnum").value.trim()) nota = " El teléfono no es válido, así que no se guardó en el historial.";
      else nota = " Sin teléfono: no se guardó en el historial.";
      pintar(actual);
      okMsg(`Listo: ${esc(actual.etiquetaVo2)} ${f1(actual.vo2max)} para ${esc(s.nombre || "el socio")}. Los PDF están en <a href="#resultado">Descargar</a>.${nota}`);
      const r = $("resultado"); if (r.getBoundingClientRect().top > window.innerHeight * 0.6) r.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { mostrarError("No se pudo analizar la prueba: " + (e && e.message ? e.message : "error desconocido")); }
  }

  function pintar(r) {
    const s = r.socio, [clave, titulo, detalle] = VO2PDF.decisionEntrega(r), est = { revisar: "falla", validar: "aviso", ok: "ok" }[clave];
    const zs = r.zonas, lo = zs[0].fcMin, hi = zs[4].fcMax, pos = (v) => ((v - lo) / (hi - lo)) * 100;
    const pct = r.percentil != null ? `${esc(r.categoria)} · Percentil ${Math.round(r.percentil)}` : "Falta la edad para el percentil";
    $("resultado").innerHTML = `
      <div class="res-head">
        <div><p class="res-name">${esc(s.nombre || "Sin nombre")}</p><p class="res-sub">${VO2PDF.fechaLarga(r.fecha)}${s.edad ? " · " + s.edad + " años" : ""} · ${f1(r.peso)} kg</p></div>
        ${esEjemplo ? '<span class="tag">Ejemplo · socio anónimo</span>' : `<span class="tag">Calidad: ${esc(r.calidad)}</span>`}
      </div>
      <div class="hero">
        <div><div class="big-label">${esc(r.etiquetaVo2)}</div><div class="big">${f1(r.vo2max)}<small>mL/kg/min</small></div></div>
        <span class="pill">${pct}</span>
      </div>
      <div class="verdict"><span class="dot ${est}" aria-hidden="true">${SIM[est]}</span><div><b>${esc(titulo)}</b><p>${detalle}</p></div></div>
      <div class="stats">
        <div class="stat"><span>FC máxima</span><b>${r.fcMax}<small>lpm</small></b><em>Reposo ${r.fcReposo}</em></div>
        <div class="stat"><span>VT1</span><b>${r.vt1.fc}<small>lpm</small></b><em>~${kmh(r.vt1.velocidad)} km/h · ${r.vt1.metodo}</em></div>
        <div class="stat"><span>VT2</span><b>${r.vt2.fc}<small>lpm</small></b><em>~${kmh(r.vt2.velocidad)} km/h · ${r.vt2.metodo}</em></div>
        <div class="stat"><span>Vel. máxima</span><b>${kmh(r.velMax)}<small>km/h</small></b><em>App: ${f1(r.vo2maxApp)} VO₂</em></div>
      </div>
      ${evolucionHtml(r)}
      <div class="sec"><h2>Descargar</h2>
        <div class="dls">
          <button class="btn btn-dl" type="button" id="dlSocio">${ICON}<span>Reporte del socio<small>${r.historial ? "Incluye su evolución" : "3 páginas"} · para entregar</small></span></button>
          <button class="btn btn-dl" type="button" id="dlPersonal">${ICON}<span>Hoja del personal<small>Validaciones y guion · uso interno</small></span></button>
        </div>
        <p class="hint" id="dlmsg" style="margin-top:8px" hidden></p>
      </div>
      <div class="sec"><h2>Zonas de frecuencia cardiaca</h2>
        <div class="zbar">${zs.map((z) => `<div style="flex:${Math.max(z.fcMax - z.fcMin, 1)}">${z.fcMax - z.fcMin >= 5 ? z.codigo : ""}</div>`).join("")}</div>
        <div class="zticks">${zs.map((z) => `<span style="left:${pos(z.fcMin)}%">${z.fcMin}</span>`).join("")}<span style="left:100%">${hi}</span></div>
        <table class="ztable"><tbody>${zs.map((z, i) => `<tr><td>${z.codigo}</td><td>${esc(z.nombre)}</td><td>${z.fcMin}–${z.fcMax} lpm</td><td>${esc(VO2PDF.rangoVel(z, i === 0, i === 4))}</td></tr>`).join("")}</tbody></table>
      </div>
      <div class="sec"><h2>Validaciones de calidad</h2>
        <ul class="vlist">${r.validaciones.map((v) => `<li><span class="dot ${v.estado}" aria-hidden="true">${SIM[v.estado]}</span><div><b>${esc(v.nombre)}</b><span class="st">${LAB[v.estado]}</span><p>${esc(v.detalle)}</p></div></li>`).join("")}</ul>
      </div>`;
    $("dlSocio").onclick = () => descargar("socio");
    $("dlPersonal").onclick = () => descargar("personal");
  }
  function evolucionHtml(r) {
    const c = r.historial; if (!c) return "";
    const li = (arr, cls) => arr.map((x) => `<li class="${cls}"><b>${esc(x[0])}</b></li>`).join("");
    return `<div class="sec evo"><h2>Evolución · ${esc(c.titular)}</h2>
      <p>${c.socio.intro}</p>
      ${c.cercanas ? `<p>${c.socio.notas[0]}</p>` : `<ul>${li(c.personal.mejoras, "up")}${li(c.personal.oportunidades, "down")}</ul>`}
      <p class="hint">${c.anteriores.length} prueba${c.anteriores.length > 1 ? "s" : ""} anterior${c.anteriores.length > 1 ? "es" : ""} de ${esc(r.telefonoLegible)}. El detalle está en los dos PDF.</p></div>`;
  }
  const ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v9m0 0 3.5-3.5M10 12 6.5 8.5M4 15.5h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function nombreArchivo(r, tipo) {
    const n = (r.socio.nombre || "Socio").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "");
    const f = r.fecha, d = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
    return `${n}_${d}_${tipo === "socio" ? "reporte_socio" : "hoja_personal"}.pdf`;
  }
  function aviso(html) { const msg = $("dlmsg"); msg.innerHTML = html; msg.hidden = false; const b = msg.querySelector("button"); if (b) b.onclick = abrirPermisos; }
  /** Entrega un archivo al usuario: descarga normal fuera de Claude, capacidad "downloads" dentro de Claude. */
  async function entregar(nombre, blob, btn) {
    if (btn) btn.classList.add("busy");
    try {
      if (!window.claude) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return "Listo: el archivo se guardó en tu carpeta de Descargas.";
      }
      const dl = await usar("downloads");
      if (!dl) {
        const p = await usar("permissions");
        const st = p ? await p.state("downloads").catch(() => "unavailable") : "unavailable";
        return st === "denied" ? 'El permiso de descargas está desactivado para esta página. <button type="button" class="link">Activar descargas</button>'
          : "Esta vista no permite descargar archivos. Ábrela desde claude.ai en el navegador (Chrome o Edge) o en la app de Claude y vuelve a intentarlo.";
      }
      await dl.save({ filename: nombre, data: blob });
      return "Listo: el archivo se guardó en tu carpeta de Descargas.";
    } catch (e) {
      const c = (e && e.code) || "";
      if (c === "declined") return "Descarga cancelada. Vuelve a dar clic y elige permitir.";
      if (c === "rate_limited") return "Ya hay una descarga esperando tu confirmación; acéptala o espera unos segundos.";
      if (["not_granted", "capability_disabled", "capability_removed"].includes(c)) return 'Falta el permiso de descargas. <button type="button" class="link">Activar descargas</button>';
      return "La descarga no se completó (" + esc(c || "sin código") + "): " + esc(e && e.message ? e.message : String(e));
    } finally { if (btn) btn.classList.remove("busy"); }
  }
  async function descargar(tipo) {
    const btn = $(tipo === "socio" ? "dlSocio" : "dlPersonal");
    $("dlmsg").hidden = true;
    let buf;
    try { buf = tipo === "socio" ? VO2PDF.reporteSocio(actual, ASSETS) : VO2PDF.reportePersonal(actual, ASSETS); }
    catch (e) { aviso("No se pudo armar el PDF: " + esc(e && e.message ? e.message : String(e))); return; }
    if (window.claude) aviso("Confirma la descarga en el aviso de Claude que aparece en pantalla…");
    aviso(await entregar(nombreArchivo(actual, tipo), new Blob([buf], { type: "application/pdf" }), btn));
  }

  // ---- teléfono ----
  const PREF_LADA = "vivo47-lada";
  function llenarLadas() {
    let pref = "+52"; try { pref = localStorage.getItem(PREF_LADA) || "+52"; } catch (e) {}
    $("lada").innerHTML = VO2H.LADAS.map(([l, pais]) => `<option value="${l}"${l === pref ? " selected" : ""}>${l} ${esc(pais)}</option>`).join("");
  }
  const telefonoForm = () => VO2H.normalizarTelefono($("lada").value, $("telnum").value);
  function revisarTelefono(rellenar, final) {
    // El aviso ocupa siempre su lugar (min-height) para que el botón Analizar no se mueva al escribir o salir del campo.
    const info = $("telinfo"), num = $("telnum").value.replace(/\D/g, "");
    if (!num) { info.textContent = ""; return; }
    const tel = telefonoForm();
    if (!tel) { info.textContent = final || num.length >= 11 ? "Revisa el número: escribe solo los dígitos (10 en México), sin la clave del país." : ""; return; }
    const ps = VO2H.deTelefono(tel);
    if (!ps.length) { info.textContent = "Teléfono nuevo: esta será su primera prueba en el historial."; return; }
    const u = ps[ps.length - 1];
    info.innerHTML = `Encontré <b>${ps.length} prueba${ps.length > 1 ? "s" : ""}</b> de ${esc(u.nombre || "este socio")} (la última, ${VO2H.fechaCorta(u.fecha)}). El reporte incluirá su evolución.`;
    if (rellenar) {
      if (u.nombre) $("nombre").value = u.nombre;
      if (u.edad && !$("edad").value) $("edad").value = u.edad;
      (u.sexo === "M" ? $("sexoM") : $("sexoH")).checked = true;
    }
  }


  // ---- panel de historial ----
  let abierto = null;
  function pintarHistorial() {
    const q = $("buscar").value.trim().toLowerCase(), qd = q.replace(/\D/g, "");
    const ss = VO2H.socios().filter((x) => !q || (x.nombre || "").toLowerCase().includes(q) || (qd && x.telefono.includes(qd)));
    if (!ss.length) { $("histlista").innerHTML = `<p class="hint" style="padding:10px 2px">${q ? "No hay socios que coincidan." : "Aún no hay pruebas guardadas. Escribe el teléfono del socio al analizar una prueba."}</p>`; return; }
    $("histlista").innerHTML = ss.map((x) => {
      const ps = abierto === x.telefono ? VO2H.deTelefono(x.telefono) : null;
      return `<div class="hsocio"><button type="button" data-tel="${esc(x.telefono)}" aria-expanded="${!!ps}">
        <span><b>${esc(x.nombre || "Sin nombre")}</b><br><span class="m">${esc(VO2H.telefonoLegible(x.telefono))}</span></span>
        <span class="m">${x.pruebas} prueba${x.pruebas > 1 ? "s" : ""}<br>última ${VO2H.fechaCorta(x.ultima)}</span></button>
        ${ps ? `<div class="htabla"><table class="hpruebas"><thead><tr><th>Fecha</th><th>VO₂</th><th>VT1</th><th>VT2</th><th>Vel. máx</th><th>Peso</th><th></th></tr></thead><tbody>${ps.map((p) => `<tr><td>${VO2H.fechaCorta(p.fecha)}</td><td><b>${p.vo2max.toFixed(1)}</b>${p.maxima ? "" : " pico"}</td><td>${p.vt1.fc}</td><td>${p.vt2.fc}</td><td>${p.velMax != null ? p.velMax : "—"}</td><td>${p.peso != null ? p.peso : "—"}</td><td><button type="button" data-borrar="${esc(p.fecha)}" data-tel="${esc(p.telefono)}">Borrar</button></td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>`;
    }).join("");
  }
  function histMsg(t) { const m = $("histmsg"); m.innerHTML = t; m.hidden = !t; const b = m.querySelector("button"); if (b) b.onclick = abrirPermisos; }
  $("histlista").addEventListener("click", (e) => {
    const borrar = e.target.closest("button[data-borrar]");
    if (borrar) {
      if (borrar.dataset.confirmar !== "1") { borrar.dataset.confirmar = "1"; borrar.textContent = "¿Seguro? Clic para borrar"; return; }
      VO2H.borrar(borrar.dataset.tel, borrar.dataset.borrar).then(() => histMsg("Prueba borrada del historial."), () => {}); pintarHistorial(); return;
    }
    const b = e.target.closest("button[data-tel]"); if (!b) return;
    abierto = abierto === b.dataset.tel ? null : b.dataset.tel; pintarHistorial();
  });
  $("buscar").addEventListener("input", pintarHistorial);
  $("exportar").addEventListener("click", async (e) => {
    const n = VO2H.leer().length; if (!n) { histMsg("No hay pruebas para exportar."); return; }
    const d = new Date(), f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    histMsg(await entregar(`historial_vivo47_${f}.json`, new Blob([VO2H.exportar()], { type: "application/json" }), e.currentTarget));
  });
  $("importar").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const r = await VO2H.importar(await f.text()); histMsg(`Respaldo importado: ${r.leidas} pruebas leídas, ${r.agregadas} nuevas.`); pintarHistorial(); revisarTelefono(false); }
    catch (err) { histMsg("No se pudo importar: " + esc(err.message || String(err))); }
    e.target.value = "";
  });
  $("telnum").addEventListener("input", () => revisarTelefono(true, false));
  $("telnum").addEventListener("change", () => revisarTelefono(true, true));
  $("lada").addEventListener("change", () => revisarTelefono(true, true));

  // ---- eventos ----
  $("archivo").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) cargarArchivo(f); });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) cargarArchivo(f); });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); analizar(); });

  // ---- ejemplo inicial ----
  function cargarEjemplo() {
    filas = EJEMPLO.rows.map((row) => Object.fromEntries(EJEMPLO.cols.map((c, i) => [c, row[i]])));
    archivo = EJEMPLO.archivo; esEjemplo = true;
    actual = VO2.analizar(filas, archivo, { nombre: "Socio de ejemplo", sexo: "H", edad: 36 });
    pintar(actual); filas = null; esEjemplo = false;
  }
  llenarLadas(); pintarHistorial();
  // Dentro de Claude el historial se guarda en la base de datos del artifact (compartido entre computadoras).
  function fallaDb(codigo) {
    histMsg(codigo === "invalid_argument" || codigo === "not_granted"
      ? "Esta cuenta no puede escribir en el historial compartido (solo la persona dueña de la página o quien tenga permiso de edición). Se guardó solo en este navegador."
      : codigo === "quota_exceeded" ? "El historial compartido está lleno. Exporta un respaldo y borra pruebas antiguas."
      : "No se pudo guardar en el historial compartido (" + esc(codigo) + "). Quedó en este navegador; exporta un respaldo.");
  }
  function estadoAlmacen() { $("histdonde").textContent = VO2H.conectado() ? "Historial compartido en Claude: se guarda en línea y lo ves desde cualquier computadora con acceso a esta página." : "Pruebas guardadas solo en este navegador, ligadas al teléfono de cada socio. Exporta un respaldo seguido."; }
  estadoAlmacen();
  if (window.claude) usar("db").then(async (db) => {
    if (!db) return;
    try {
      await VO2H.conectarDb(db.collection("pruebas"), () => { pintarHistorial(); revisarTelefono(false); }, fallaDb);
      estadoAlmacen(); pintarHistorial(); revisarTelefono(false);
    } catch (e) { fallaDb((e && e.code) || "error"); }
  });
  try { cargarEjemplo(); } catch (e) { $("resultado").innerHTML = '<p class="hint">Sube un Excel para ver el resultado aquí.</p>'; }
  window.addEventListener("load", () => { if (!listo()) { $("libs").textContent = "Las herramientas de la página no cargaron. Recarga la página; si sigue igual, revisa tu conexión a internet."; $("libs").hidden = false; } });
})();
