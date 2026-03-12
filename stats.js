/* ============================================================
   stats.js — Modal de ventas históricas por producto
   
   Uso: incluir en index.html DESPUÉS de precios.js y Chart.js
   
   Estructura esperada de los JSON:
   [
     { "codigos": 634, "productos": "...", "uxb": 12,
       "vta_mes_1": 15.33, "vta_mes_2": 12.5, ... "vta_mes_12": 13.75 }
   ]
   
   Los meses van de vta_mes_1 (más antiguo) a vta_mes_12 (más reciente).
   Ajustá MESES_LABELS según tu período real.
   ============================================================ */

// ── Configuración ──────────────────────────────────────────
const STATS_CONFIG = {
  archivos: {
    fair:    "stats_fair.json",
    burzaco: "stats_burzaco.json",
    korn:    "stats_korn.json",
    tucuman: "stats_tucuman.json"
  },
  // Mes y año de inicio (el primer vta_mes_1 / ene_25 en el JSON)
  // Ajustá esto cuando cambie el período
  mesInicio: 1,   // 1=Ene — tu JSON empieza en ene_25
  anioInicio: 25, // 25 = 2025
  colores: {
    fair:    "#00e676",
    burzaco: "#40c4ff",
    korn:    "#ffd600",
    tucuman: "#ff6d00"
  }
};

// ── Estado ─────────────────────────────────────────────────
const statsCache = {};          // { fair: [...], burzaco: [...], ... }
let statsChart   = null;        // instancia Chart.js
let statsSucursal = "fair";     // sucursal activa
let statsProductoActual = null; // { codigos, productos }
let statsMostrar = 12;          // meses a mostrar: 12 o 24

// ── Carga lazy de JSON ──────────────────────────────────────
async function cargarStats(sucursal) {
  if (statsCache[sucursal]) return statsCache[sucursal];
  try {
    const res = await fetch(STATS_CONFIG.archivos[sucursal] + "?_=" + Date.now());
    if (!res.ok) throw new Error("No se pudo cargar " + STATS_CONFIG.archivos[sucursal]);
    statsCache[sucursal] = await res.json();
    return statsCache[sucursal];
  } catch (e) {
    console.warn("⚠️ stats.js:", e.message);
    return [];
  }
}

// ── Buscar producto en los datos (soporta ambos formatos) ───
function encontrarProducto(data, codigos) {
  return data.find(p => String(p.codigos) === String(codigos)) || null;
}

// ── Normalizar producto a formato estándar ───────────────────
// Soporta:
//   Formato A: { codigos, productos, uxb, vta_mes_1...vta_mes_N }
//   Formato B: { codigos, nombre_producto, uxb_unificada, ene_25, feb_25... }
const MESES_MAP = {
  ene:1, feb:2, mar:3, abr:4, may:5, jun:6,
  jul:7, ago:8, sep:9, oct:10, nov:11, dic:12
};

function normalizarProducto(p) {
  if (!p) return null;

  // Si ya tiene vta_mes_1 → formato correcto, devolver tal cual
  if (p.vta_mes_1 !== undefined) return p;

  // Formato B → convertir
  const norm = {
    codigos:  p.codigos,
    productos: p.nombre_producto || p.productos || "",
    uxb:      p.uxb_unificada ?? p.uxb ?? 1
  };

  // Ordenar las claves de mes cronológicamente
  // Claves tipo "ene_25", "feb_25", ..., "ene_26"
  const claveMes = [];
  for (const key of Object.keys(p)) {
    const m = key.match(/^([a-z]{3})_(\d{2})$/);
    if (m && MESES_MAP[m[1]]) {
      const mes  = MESES_MAP[m[1]];
      const anio = parseInt(m[2]);
      claveMes.push({ key, orden: anio * 100 + mes });
    }
  }
  claveMes.sort((a, b) => a.orden - b.orden);

  claveMes.forEach(({ key }, i) => {
    norm["vta_mes_" + (i + 1)] = p[key] ?? 0;
  });

  return norm;
}

// ── Detectar cuántos meses hay en el producto ───────────────
function contarMeses(producto) {
  let n = 0;
  while (producto["vta_mes_" + (n + 1)] !== undefined) n++;
  return n || 12; // mínimo 12 por si acaso
}

// ── Generar etiquetas dinámicas de meses ─────────────────────
function generarLabels(cantMeses) {
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun",
                 "Jul","Ago","Sep","Oct","Nov","Dic"];
  const labels = [];
  let m = STATS_CONFIG.mesInicio - 1; // 0-indexed
  let a = STATS_CONFIG.anioInicio;
  for (let i = 0; i < cantMeses; i++) {
    labels.push(MESES[m] + "-" + String(a).padStart(2,"0"));
    m++;
    if (m >= 12) { m = 0; a++; }
  }
  return labels;
}

// ── Extraer array de ventas mensuales (últimos N meses) ──────
function extraerVentas(producto) {
  const total = contarMeses(producto);
  const desde = Math.max(1, total - statsMostrar + 1);
  const vals = [];
  for (let i = desde; i <= total; i++) {
    vals.push(parseFloat(producto["vta_mes_" + i] ?? 0) || 0);
  }
  return vals;
}

// ── Generar labels para los últimos N meses disponibles ──────
function labelsParaProducto(producto) {
  const total = contarMeses(producto);
  const desde = Math.max(1, total - statsMostrar + 1);
  return generarLabels(total).slice(desde - 1);
}

// ── Calcular KPIs ───────────────────────────────────────────
function calcularKPIs(ventas) {
  const total  = ventas.reduce((a, b) => a + b, 0);
  const prom   = total / ventas.length;
  const max    = Math.max(...ventas);
  const mesMax = ventas.indexOf(max);
  const ult3   = ventas.slice(-3).reduce((a,b)=>a+b,0) / 3;
  return { total, prom, max, mesMax, ult3 };
}

// ── Renderizar gráfico ──────────────────────────────────────
function renderChart(ventas, sucursal) {
  const ctx = document.getElementById("chartVentas");
  if (!ctx) return;

  const color = STATS_CONFIG.colores[sucursal];

  if (statsChart) {
    statsChart.destroy();
    statsChart = null;
  }

  statsChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: statsProductoActual._labels || generarLabels(ventas.length),
      datasets: [{
        label: sucursal.charAt(0).toUpperCase() + sucursal.slice(1),
        data: ventas,
        borderColor: color,
        backgroundColor: color + "18",
        borderWidth: 2.5,
        pointBackgroundColor: color,
        pointBorderColor: "#0d0d0d",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e1e1e",
          borderColor: color,
          borderWidth: 1,
          titleColor: color,
          bodyColor: "#e0e0e0",
          titleFont: { family: "'Space Mono', monospace", size: 11 },
          bodyFont:  { family: "'Space Mono', monospace", size: 12 },
          callbacks: {
            label: ctx => " " + ctx.parsed.y.toFixed(2) + " btos"
          }
        }
      },
      scales: {
        x: {
          grid:  { color: "#2a2a2a" },
          ticks: { color: "#9e9e9e", font: { family: "'Space Mono', monospace", size: 10 } }
        },
        y: {
          grid:  { color: "#2a2a2a" },
          ticks: { color: "#9e9e9e", font: { family: "'Space Mono', monospace", size: 10 },
                   callback: v => v.toFixed(0) }
        }
      }
    }
  });
}

// ── Renderizar tabla mensual ────────────────────────────────
function renderTablaStats(ventas, uxb) {
  const tbody = document.getElementById("statsTablaBody");
  if (!tbody) return;

  const maxVal = Math.max(...ventas, 1);
  const u = uxb || 1;
  tbody.innerHTML = "";

  const mesesLabels = statsProductoActual?._labels || generarLabels(ventas.length);
  ventas.forEach((v, i) => {
    const tr = document.createElement("tr");
    const pct = Math.round((v / maxVal) * 100);
    const cls = v === 0 ? "valor-cero" : v === maxVal ? "valor-alto" : "";
    const labelBultos = v === 0
      ? `<span class="valor-cero">0 btos x ${u}u</span>`
      : `<span class="${cls}">${v.toFixed(2)} btos x ${u}u</span>`;
    tr.innerHTML = `
      <td class="mes-label">${mesesLabels[i]}</td>
      <td>
        ${labelBultos}
        <span class="bar-inline" style="width:${pct * 0.8}px"></span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Renderizar KPIs ─────────────────────────────────────────
function renderKPIs(kpis) {
  const set = (id, val, cls = "") => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.className = "kpi-value " + cls; }
  };
  set("kpiTotal", kpis.total.toFixed(1) + " uds");
  set("kpiProm",  kpis.prom.toFixed(1) + " uds/mes");
  set("kpiUlt3",  kpis.ult3.toFixed(1) + " uds",
      kpis.ult3 >= kpis.prom ? "success" : "warning");
}

// ── Actualizar modal con datos de una sucursal ──────────────
async function actualizarModalStats(sucursal) {
  if (!statsProductoActual) return;

  statsSucursal = sucursal;

  // Actualizar tabs
  document.querySelectorAll(".tab-suc").forEach(t => {
    t.classList.toggle("active", t.dataset.suc === sucursal);
  });

  // ── Tab especial: Total (suma las 4 sucursales) ──
  if (sucursal === "total") {
    const sucks = ["fair","burzaco","korn","tucuman"];

    // 1) Encontrar la cantidad máxima de meses disponibles
    let maxMeses = 0;
    const prodsNorm = [];
    for (const s of sucks) {
      const data = await cargarStats(s);
      const prod = normalizarProducto(encontrarProducto(data, statsProductoActual.codigos));
      prodsNorm.push(prod);
      if (prod) maxMeses = Math.max(maxMeses, contarMeses(prod));
    }
    if (maxMeses === 0) maxMeses = 12;

    // 2) Guardar maxMeses temporalmente para que extraerVentas use el rango correcto
    const prevMostrar = statsMostrar;
    const cantMeses = Math.min(statsMostrar, maxMeses);
    statsMostrar = cantMeses;

    // 3) Sumar alineando por los ÚLTIMOS N meses de cada sucursal
    const ventasTotal = new Array(cantMeses).fill(0);
    for (const prod of prodsNorm) {
      if (!prod) continue;
      const ventas = extraerVentas(prod);
      ventas.forEach((v, i) => { ventasTotal[i] += v; });
    }

    statsProductoActual._labels = labelsParaProducto(
      prodsNorm.find(p => p && contarMeses(p) === maxMeses) || prodsNorm.find(Boolean)
    );

    statsMostrar = prevMostrar;

    renderChart(ventasTotal, "fair");
    renderKPIs(calcularKPIs(ventasTotal));
    renderTablaStats(ventasTotal, statsProductoActual.uxb);
    return;
  }

  const data    = await cargarStats(sucursal);
  const prod    = normalizarProducto(encontrarProducto(data, statsProductoActual.codigos));

  if (!prod) {
    // Sin datos para esta sucursal
    if (statsChart) { statsChart.destroy(); statsChart = null; }
    const ctx = document.getElementById("chartVentas");
    if (ctx) {
      const c2d = ctx.getContext("2d");
      c2d.clearRect(0, 0, ctx.width, ctx.height);
    }
    document.getElementById("statsTablaBody").innerHTML =
      `<tr><td colspan="2" style="text-align:center;color:var(--text-muted);padding:20px">Sin datos para esta sucursal</td></tr>`;
    ["kpiTotal","kpiProm","kpiUlt3"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = "—";
    });
    return;
  }

  const ventas = extraerVentas(prod);
  const kpis   = calcularKPIs(ventas);
  statsProductoActual._labels = labelsParaProducto(prod);

  renderChart(ventas, sucursal);
  renderKPIs(kpis);
  renderTablaStats(ventas, prod.uxb);
}

// ── Abrir modal ─────────────────────────────────────────────
async function abrirModalStats(codigos, nombreProducto, uxb) {
  statsProductoActual = { codigos, productos: nombreProducto, uxb: uxb || 1 };

  // Rellenar header
  document.getElementById("statsCod").textContent    = "COD " + codigos;
  document.getElementById("statsNombre").textContent = nombreProducto;

  // Botón toggle 12/24 meses
  let btnToggle = document.getElementById("btnToggleMeses");
  if (!btnToggle) {
    btnToggle = document.createElement("button");
    btnToggle.id = "btnToggleMeses";
    btnToggle.style.cssText = `
      font-family: 'Space Mono', monospace;
      font-size: 0.72rem;
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid #00e676;
      background: transparent;
      color: #00e676;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    `;
    // Insertarlo en el header del modal stats
    const headerInfo = document.querySelector(".stats-header-info");
    if (headerInfo) headerInfo.appendChild(btnToggle);
  }
  statsMostrar = 12;
  btnToggle.textContent = "Ver 24 meses";
  btnToggle.onclick = async () => {
    statsMostrar = statsMostrar === 12 ? 24 : 12;
    btnToggle.textContent = statsMostrar === 12 ? "Ver 24 meses" : "Ver 12 meses";
    await actualizarModalStats(statsSucursal);
  };

  // Mostrar modal
  const modal = document.getElementById("modalStats");
  modal.style.display = "flex";

  // Cargar primera sucursal
  await actualizarModalStats("fair");
}

// ── Cerrar modal ────────────────────────────────────────────
function cerrarModalStats() {
  document.getElementById("modalStats").style.display = "none";
  statsProductoActual = null;
  statsMostrar = 12;
  if (statsChart) { statsChart.destroy(); statsChart = null; }
  // Resetear botón
  const btn = document.getElementById("btnToggleMeses");
  if (btn) btn.textContent = "Ver 24 meses";
}

// ── Init: listeners del modal ───────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Cerrar con X
  document.getElementById("btnCerrarStats")
    ?.addEventListener("click", cerrarModalStats);

  // Cerrar clickeando fondo
  document.getElementById("modalStats")
    ?.addEventListener("click", e => {
      if (e.target.id === "modalStats") cerrarModalStats();
    });

  // Tabs de sucursal
  document.querySelectorAll(".tab-suc").forEach(tab => {
    tab.addEventListener("click", () => {
      actualizarModalStats(tab.dataset.suc);
    });
  });
});