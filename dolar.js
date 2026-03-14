// ============================================================
//  MÓDULO DÓLAR — Mayorista Emanuel
//  API: dolarapi.com — actualización cada 30 minutos
// ============================================================

const DOLAR_INTERVAL = 5 * 60 * 1000; // 5 minutos

async function fetchDolar() {
  try {
    const [oficial, blue] = await Promise.all([
      fetch("https://dolarapi.com/v1/dolares/oficial").then(r => r.json()),
      fetch("https://dolarapi.com/v1/dolares/blue").then(r => r.json()),
    ]);

    actualizarTira(oficial, blue);
  } catch (err) {
    console.warn("Error al obtener cotización dólar:", err);
    const tira = document.getElementById("dolarTira");
    if (tira) tira.innerHTML = `<span class="dolar-error">💵 Sin conexión</span>`;
  }
}

function actualizarTira(oficial, blue) {
  const tira = document.getElementById("dolarTira");
  if (!tira) return;

  const fmt = v => v ? `$${Number(v).toLocaleString("es-AR")}` : "—";
  const ahora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  tira.innerHTML = `
    <span class="dolar-item">
      <span class="dolar-label dolar-label-oficial">Oficial</span>
      <span class="dolar-compra">${fmt(oficial?.compra)}</span>
      <span class="dolar-sep">/</span>
      <span class="dolar-venta">${fmt(oficial?.venta)}</span>
    </span>
    <span class="dolar-divider">|</span>
    <span class="dolar-item">
      <span class="dolar-label dolar-label-blue">Blue</span>
      <span class="dolar-compra">${fmt(blue?.compra)}</span>
      <span class="dolar-sep">/</span>
      <span class="dolar-venta">${fmt(blue?.venta)}</span>
    </span>
    <span class="dolar-hora">🕐 ${ahora}</span>
  `;
}

// Arrancar al cargar y luego cada 30 min
fetchDolar();
setInterval(fetchDolar, DOLAR_INTERVAL);