// ============================================================
//  MÓDULO INFLACIÓN — Mayorista Emanuel
//  Tabla histórica + Calculadora acumulada + Simulador precio
// ============================================================

let inflacionData = [];

// ── Cargar datos ─────────────────────────────────────────────
async function cargarInflacion() {
  if (inflacionData.length) return inflacionData;
  const r = await fetch("inflacion.json?v=" + Date.now());
  inflacionData = await r.json();
  return inflacionData;
}

// ── Abrir modal ───────────────────────────────────────────────
async function abrirModalInflacion() {
  const modal = document.getElementById("modalInflacion");
  modal.style.display = "flex";
  const data = await cargarInflacion();
  renderTablaInflacion(data);
  poblarSelects(data);
  renderGraficoInflacion(data);
}

document.getElementById("btnInflacion")
  .addEventListener("click", abrirModalInflacion);

document.getElementById("btnCerrarInflacion")
  .addEventListener("click", () => {
    document.getElementById("modalInflacion").style.display = "none";
  });

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll(".tab-inf").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-inf").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".inf-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
  });
});

// ── 1. TABLA HISTÓRICA ────────────────────────────────────────
function renderTablaInflacion(data) {
  const tbody = document.getElementById("infTablaBody");
  tbody.innerHTML = "";
  let acum = 1;
  data.forEach(({ mes, ipc }) => {
    acum *= (1 + ipc / 100);
    const tr = document.createElement("tr");
    const cls = ipc >= 5 ? "inf-alta" : ipc >= 3 ? "inf-media" : "inf-baja";
    tr.innerHTML = `
      <td class="mes-label">${mes}</td>
      <td class="${cls}">${ipc.toFixed(1)}%</td>
      <td>${((acum - 1) * 100).toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Gráfico histórico ─────────────────────────────────────────
let infChart = null;
function renderGraficoInflacion(data) {
  const ctx = document.getElementById("chartInflacion").getContext("2d");
  if (infChart) infChart.destroy();
  infChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.mes),
      datasets: [{
        label: "IPC mensual %",
        data: data.map(d => d.ipc),
        backgroundColor: data.map(d =>
          d.ipc >= 5 ? "#ff1744cc" : d.ipc >= 3 ? "#ffd600cc" : "#00e676cc"
        ),
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: { ticks: { color: "#aaa", font: { size: 10 } }, grid: { color: "#ffffff11" } },
        y: { ticks: { color: "#aaa", callback: v => v + "%" }, grid: { color: "#ffffff11" } }
      }
    }
  });
}

// ── Poblar selects ────────────────────────────────────────────
function poblarSelects(data) {
  ["calcDesde","calcHasta","simDesde"].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    data.forEach(({ mes }, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = mes;
      sel.appendChild(opt);
    });
  });
  document.getElementById("calcDesde").value = 0;
  document.getElementById("calcHasta").value = inflacionData.length - 1;
  document.getElementById("simDesde").value  = inflacionData.length - 1;
}

// ── 2. CALCULADORA ACUMULADA ──────────────────────────────────
document.getElementById("btnCalcular").addEventListener("click", () => {
  const desde = parseInt(document.getElementById("calcDesde").value);
  const hasta  = parseInt(document.getElementById("calcHasta").value);
  if (desde >= hasta) {
    document.getElementById("calcResultado").innerHTML =
      `<span style="color:#ff1744">⚠️ El mes de inicio debe ser anterior al mes final.</span>`;
    return;
  }
  const slice = inflacionData.slice(desde, hasta + 1);
  const acum  = slice.reduce((acc, { ipc }) => acc * (1 + ipc / 100), 1) - 1;
  const meses = slice.length;
  const d = inflacionData[desde].mes;
  const h = inflacionData[hasta].mes;

  document.getElementById("calcResultado").innerHTML = `
    <div class="calc-result-box">
      <div class="calc-result-row">
        <span>Período</span>
        <strong>${d} → ${h} (${meses} meses)</strong>
      </div>
      <div class="calc-result-row">
        <span>Inflación acumulada</span>
        <strong class="inf-alta">${(acum * 100).toFixed(2)}%</strong>
      </div>
      <div class="calc-result-row">
        <span>Promedio mensual</span>
        <strong>${(acum * 100 / meses).toFixed(2)}%</strong>
      </div>
      <div class="calc-result-row">
        <span>Ejemplo: $1.000 en ${d}</span>
        <strong>→ $${(1000 * (1 + acum)).toLocaleString("es-AR", {minimumFractionDigits:2})} en ${h}</strong>
      </div>
    </div>
  `;
});

// ── 3. SIMULADOR DE PRECIO ────────────────────────────────────
document.getElementById("btnSimular").addEventListener("click", () => {
  const precio  = parseFloat(document.getElementById("simPrecio").value.replace(",","."));
  const desde   = parseInt(document.getElementById("simDesde").value);
  const meses3  = parseInt(document.getElementById("simMeses").value) || 3;

  if (!precio || isNaN(precio)) {
    document.getElementById("simResultado").innerHTML =
      `<span style="color:#ff1744">⚠️ Ingresá un precio válido.</span>`;
    return;
  }

  // Promedio de los últimos N meses disponibles como base
  const ultimos = inflacionData.slice(-6);
  const promMensual = ultimos.reduce((a, d) => a + d.ipc, 0) / ultimos.length;

  // Proyección compuesta
  let rows = "";
  let precioAcum = precio;
  for (let i = 1; i <= meses3; i++) {
    precioAcum *= (1 + promMensual / 100);
    const mesLabel = i === 1 ? "1 mes" : `${i} meses`;
    rows += `
      <div class="calc-result-row">
        <span>En ${mesLabel}</span>
        <strong>$${precioAcum.toLocaleString("es-AR", {minimumFractionDigits:2})}</strong>
      </div>`;
  }

  const aumento = ((precioAcum / precio - 1) * 100).toFixed(1);
  document.getElementById("simResultado").innerHTML = `
    <div class="calc-result-box">
      <div class="calc-result-row">
        <span>Precio actual</span>
        <strong>$${precio.toLocaleString("es-AR", {minimumFractionDigits:2})}</strong>
      </div>
      <div class="calc-result-row">
        <span>Inflación mensual promedio (últ. 6 meses)</span>
        <strong>${promMensual.toFixed(2)}%</strong>
      </div>
      ${rows}
      <div class="calc-result-row">
        <span>Aumento total estimado</span>
        <strong class="inf-alta">+${aumento}%</strong>
      </div>
    </div>
  `;
});