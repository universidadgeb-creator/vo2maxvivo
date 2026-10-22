/* Motor de interpretación Spiro Fit · Vivo 47 Center (port del generador en Python). */
(function (root) {
  "use strict";
  const FIO2 = 0.2095, FICO2 = 0.0004, PH2O = 62.74;

  // ---------- utilidades numéricas ----------
  const isNum = (x) => typeof x === "number" && isFinite(x);
  const mean = (a) => { let s = 0, n = 0; for (const x of a) if (isNum(x)) { s += x; n++; } return n ? s / n : NaN; };
  const median = (a) => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return NaN; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const max = (a) => { let m = -Infinity; for (const x of a) if (isNum(x) && x > m) m = x; return m === -Infinity ? NaN : m; };
  const round1 = (x) => Math.round(x * 10) / 10;
  const pyRound = (x) => { const f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1; return Math.round(x); };

  function mediaMovilTiempo(t, y, ventana) {
    const out = new Array(t.length); let j = 0; const cs = [0];
    for (let i = 0; i < y.length; i++) cs.push(cs[i] + y[i]);
    for (let i = 0; i < t.length; i++) { while (t[j] < t[i] - ventana) j++; out[i] = (cs[i + 1] - cs[j]) / (i + 1 - j); }
    return out;
  }
  function rollingCenterMedian(a, w, minP) {
    const h = Math.floor(w / 2), out = [];
    for (let i = 0; i < a.length; i++) {
      const win = a.slice(Math.max(0, i - h), Math.min(a.length, i + (w - h))).filter(isNum);
      out.push(win.length >= minP ? median(win) : NaN);
    }
    return out;
  }
  function interp(x, xs, ys) {
    if (x < xs[0] || x > xs[xs.length - 1]) return NaN;
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) {
      const dx = xs[i] - xs[i - 1]; return dx === 0 ? ys[i] : ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / dx;
    }
    return ys[ys.length - 1];
  }
  function polyfit1(x, y) {
    const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const m = sxx ? sxy / sxx : 0; return [m, my - m * mx];
  }

  // ---------- percentiles FRIEND 2022 ----------
  const PCTS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const H = { 90: [58.6, 55.5, 50.8, 43.4, 37.1, 29.4, 22.8], 80: [54.5, 50.0, 45.2, 38.3, 32.0, 25.9, 21.4], 70: [51.9, 46.4, 40.9, 34.3, 28.7, 23.8, 20.0], 60: [49.0, 43.4, 37.9, 31.8, 26.5, 22.2, 18.4], 50: [46.5, 39.7, 35.3, 29.2, 24.6, 20.6, 17.6], 40: [43.6, 37.0, 32.4, 26.9, 22.8, 19.1, 16.6], 30: [40.0, 33.5, 29.7, 24.5, 20.7, 17.3, 16.1], 20: [35.2, 29.8, 26.7, 22.2, 18.5, 15.9, 14.8], 10: [28.6, 24.9, 22.1, 18.6, 15.8, 13.6, 12.9] };
  const M = { 90: [49.0, 42.1, 37.8, 32.4, 27.3, 22.8, 20.8], 80: [44.8, 37.0, 33.0, 28.4, 24.3, 20.8, 18.4], 70: [41.8, 33.6, 30.0, 26.3, 22.4, 19.6, 17.3], 60: [39.0, 31.0, 27.7, 24.6, 20.9, 18.3, 16.0], 50: [36.6, 28.3, 25.7, 22.9, 19.6, 17.2, 15.4], 40: [34.0, 26.4, 23.9, 21.5, 18.3, 16.2, 14.7], 30: [30.8, 24.2, 21.8, 20.1, 17.0, 15.2, 13.7], 20: [27.2, 21.9, 19.7, 18.5, 15.4, 14.0, 12.6], 10: [22.5, 18.6, 17.2, 16.5, 13.4, 12.3, 11.4] };
  const esMujer = (s) => /^[MF]/i.test(String(s || ""));
  function tablaFriend(edad, sexo) {
    const g = Math.min(80, Math.max(20, Math.floor(edad / 10) * 10)), i = (g - 20) / 10, t = esMujer(sexo) ? M : H, o = {};
    for (const p of PCTS) o[p] = t[p][i]; return o;
  }
  function erf(x) { // Abramowitz-Stegun
    const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function percentilFriend(vo2, edad, sexo) {
    const t = tablaFriend(edad, sexo), vals = PCTS.map((p) => t[p]);
    if (vo2 >= t[10] && vo2 <= t[90]) return interp(vo2, vals, PCTS);
    const sd = (t[90] - t[10]) / (2 * 1.2816);
    return Math.min(99, Math.max(1, 100 * 0.5 * (1 + erf((vo2 - t[50]) / sd / Math.SQRT2))));
  }
  function categoria(p) {
    if (p == null) return "—";
    if (p >= 90) return "Excelente"; if (p >= 80) return "Muy bueno"; if (p >= 60) return "Bueno";
    if (p >= 40) return "Promedio"; if (p >= 20) return "Regular"; return "Bajo";
  }

  // ---------- lectura ----------
  const COLS = { t: "time [s]", dur: "duration [s]", vt: "VT [l]", do2: "ΔO₂ [%]", etco2: "ETCO₂ [%]", p: "pressure [hPa]", tgas: "gas temperature [°C]", hgas: "gas humidity [%]", vo2_app: "V'O₂ [l/min]", vo2kg_app: "V'O₂/kg [l/min/kg]", hr: "HR [bpm]", speed: "speed [km/h]", incline: "incline" };

  function infoDesdeNombre(nombreArchivo) {
    const stem = nombreArchivo.replace(/\.[^.]+$/, "");
    const m = stem.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})Z/);
    const fecha = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
    const nombre = stem.split("-Basic")[0].split("-")[0].replace(/_/g, " ").trim();
    return { nombre, fecha };
  }

  /** rows: arreglo de objetos con los encabezados de la hoja "Atem". */
  function leerFilas(rows) {
    if (!rows.length) throw new Error("La hoja «Atem» está vacía.");
    const falt = Object.values(COLS).filter((c) => !(c in rows[0]));
    if (falt.length) throw new Error("El archivo no parece un Excel de Spiro Fit (faltan columnas: " + falt.join(", ") + ").");
    const d = [];
    for (const r of rows) {
      const o = {}; for (const k in COLS) { const v = r[COLS[k]]; o[k] = v === "" || v == null ? NaN : Number(v); }
      if (o.dur > 0 && o.vt > 0) d.push(o);
    }
    return d;
  }

  function recalcular(d, peso) {
    for (const r of d) {
      const psat = 6.1078 * Math.pow(10, (7.5 * r.tgas) / (273.3 + r.tgas)), pvap = r.hgas / 100 * psat;
      const fbtps = (310.15 / (273.15 + r.tgas)) * ((r.p - pvap) / (r.p - PH2O));
      const fstpd = (273.15 / (273.15 + r.tgas)) * ((r.p - pvap) / 1013.25);
      const fr = 60 / r.dur, vtS = r.vt * fstpd * 1000, feo2 = FIO2 - r.do2 / 100, feco2 = r.etco2 / 100;
      const vi = vtS * (1 - feo2 - feco2) / (1 - FIO2 - FICO2);
      r.fr = fr; r.ve = r.vt * fbtps * fr; r.vo2 = (vi * FIO2 - vtS * feo2) * fr; r.vco2 = vtS * feco2 * fr;
      r.peto2 = feo2 * (r.p - PH2O) * (760 / 1013.25); r.petco2 = feco2 * (r.p - PH2O) * (760 / 1013.25);
      r.vo2kg = r.vo2 / peso; r.vo2kgApp = r.vo2kg_app * 1000;
      const q = r.vo2 > 0 ? r.vco2 / r.vo2 : NaN;
      r.artefacto = !(r.vo2 > 0) || !(r.vco2 > 0) || r.vt < 0.15 || r.fr > 75 || q > 2 || q < 0.5 || !isNum(r.vo2);
    }
  }

  function detectarFases(d) {
    const sp = d.map((r) => round1(r.speed)), t = d.map((r) => r.t), v0 = sp[0];
    let vmaxIdx = 0; for (let i = 1; i < sp.length; i++) if (sp[i] > sp[vmaxIdx]) vmaxIdx = i;
    let fin = t[t.length - 1];
    for (let i = vmaxIdx; i < sp.length; i++) if (sp[i] < sp[vmaxIdx] - 1.5) { fin = t[i]; break; }
    let finE1 = fin; for (let i = 0; i < sp.length; i++) if (Math.abs(sp[i] - v0) > 0.4) { finE1 = t[i]; break; }
    // mediana móvil de 15 s (ventana (t-15, t])
    const vo2s = []; let j = 0;
    for (let i = 0; i < d.length; i++) { while (t[j] <= t[i] - 15) j++; vo2s.push(median(d.slice(j, i + 1).map((r) => r.vo2))); }
    const lim = Math.min(60, finE1 / 4);
    const reposo = median(vo2s.filter((_, i) => t[i] < lim));
    const estable = median(vo2s.filter((_, i) => t[i] > finE1 - 60 && t[i] <= finE1));
    const umbral = reposo + 0.5 * (estable - reposo);
    let inicio = 0;
    for (let i = 0; i < d.length; i++) if (vo2s[i] > umbral && t[i] > 20 && t[i] < finE1) { inicio = t[i] - 20; break; }
    return [Math.max(inicio, 0), fin, inicioCalentamiento(d, sp, t, reposo, estable)];
  }
  /** La columna de velocidad del Excel marca 8 km/h desde el segundo 0 (la banda aún no se mueve).
   *  El calentamiento real empieza antes del primer cambio de velocidad, la misma duración que dura una etapa. */
  function inicioCalentamiento(d, sp, t, reposo, estable) {
    const seg = [];
    for (let i = 0; i < sp.length; i++) { if (!seg.length || seg[seg.length - 1].s !== sp[i]) seg.push({ s: sp[i], t0: t[i], t1: t[i] }); else seg[seg.length - 1].t1 = t[i]; }
    const largos = seg.filter((g) => g.t1 - g.t0 >= 50);
    if (largos.length < 2) return 0;
    const t1 = largos[1].t0, calentando = estable > reposo * 1.8 && estable - reposo > 6;
    if (!calentando) return t1;
    const dur = largos.length > 2 ? largos[2].t0 - largos[1].t0 : NaN;
    return isNum(dur) && dur >= 90 && dur <= 300 ? Math.max(t1 - dur, 30) : Math.max(t1 - 180, 30);
  }

  function detectarEtapas(d, inicio, fin, peso) {
    const ex = d.filter((r) => r.t >= inicio && r.t <= fin), grupos = [];
    for (const r of ex) { const s = round1(r.speed); if (!grupos.length || grupos[grupos.length - 1].s !== s) grupos.push({ s, rows: [] }); grupos[grupos.length - 1].rows.push(r); }
    const etapas = [];
    for (const g of grupos) {
      const ini = g.rows[0].t, fi = g.rows[g.rows.length - 1].t;
      if (fi - ini < 50) continue;
      const ult = g.rows.filter((r) => r.t >= fi - 60 && !r.artefacto);
      if (!ult.length) continue;
      const vo2 = mean(ult.map((r) => r.vo2)) / peso, v = g.rows[0].speed;
      const costo = v > 0 && fi - ini >= 150 ? vo2 / v * 60 : null;
      etapas.push({ velocidad: v, inicio: ini, fin: fi, fcFinal: mean(ult.map((r) => r.hr)), vo2Final: vo2, rerFinal: mean(ult.map((r) => r.vco2)) / mean(ult.map((r) => r.vo2)), costoO2: costo });
    }
    return etapas;
  }

  function promedios15s(d, inicio, fin) {
    const ex = d.filter((r) => r.t >= inicio && r.t <= fin + 1 && !r.artefacto), bins = new Map();
    for (const r of ex) { const k = Math.floor((r.t - inicio) / 15); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(r); }
    const b = [];
    for (const k of [...bins.keys()].sort((x, y) => x - y)) {
      const rs = bins.get(k); if (rs.length < 2) continue;
      const o = { n: rs.length, speed: median(rs.map((r) => r.speed)) };
      for (const c of ["t", "vo2", "vco2", "ve", "peto2", "petco2", "hr"]) o[c] = mean(rs.map((r) => r[c]));
      o.eqo2 = o.ve / (o.vo2 / 1000); o.eqco2 = o.ve / (o.vco2 / 1000); b.push(o);
    }
    for (const c of ["eqo2", "eqco2", "peto2", "petco2", "vo2", "vco2", "ve"]) {
      const s = rollingCenterMedian(b.map((x) => x[c]), 3, 1); b.forEach((x, i) => (x[c + "_s"] = s[i]));
    }
    return b;
  }

  /** Promedios de 15 s de TODA la grabación (para las gráficas en tiempo absoluto). */
  function serie15(d) {
    const bins = new Map();
    for (const r of d) { if (r.artefacto) continue; const k = Math.floor(r.t / 15); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(r); }
    const b = [];
    for (const k of [...bins.keys()].sort((x, y) => x - y)) {
      const rs = bins.get(k); if (rs.length < 2) continue;
      const o = { n: rs.length, t: mean(rs.map((r) => r.t)), speed: median(rs.map((r) => r.speed)) };
      for (const c of ["vo2", "vco2", "ve", "peto2", "petco2", "hr"]) o[c] = mean(rs.map((r) => r[c]));
      o.eqo2 = o.ve / (o.vo2 / 1000); o.eqco2 = o.ve / (o.vco2 / 1000); o.rer = o.vco2 / o.vo2; b.push(o);
    }
    for (const c of ["eqo2", "eqco2", "peto2", "petco2", "vo2", "vco2", "rer"]) { const s = rollingCenterMedian(b.map((x) => x[c]), 3, 1); b.forEach((x, i) => (x[c + "_s"] = s[i])); }
    return b;
  }
  /** Tabla de fases como la del experto: Base (0 km/h), Calentamiento, etapas y Recuperación, con tiempos absolutos. */
  function filasFases(d, res, peso) {
    const win = (t0, t1) => d.filter((r) => r.t >= Math.max(t0, t1 - 60) && r.t <= t1 && !r.artefacto);
    const fila = (nombre, t0, t1, v, extra) => {
      const w = win(t0, t1); if (w.length < 3) return null;
      const ve = mean(w.map((r) => r.ve));
      return Object.assign({ nombre, t0, t1, velocidad: v, fc: mean(w.map((r) => r.hr)), vo2: mean(w.map((r) => r.vo2)) / peso, vco2: mean(w.map((r) => r.vco2)) / peso, rer: mean(w.map((r) => r.vco2)) / mean(w.map((r) => r.vo2)),
        eqo2: ve / (mean(w.map((r) => r.vo2)) / 1000), eqco2: ve / (mean(w.map((r) => r.vco2)) / 1000), peto2: mean(w.map((r) => r.peto2)), petco2: mean(w.map((r) => r.petco2)) }, extra || {});
    };
    const out = [], ic = res.inicioCalentamiento;
    if (ic > 20) out.push(fila("Base", 0, ic, 0));
    res.etapas.forEach((e, i) => out.push(fila(i === 0 && e.velocidad < (res.etapas[1] ? res.etapas[1].velocidad : Infinity) ? "Calentamiento" : "Etapa", e.inicio, e.fin, e.velocidad, { costo: e.costoO2 })));
    const rec = d.filter((r) => r.t > res.finEjercicio);
    if (rec.length > 10 && rec[rec.length - 1].t - res.finEjercicio > 30) out.push(fila("Recuperación", res.finEjercicio, rec[rec.length - 1].t, median(rec.map((r) => r.speed))));
    return out.filter(Boolean);
  }

  function dosRectas(x, y, lo, hi, minPts = 4) {
    let best = null;
    for (let k = lo + minPts; k <= hi - minPts; k++) {
      const x1 = x.slice(lo, k), y1 = y.slice(lo, k), x2 = x.slice(k, hi), y2 = y.slice(k, hi);
      const p1 = polyfit1(x1, y1), p2 = polyfit1(x2, y2); let sse = 0;
      x1.forEach((v, i) => (sse += (p1[0] * v + p1[1] - y1[i]) ** 2)); x2.forEach((v, i) => (sse += (p2[0] * v + p2[1] - y2[i]) ** 2));
      if (!best || sse < best[0]) best = [sse, k, p1[0], p2[0]];
    }
    return best ? best.slice(1) : [null, 0, 0];
  }
  function detectarUmbralesBins(b) {
    const n = b.length, x = b.map((r) => r.t), lo = Math.min(4, Math.floor(n / 5)), col = (c) => b.map((r) => r[c]);
    let cand = [];
    const [kEq, s1, s2] = dosRectas(x, col("eqco2_s"), lo, n), [kPc, p1, p2] = dosRectas(x, col("petco2_s"), lo, n);
    if (kEq != null && s2 > s1) cand.push(x[kEq]); if (kPc != null && p2 < p1) cand.push(x[kPc]);
    const t2 = cand.length ? mean(cand) : x[Math.floor(n * 0.8)];
    let hi = x.findIndex((v) => v >= t2); if (hi < 0) hi = n; hi = Math.max(hi, lo + 9);
    cand = [];
    const [kVs, a1, a2] = dosRectas(col("vo2_s"), col("vco2_s"), lo, hi); if (kVs != null && a2 > a1) cand.push(x[kVs]);
    const [kO2, e1, e2] = dosRectas(x, col("eqo2_s"), lo, hi); if (kO2 != null && e2 > e1) cand.push(x[kO2]);
    const [kPo, q1, q2] = dosRectas(x, col("peto2_s"), lo, hi); if (kPo != null && q2 > q1) cand.push(x[kPo]);
    let t1 = cand.length ? median(cand) : x[Math.floor(n * 0.45)];
    if (t1 >= t2 - 60) t1 = t2 - 120;
    return [t1, t2];
  }
  function metricasEtapa(d, e) {
    const w = d.filter((r) => r.t >= e.fin - 60 && r.t <= e.fin && !r.artefacto), ve = mean(w.map((r) => r.ve));
    return { eqo2: ve / (mean(w.map((r) => r.vo2)) / 1000), eqco2: ve / (mean(w.map((r) => r.vco2)) / 1000), peto2: mean(w.map((r) => r.peto2)), petco2: mean(w.map((r) => r.petco2)) };
  }
  function detectarUmbralesEtapas(d, etapas) {
    const m = etapas.map((e) => metricasEtapa(d, e)), n = m.length;
    let i2 = null;
    for (let i = 2; i < n; i++) {
      const prev = m.slice(1, i), minEq = Math.min(...prev.map((x) => x.eqco2)), maxPc = Math.max(...prev.map((x) => x.petco2));
      if (m[i].eqco2 >= minEq * 1.03 && m[i].petco2 <= maxPc - 0.8) { i2 = i; break; }
    }
    if (i2 == null) { let best = -Infinity; for (let i = 2; i < n; i++) { const s = m[i].eqo2 - m[i - 1].eqo2; if (s > best) { best = s; i2 = i; } } }
    let i1 = null;
    for (let i = 1; i < i2; i++) {
      const prev = m.slice(0, i), minO2 = Math.min(...prev.map((x) => x.eqo2)), minPo = Math.min(...prev.map((x) => x.peto2)), minEq = Math.min(...prev.map((x) => x.eqco2));
      if (m[i].eqo2 >= minO2 * 1.03 && m[i].peto2 >= minPo + 0.4 && m[i].eqco2 < minEq * 1.05) { i1 = i; break; }
    }
    if (i1 == null) i1 = Math.max(i2 - 1, 0);
    if (etapas[i2].fcFinal - etapas[i1].fcFinal < 15 && i1 > 0) i1 -= 1;
    return [etapas[i1].fin - 30, etapas[i2].fin - 30];
  }
  function umbralEn(b, t, fcmax, vo2max, peso, metodo) {
    const w = b.filter((r) => r.t >= t - 15 && r.t <= t + 15), fc = pyRound(mean(w.map((r) => r.hr))), vo2 = mean(w.map((r) => r.vo2)) / peso;
    return { tiempo: t, fc, velocidad: median(w.map((r) => r.speed)), vo2, pctFcmax: 100 * fc / fcmax, pctVo2max: 100 * vo2 / vo2max, metodo };
  }
  function umbralPorTiempo(b, t, fcmax, vo2max, peso) {
    const lo = b[0].t, hi = b[b.length - 1].t; return umbralEn(b, Math.min(Math.max(t, lo), hi), fcmax, vo2max, peso, "validado");
  }
  function umbralPorFc(b, fc, fcmax, vo2max, peso) {
    const hrs = b.map((r, i) => (i ? (r.hr + b[i - 1].hr) / 2 : r.hr));
    let idx = hrs.findIndex((h) => h >= fc); const t = idx >= 0 ? b[idx].t : b[b.length - 1].t;
    const u = umbralEn(b, t, fcmax, vo2max, peso, "validado"); u.fc = Math.round(fc); u.pctFcmax = 100 * fc / fcmax; return u;
  }

  const ZONAS = [["Z1", "Recuperación / base", "Muy cómodo, puedes platicar sin esfuerzo"], ["Z2", "Aeróbica", "Respiras más profundo, todavía puedes hablar en frases"], ["Z3", "Tempo", "Frases cortas; ritmo sostenido y exigente"], ["Z4", "Umbral", "Solo palabras sueltas; en el límite de lo sostenible"], ["Z5", "Máxima / VO₂max", "No puedes hablar; esfuerzos cortos"]];
  function velocidadParaFc(etapas, fc) {
    if (etapas.length < 2) return NaN;
    const pts = etapas.map((e) => [e.fcFinal, e.velocidad]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return interp(fc, pts.map((p) => p[0]), pts.map((p) => p[1]));
  }
  function calcularZonas(vt1, vt2, fcmax, fcrep, etapas) {
    const medio = pyRound((vt1 + vt2) / 2);
    const lims = [[Math.max(fcrep + 10, pyRound(vt1 * 0.8)), vt1], [vt1, medio], [medio, vt2 - 4], [vt2 - 4, Math.min(vt2 + 4, fcmax)], [Math.min(vt2 + 4, fcmax), fcmax]];
    return ZONAS.map(([codigo, nombre, sensacion], i) => ({ codigo, nombre, sensacion, fcMin: Math.trunc(lims[i][0]), fcMax: Math.trunc(lims[i][1]), velMin: velocidadParaFc(etapas, lims[i][0]), velMax: velocidadParaFc(etapas, lims[i][1]) }));
  }

  // ---------- validaciones ----------
  const f0 = (x) => x.toFixed(0), f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
  function validar(res, d, pesoExcel) {
    const V = (nombre, estado, detalle) => res.validaciones.push({ nombre, estado, detalle });
    const ex = d.filter((r) => r.t >= res.inicioEjercicio && r.t <= res.finEjercicio), s = res.socio;
    if (!s.edad) V("Datos del socio", "falla", "Falta la edad (y el sexo) del socio: sin ellos no hay percentil ni comparación por edad en el reporte.");
    // Criterios de esfuerzo máximo SIN RER: el equipo varía mucho en CO₂ y da RER falsos a frecuencias respiratorias altas.
    const crit = [["Meseta de VO₂ al final", res.meseta, res.meseta ? "El VO₂ dejó de subir en el último minuto" : "El VO₂ seguía subiendo al detenerse"]];
    let pct = null;
    if (s.edad) { const pred = 208 - 0.7 * s.edad; pct = 100 * res.fcMax / pred; crit.push(["FC máx ≥ 85 % de la esperada", pct >= 85, `${res.fcMax} lpm = ${f0(pct)} % de ${f0(pred)} (fórmula de Tanaka)`]); }
    res.criteriosMax = crit;
    const fcOk = pct == null ? null : pct >= 85;
    if (res.meseta && fcOk !== false) { res.maxima = true; V("Esfuerzo máximo", "ok", fcOk ? `Prueba máxima: hubo meseta de VO₂ y la FC llegó al ${f0(pct)} % de la esperada.` : "Hubo meseta de VO₂ (falta la edad para revisar la FC)."); }
    else if (fcOk) { res.maxima = true; V("Esfuerzo máximo", "aviso", `Probablemente máxima: la FC llegó al ${f0(pct)} % de la esperada, pero el VO₂ seguía subiendo al detenerse.`); }
    else if (res.meseta) { res.maxima = true; V("Esfuerzo máximo", "aviso", `Probablemente máxima: hubo meseta de VO₂, pero la FC solo llegó al ${f0(pct)} % de la esperada (menos de 85 %). Revisa la banda de pecho o si el socio usa algún medicamento que baje la FC.`); }
    else { res.maxima = false; V("Esfuerzo máximo", "falla", "No se confirma esfuerzo máximo (ni meseta de VO₂ ni FC ≥ 85 % de la esperada): se reporta como VO₂pico. El valor real probablemente es mayor; conviene repetir la prueba."); }
    const dur = (res.finEjercicio - res.inicioEjercicio) / 60;
    if (dur >= 8 && dur <= 18) V("Duración del ejercicio", "ok", `${f1(dur)} min corriendo (ideal 8–18 min).`);
    else V("Duración del ejercicio", "aviso", `${f1(dur)} min corriendo. Lo ideal es 8–18 min: en pruebas muy largas el cansancio acumulado puede bajar el VO₂max; en muy cortas no da tiempo de llegar al máximo.`);
    const pa = 100 * ex.filter((r) => r.artefacto).length / Math.max(ex.length, 1);
    V("Respiraciones válidas", pa < 8 ? "ok" : pa < 20 ? "aviso" : "falla", `${f0(pa)} % de respiraciones descartadas (tos, fuga de mascarilla o lecturas imposibles).`);
    const hr = ex.map((r) => r.hr), sin = 100 * hr.filter((h) => !(h > 30)).length / Math.max(hr.length, 1);
    let saltos = 0; for (let i = 1; i < hr.length; i++) if (Math.abs(hr[i] - hr[i - 1]) > 25) saltos++;
    if (sin < 2 && saltos < 3) V("Señal de frecuencia cardiaca", "ok", "Sin cortes ni saltos.");
    else V("Señal de frecuencia cardiaca", "aviso", `${f0(sin)} % sin señal y ${saltos} saltos bruscos. Revisar la banda de pecho.`);
    if (res.etapas.length) {
      const ri = Math.max(...res.etapas.slice(0, 2).map((e) => e.rerFinal));
      if (ri >= 1.0) V("Calentamiento", "aviso", `RER ${f2(ri)} en las primeras etapas (debería ser < 1.0): posible hiperventilación por nervios o mascarilla mal ajustada. Los umbrales son menos fiables.`);
      else V("Calentamiento", "ok", `RER ${f2(ri)} en las primeras etapas (normal).`);
    }
    if (res.costoPromedio) {
      const c = res.costoPromedio;
      if (c >= 170 && c <= 235) V("Costo de O₂ al correr", "ok", `${f0(c)} mL/kg/km (esperado 170–235). El sensor y la velocidad son coherentes.`);
      else V("Costo de O₂ al correr", "aviso", `${f0(c)} mL/kg/km, fuera de lo esperado (170–235). Revisar ajuste de mascarilla, calibración del sensor o velocidad real de la banda.`);
    }
    const finV = mean(d.filter((r) => r.t >= res.finEjercicio - 30 && r.t <= res.finEjercicio).map((r) => r.vo2kg30s));
    const caida = res.vo2max ? 100 * (1 - finV / res.vo2max) : 0;
    if (caida > 8) V("Final de la prueba", "aviso", `El VO₂ cayó ${f0(caida)} % antes de terminar: posible fuga en la mascarilla o pérdida de ritmo en la banda.`);
    if (Math.abs(res.peso - pesoExcel) > 2) V("Peso", "aviso", `El peso registrado (${f1(res.peso)} kg) no coincide con el de la app (${f1(pesoExcel)} kg). Se usó el registrado; corregir el perfil en la app.`);
    else V("Peso", "ok", `${f1(res.peso)} kg (${res.pesoFuente}).`);
    if (d.some((r) => isNum(r.incline) && Math.abs(r.incline) > 0)) V("Inclinación", "aviso", "La prueba registra inclinación; el protocolo estándar es 0 %.");
    const v1 = res.vt1, v2 = res.vt2, rango = v1.pctFcmax >= 55 && v1.pctFcmax <= 85 && v2.pctFcmax >= 78 && v2.pctFcmax <= 97 && v2.fc - v1.fc >= 8;
    if (v1.metodo === "validado" && v2.metodo === "validado") V("Umbrales ventilatorios", rango ? "ok" : "aviso", `Definidos por el personal: UV1 ${v1.fc} lpm, UV2 ${v2.fc} lpm.` + (rango ? "" : " Están fuera del rango típico; confirma que sean los correctos."));
    else {
      const p1 = v1.metodo === "validado" ? `UV1 ${v1.fc} lpm (definido por el personal)` : `UV1 ${v1.fc} lpm (${f0(v1.pctFcmax)} % FCmáx; propuesta automática, suele ser razonable: confírmala)`;
      const p2 = v2.metodo === "validado" ? `UV2 ${v2.fc} lpm (definido por el personal)` : `UV2 ${v2.fc} lpm (${f0(v2.pctFcmax)} % FCmáx; propuesta automática, NO es confiable con este equipo porque los equivalentes y la PetCO₂ no responden bien: defínela a mano en las gráficas)`;
      V("Umbrales ventilatorios", "aviso", `${p1}. ${p2}.` + (rango ? "" : " Están fuera del rango típico."));
    }
    const r = res.vo2maxApp ? res.vo2max / res.vo2maxApp : NaN;
    if (r >= 1 && r <= 1.3) V("Diferencia con la app", "ok", `App ${f1(res.vo2maxApp)} vs recalculado ${f1(res.vo2max)} (+${f0(100 * (r - 1))} %). Diferencia esperada: la app resta demasiado espacio muerto.`);
    else V("Diferencia con la app", "aviso", `App ${f1(res.vo2maxApp)} vs recalculado ${f1(res.vo2max)} (${(r >= 1 ? "+" : "") + f0(100 * (r - 1))} %). Diferencia fuera de lo habitual (0 a +30 %); revisar los datos.`);
    const est = res.validaciones.filter((v) => v.nombre !== "Umbrales ventilatorios").map((v) => v.estado);
    res.calidad = est.includes("falla") ? "Revisar" : est.filter((e) => e === "aviso").length >= 2 ? "Aceptable" : "Buena";
  }

  // ---------- análisis completo ----------
  /** socio: {nombre, sexo, edad, peso, vt1Fc, vt2Fc, evaluador} */
  function analizar(rows, nombreArchivo, socio) {
    const info = infoDesdeNombre(nombreArchivo);
    const d = leerFilas(rows);
    const pesoExcel = median(d.map((r) => r.vo2_app / r.vo2kg_app));
    socio = Object.assign({ nombre: info.nombre, sexo: "H" }, socio || {});
    if (!socio.nombre) socio.nombre = info.nombre;
    const peso = socio.peso ? socio.peso : round1(pesoExcel), pesoFuente = socio.peso ? "registro del socio" : "perfil de la app";
    recalcular(d, peso);
    const [inicio0, fin, inicioCal0] = detectarFases(d);
    const manualCal = isNum(socio.inicioCal) && socio.inicioCal > 0 ? socio.inicioCal : null;
    const inicioCal = manualCal != null ? manualCal : Math.min(inicioCal0, inicio0 > 0 ? inicio0 : inicioCal0);
    const inicio = Math.max(inicio0, inicioCal);
    for (const r of d) if (r.t < inicioCal) r.speed = 0;
    const etapas = detectarEtapas(d, inicioCal, fin, peso);
    if (etapas.length < 2) throw new Error("No se reconocen las etapas de la prueba (¿se interrumpió muy pronto?).");

    const ok = d.filter((r) => !r.artefacto), tt = ok.map((r) => r.t);
    const rm = mediaMovilTiempo(tt, ok.map((r) => r.vo2), 30), rmApp = mediaMovilTiempo(tt, ok.map((r) => r.vo2kgApp), 30);
    let iMax = -1, appMax = -Infinity;
    for (let i = 0; i < ok.length; i++) if (tt[i] >= inicio + 60 && tt[i] <= fin + 20) { if (iMax < 0 || rm[i] > rm[iMax]) iMax = i; if (rmApp[i] > appMax) appMax = rmApp[i]; }
    const vo2maxAbs = rm[iMax], vo2max = vo2maxAbs / peso;
    for (const r of d) r.vo2kg30s = NaN; ok.forEach((r, i) => (r.vo2kg30s = rm[i] / peso));

    const hrv = d.map((r) => (r.hr > 30 ? r.hr : NaN));
    const fcMax = pyRound(max(rollingCenterMedian(hrv, 5, 3)));
    const fcRep = inicioCal > 30 ? pyRound(median(hrv.filter((_, i) => d[i].t < Math.max(inicioCal, 30)))) : Math.trunc(median(hrv.slice(0, 20)));
    const mVco2 = mediaMovilTiempo(tt, ok.map((r) => r.vco2), 30), mVo2 = mediaMovilTiempo(tt, ok.map((r) => r.vo2), 30);
    const rerMax = max(tt.map((t, i) => (t >= inicio + 60 && t <= fin + 30 ? mVco2[i] / mVo2[i] : NaN)));
    const velMax = max(d.filter((r) => r.t >= inicio && r.t <= fin).map((r) => r.speed));

    let base = rm[0], bd = Infinity; tt.forEach((t, i) => { const x = Math.abs(t - (fin - 60)); if (x < bd) { bd = x; base = rm[i]; } });
    const sel = rm.filter((_, i) => tt[i] >= fin - 60 && tt[i] <= fin + 20);
    const inc60 = sel.length ? (max(sel) - base) / peso : 0, tPico = tt[iMax];
    const meseta = inc60 < 1.0 || tPico <= fin - 15;

    const b = promedios15s(d, inicio, fin);
    let [t1, t2] = etapas.length >= 4 ? detectarUmbralesEtapas(d, etapas) : [null, null];
    if (t1 == null) [t1, t2] = detectarUmbralesBins(b);
    const manual = (T, fc, auto) => isNum(T) ? umbralPorTiempo(b, T, fcMax, vo2max, peso) : fc ? umbralPorFc(b, fc, fcMax, vo2max, peso) : umbralEn(b, auto, fcMax, vo2max, peso, "automático");
    const vt1 = manual(socio.vt1T, socio.vt1Fc, t1), vt2 = manual(socio.vt2T, socio.vt2Fc, t2);

    let percentil = null, cat = "Sin referencia (falta edad)";
    if (socio.edad) { percentil = percentilFriend(vo2max, socio.edad, socio.sexo); cat = categoria(percentil); }
    const costos = etapas.filter((e) => e.costoO2 && e.velocidad >= 9.5 && e.velocidad <= 14.5).map((e) => e.costoO2);
    const res = {
      socio, fecha: info.fecha, archivo: nombreArchivo, peso, pesoFuente, datos: d, bins: b, inicioEjercicio: inicio, inicioCalentamiento: inicioCal, inicioCalManual: manualCal != null, tFinal: d[d.length - 1].t, finEjercicio: fin, etapas,
      vo2max, vo2maxTiempo: tPico, vo2maxApp: appMax, vo2maxAbs: vo2maxAbs / 1000, fcMax, fcReposo: fcRep, rerMax, velMax, meseta, maxima: true,
      percentil, categoria: cat, vt1, vt2, zonas: calcularZonas(vt1.fc, vt2.fc, fcMax, fcRep, etapas), validaciones: [], criteriosMax: [],
      costoPromedio: costos.length ? mean(costos) : null, calidad: "Buena",
    };
    validar(res, d, pesoExcel);
    res.etiquetaVo2 = res.maxima ? "VO₂max" : "VO₂pico";
    res.metricasEtapas = etapas.map((e) => metricasEtapa(d, e));
    const mV = mediaMovilTiempo(tt, ok.map((r) => r.vco2), 30); for (const r of d) r.vco2kg30s = NaN; ok.forEach((r, i) => (r.vco2kg30s = mV[i] / peso));
    res.serie = serie15(d);
    res.filas = filasFases(d, res, peso);
    return res;
  }

  const api = { analizar, serie15, infoDesdeNombre, tablaFriend, percentilFriend, categoria, esMujer, mediaMovilTiempo };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VO2 = api;
})(typeof window !== "undefined" ? window : globalThis);
