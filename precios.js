// precios.js — con histórico de ventas al hacer click en COD

// ---------- UTILS ----------
const normalizarClave = s =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const getFirstField = (obj, candidates = []) => {
  for (const cand of candidates) {
    const nc = normalizarClave(cand);
    for (const k of Object.keys(obj)) {
      if (normalizarClave(k) === nc) return obj[k];
    }
  }
  return undefined;
};

// ---------- ALIAS ----------
const aliasMapRaw = {
  "cod": ["cod", "codigos", "codigo", "codigoart", "codigo_art"],
  productos: ["producto", "productos", "descripcion", "descrip", "detalle"],
  uxb: ["uxb", "unidades", "u_x_b"],
  vtafair: ["vtafair", "fair_ventas", "fairventas", "vta_fair"],
  vtaburza: ["vtaburza", "burzaco_ventas", "burzacoventas", "vta_burzaco"],
  vtakorn: ["vtakorn", "a_korn_ventas", "akorn_ventas", "korn_ventas"],
  vtatucu: ["vtatucu", "tucuman_ventas", "tucumanventas"],
  fair: ["fair", "fair_stock", "fairstock"],
  burza: ["burza", "burzaco_stock", "burzacostock"],
  korn: ["korn", "a_korn_stock", "akorn_stock"],
  tucu: ["tucu", "tucuman_stock", "tucumanstock"],
  cdistrib: ["cdistrib", "c_distrib", "c.distrib", "cdist", "cdistribucion"],
  precios: ["precios", "precio_vta", "precio", "precios_vta"]
};
const aliasMap = {};
for (const [alias, arr] of Object.entries(aliasMapRaw)) {
  for (const key of arr) aliasMap[normalizarClave(key)] = alias;
}
function lookupAliasForColumn(colName) {
  const nk = normalizarClave(colName);
  return aliasMap[nk] || colName;
}

function resolveKeyForAlias(alias, rows = []) {
  const wanted = alias.toString();
  const candidates = [];
  if (aliasMapRaw[wanted]) candidates.push(...aliasMapRaw[wanted]);
  candidates.push(wanted);
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      const nk = normalizarClave(k);
      for (const cand of candidates) {
        if (nk === normalizarClave(cand)) return k;
      }
    }
  }
  return null;
}

// ---------- ESTADO ----------
let datosOriginales = [];
let seleccionados = JSON.parse(localStorage.getItem("seleccionados") || "[]");

// ---------- ELEMENTOS ----------
const tabla = document.getElementById("tablaPrincipal");
const theadEl = document.getElementById("encabezado");
const tbodyEl = document.getElementById("cuerpo");
const modal = document.getElementById("modalSeleccion");
const listaSeleccion = document.getElementById("listaSeleccion");
const btnMostrar = document.getElementById("btnMostrar");
const btnCerrar = document.getElementById("btnCerrar");
const btnVaciar = document.getElementById("btnVaciar");
const btnExportar = document.getElementById("btnExportar");

// ---------- CARGA ----------
async function cargarDatos() {
  try {
    const res = await fetch("precios.json?_=" + Date.now());
    if (!res.ok) throw new Error("No se pudo cargar precios.json");
    const data = await res.json();
    datosOriginales = Array.isArray(data) ? data : [];
    console.log(`✅ ${datosOriginales.length} productos cargados`);
    renderTabla(datosOriginales);
  } catch (err) {
    console.error("❌ Error al cargar precios.json:", err);
    theadEl.innerHTML = "<tr><th style='color:red'>⚠️ Error cargando precios.json</th></tr>";
    tbodyEl.innerHTML = "<tr><td style='text-align:center'>Verificá que precios.json esté en la carpeta o usá Live Server</td></tr>";
  }
}
cargarDatos();

// ---------- ORDEN DE COLUMNAS ----------
const ordenColumnas = [
  "cod", "productos", "uxb",
  "vtafair", "vtaburza", "vtakorn", "vtatucu",
  "fair", "burza", "korn", "tucu",
  "cdistrib", "precios"
];

// ---------- RENDER TABLA ----------
function renderTabla(data) {
  theadEl.innerHTML = "";
  tbodyEl.innerHTML = "";

  if (!data || data.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 20;
    td.textContent = "No hay datos para mostrar";
    td.style.textAlign = "center";
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
    return;
  }

  const clavesSet = new Set();
  data.forEach(r => Object.keys(r).forEach(k => clavesSet.add(k)));
  const todasClaves = Array.from(clavesSet);

  const columnasReales = [];
  const keyCod = resolveKeyForAlias("cod", data);
  if (keyCod) columnasReales.push(keyCod);

  for (const alias of ordenColumnas) {
    if (alias === "cod") continue;
    const key = resolveKeyForAlias(alias, data);
    if (key && !columnasReales.includes(key)) columnasReales.push(key);
  }

  todasClaves.forEach(k => {
    if (!columnasReales.includes(k)) columnasReales.push(k);
  });

  // Encabezado
  const trHead = document.createElement("tr");
  columnasReales.forEach(colKey => {
    const th = document.createElement("th");
    let label = lookupAliasForColumn(colKey);
    if (label.toLowerCase() === "totalventas") label = "Tot.Vtas";
    th.textContent = label;
    if (["producto", "productos", "descripcion"].includes(normalizarClave(colKey))) {
      th.classList.add("col-productos");
    }
    trHead.appendChild(th);
  });
  const thSel = document.createElement("th");
  thSel.textContent = "Elegir";
  trHead.appendChild(thSel);
  theadEl.appendChild(trHead);

  // Calcular total ventas y ordenar
  const columnasVentas = ["vtafair", "vtaburza", "vtakorn", "vtatucu"];
  const columnasVentasReales = columnasVentas.map(a => resolveKeyForAlias(a, data)).filter(Boolean);

  data.forEach(item => {
    let totalVentas = 0;
    columnasVentasReales.forEach(col => { totalVentas += parseFloat(item[col]) || 0; });
    item.totalVentas = parseFloat(totalVentas.toFixed(1));
  });
  data.sort((a, b) => b.totalVentas - a.totalVentas);

  // Filas
  data.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    columnasReales.forEach(colKey => {
      const td = document.createElement("td");
      const val = row[colKey] ?? "";
      const colAlias = lookupAliasForColumn(colKey);

      if (colAlias === "precios") {
        const num = parseFloat(String(val).replace(",", "."));
        td.textContent = !isNaN(num)
          ? num.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
          : val;
      } else if (colAlias !== "cod" && colAlias !== "productos" && colAlias !== "uxb") {
        // Columnas numéricas: mostrar con 1 decimal
        const num = parseFloat(String(val).replace(",", "."));
        if (!isNaN(num) && val !== "" && val !== null) {
          td.textContent = num.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        } else {
          td.textContent = val;
        }
      } else {
        td.textContent = val;
      }

      const numVal = parseFloat(String(val).replace(",", "."));
      if (!isNaN(numVal)) {
        if (numVal <= 0) td.classList.add("venta-cero");
        else if (columnasVentasReales.includes(colKey) && numVal > 0) td.classList.add("venta-pos");
      }

      if (["producto", "productos", "descripcion"].includes(normalizarClave(colKey))) {
        td.classList.add("productos-col");
      }

      // ── Click en COD para ver histórico de ventas ──
      if (colAlias === "cod") {
        td.classList.add("cod-link");
        td.title = "📊 Ver histórico de ventas";
        td.addEventListener("click", (e) => {
          e.stopPropagation();
          const codVal    = row[colKey] ?? "";
          const nombreVal = getFirstField(row, ["PRODUCTOS","productos","producto","descripcion"]) || "";
          const uxbVal    = getFirstField(row, ["uxb","UXB","unidades"]) || 1;
          if (typeof abrirModalStats === "function") {
            abrirModalStats(codVal, nombreVal, uxbVal);
          }
        });
      }

      tr.appendChild(td);
    });

    // Botón Elegir
    const tdBtn = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn-elegir";
    const id = getFirstField(row, ["CODIGOS","codigos","codigo","cod","codigo_art"]) || `fila-${rowIndex}`;
    const isSel = seleccionados.some(s => {
      const sId = getFirstField(s, ["CODIGOS","codigos","codigo","cod","codigo_art"]);
      return normalizarClave(String(sId)) === normalizarClave(String(id));
    });
    btn.classList.toggle("agregado", isSel);
    btn.textContent = isSel ? "✓ Agregado" : "Elegir";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleSeleccionByIdAndRow(id, row, btn);
    });
    tdBtn.appendChild(btn);
    tr.appendChild(tdBtn);
    tbodyEl.appendChild(tr);
  });

  // Fila totales
  const columnasNumericas = ["vtafair","vtaburza","vtakorn","vtatucu","fair","burza","korn","tucu","cdistrib"];
  const columnasNumericasReales = columnasNumericas.map(a => resolveKeyForAlias(a, data)).filter(Boolean);
  const totales = {};
  columnasNumericasReales.forEach(col => {
    totales[col] = parseFloat(data.reduce((acc, r) => acc + (parseFloat(r[col]) || 0), 0).toFixed(1));
  });

  const trTotal = document.createElement("tr");
  trTotal.classList.add("fila-totales");

  columnasReales.forEach(colKey => {
    const td = document.createElement("td");
    const colAlias = lookupAliasForColumn(colKey);
    if (colAlias === "productos") {
      td.textContent = "Totales";
    } else if (columnasNumericasReales.includes(colKey)) {
      td.textContent = totales[colKey].toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    } else if (colAlias === "precios") {
      const totalPrecio = data.reduce((acc, r) => acc + (parseFloat(r[colKey]) || 0), 0);
      td.textContent = totalPrecio.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    } else {
      td.textContent = "";
    }
    trTotal.appendChild(td);
  });

  const tdFinal = document.createElement("td");
  tdFinal.textContent = "";
  trTotal.appendChild(tdFinal);
  tbodyEl.appendChild(trTotal);

  aplicarFormatoStock();
}

// ---------- FORMATO STOCK ----------
function aplicarFormatoStock() {
  const columnasStock = ["fair","burza","korn","tucu"].map(lookupAliasForColumn);
  const filas = tbodyEl.querySelectorAll("tr");
  filas.forEach(tr => {
    const celdas = tr.children;
    columnasStock.forEach(colAlias => {
      const idx = Array.from(theadEl.querySelectorAll("th")).findIndex(th => th.textContent === colAlias);
      if (idx >= 0 && celdas[idx]) {
        const td = celdas[idx];
        const val = parseFloat(String(td.textContent || "").replace(",", ".")) || 0;
        td.classList.remove("stock-neg", "stock-norm", "venta-cero");
        if (val < 0) {
          td.classList.add("stock-neg");
        } else {
          td.classList.add("stock-norm");
        }
      }
    });
  });
}

// ---------- TOGGLE SELECCIÓN ----------
function toggleSeleccionByIdAndRow(id, row, btnEl) {
  const idx = seleccionados.findIndex(s => {
    const sId = getFirstField(s, ["CODIGOS","codigos","codigo","cod","codigo_art"]);
    return normalizarClave(String(sId)) === normalizarClave(String(id));
  });

  if (idx === -1) {
    let codProv = prompt("Ingrese CÓDIGO del proveedor:");
    if (codProv === null || codProv.trim() === "") {
      alert("Debe ingresar un código de proveedor.");
      return;
    }
    codProv = codProv.trim();

    let precioDef = getFirstField(row, ["precios","precio","precio_vta"]) || "";
    let precioProv = prompt("Ingrese precio del proveedor:", precioDef);
    if (precioProv !== null) {
      precioProv = String(precioProv).trim();
      const copia = Object.assign({}, row);
      copia.codigoProveedor = codProv;
      copia.precioProveedor = precioProv;
      seleccionados.push(copia);
      btnEl.classList.add("agregado");
      btnEl.textContent = "✓ Agregado";
    }
  } else {
    seleccionados.splice(idx, 1);
    btnEl.classList.remove("agregado");
    btnEl.textContent = "Elegir";
  }

  localStorage.setItem("seleccionados", JSON.stringify(seleccionados));
}

// ---------- MODAL SELECCIONADOS ----------
btnMostrar && btnMostrar.addEventListener("click", mostrarModal);
btnCerrar && btnCerrar.addEventListener("click", () => modal.style.display = "none");
window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });

function mostrarModal() {
  listaSeleccion.innerHTML = "";
  modal.style.display = "flex";

  if (!seleccionados.length) {
    listaSeleccion.innerHTML = "<p>No hay productos seleccionados.</p>";
    return;
  }

  const firstSel = seleccionados[0] || {};
  const modalKeys = ["codigoProveedor"];

  Object.keys(firstSel).forEach(k => {
    if (!modalKeys.includes(k) && k !== "precioProveedor") modalKeys.push(k);
  });
  if (!modalKeys.includes("precioProveedor")) modalKeys.push("precioProveedor");
  modalKeys.push("Margen %");
  modalKeys.push("Eliminar");

  const tableM = document.createElement("table");
  tableM.className = "tabla-modal";
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  modalKeys.forEach(h => {
    const th = document.createElement("th");
    th.textContent = lookupAliasForColumn(h);
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  tableM.appendChild(thead);

  const tbody = document.createElement("tbody");
  seleccionados.forEach((p, index) => {
    const tr = document.createElement("tr");
    modalKeys.forEach(k => {
      if (k === "Margen %" || k === "Eliminar") return;
      const td = document.createElement("td");
      td.textContent = p[k] ?? "";
      tr.appendChild(td);
    });

    const tdMargen = document.createElement("td");
    const precioVenta = parseFloat(String(getFirstField(p, ["precios","precio","precio_vta"]) || 0).replace(",", ".")) || 0;
    const precioProv = parseFloat(String(p.precioProveedor || 0).replace(",", ".")) || 0;
    if (precioVenta > 0 && !isNaN(precioProv)) {
      tdMargen.textContent = (((precioVenta - precioProv) / precioProv) * 100).toFixed(2) + " %";
    } else {
      tdMargen.textContent = "";
    }
    tr.appendChild(tdMargen);

    const tdEliminar = document.createElement("td");
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.className = "btn-eliminar";
    btnEliminar.addEventListener("click", (ev) => {
      ev.stopPropagation();
      seleccionados.splice(index, 1);
      localStorage.setItem("seleccionados", JSON.stringify(seleccionados));
      tr.remove();
      if (seleccionados.length === 0) listaSeleccion.innerHTML = "<p>No hay productos seleccionados.</p>";
    });
    tdEliminar.appendChild(btnEliminar);
    tr.appendChild(tdEliminar);
    tbody.appendChild(tr);
  });
  tableM.appendChild(tbody);
  listaSeleccion.appendChild(tableM);
}

// ---------- EXPORTAR A EXCEL ----------
btnExportar && btnExportar.addEventListener("click", () => {
  if (!seleccionados.length) return alert("No hay productos para exportar.");

  const exportKeys = ["codigoProveedor"];
  for (const alias of ordenColumnas) {
    const key = resolveKeyForAlias(alias, seleccionados) || resolveKeyForAlias(alias, datosOriginales);
    if (key && !exportKeys.includes(key) && key !== "codigoProveedor") exportKeys.push(key);
  }
  Object.keys(seleccionados[0] || {}).forEach(k => {
    if (!exportKeys.includes(k) && k !== "precioProveedor" && k !== "codigoProveedor") exportKeys.push(k);
  });
  if (!exportKeys.includes("precioProveedor")) exportKeys.push("precioProveedor");
  exportKeys.push("Margen %");

  const exportData = seleccionados.map(p => {
    const obj = {};
    for (const k of exportKeys) {
      if (k === "Margen %") {
        const pv = parseFloat(String(getFirstField(p, ["precios","precio","precio_vta"]) || 0).replace(",", ".")) || 0;
        const pp = parseFloat(String(p.precioProveedor || 0).replace(",", ".")) || 0;
        obj["Margen %"] = (pv > 0 && !isNaN(pp)) ? ((pv - pp) / pp * 100).toFixed(2) + " %" : "";
      } else if (k === "precioProveedor") {
        const n = parseFloat(String(p.precioProveedor).replace(",", ".")) || 0;
        obj[lookupAliasForColumn(k)] = !isNaN(n)
          ? n.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
          : (p.precioProveedor ?? "");
      } else {
        obj[lookupAliasForColumn(k)] = p[k] ?? "";
      }
    }
    return obj;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  XLSX.writeFile(wb, "seleccion_productos.xlsx");
  alert("Archivo Excel generado correctamente.");
});

// ---------- BOTÓN VACIAR ----------
btnVaciar && btnVaciar.addEventListener("click", () => {
  if (!seleccionados.length) return alert("No hay productos para vaciar.");
  if (!confirm("¿Estás seguro que querés vaciar toda la selección?")) return;
  seleccionados = [];
  localStorage.setItem("seleccionados", JSON.stringify(seleccionados));
  listaSeleccion.innerHTML = "<p>No hay productos seleccionados.</p>";
});

// ---------- BUSCADOR ----------
const buscador = document.getElementById("buscador");
if (buscador) {
  buscador.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const term = normalizarClave(buscador.value);
      if (!term) {
        renderTabla(datosOriginales);
        return;
      }
      const palabras = term.split(/\s+/).filter(Boolean);
      const filtrados = datosOriginales.filter(item => {
        const codigo  = normalizarClave(getFirstField(item, ["CODIGOS","codigos","codigo","cod","codigo_art"]) || "");
        const producto = normalizarClave(getFirstField(item, ["PRODUCTOS","productos","producto","descripcion"]) || "");
        return palabras.every(p => codigo.includes(p) || producto.includes(p));
      });
      renderTabla(filtrados);
    }

    // ESC — limpiar búsqueda
    if (e.key === "Escape") {
      buscador.value = "";
      renderTabla(datosOriginales);
    }
  });
}

// ---------- FECHA ÚLTIMA ACTUALIZACIÓN + DETECCIÓN DE CAMBIOS ----------
let fechaCargaInicial = null;

fetch('precios.json')
  .then(r => r.headers.get('last-modified'))
  .then(fecha => {
    if (!fecha) return;
    fechaCargaInicial = fecha;
    const f = new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const el = document.getElementById('ultima-actualizacion');
    if (el) el.textContent = `Última actualización: ${f}`;
  })
  .catch(() => {});

// Chequea cada 2 minutos si el archivo cambió
setInterval(() => {
  fetch('precios.json', { method: 'HEAD', cache: 'no-store' })
    .then(r => {
      const nuevaFecha = r.headers.get('last-modified');
      if (nuevaFecha && fechaCargaInicial && nuevaFecha !== fechaCargaInicial) {
        mostrarToastActualizacion();
      }
    })
    .catch(() => {});
}, 2 * 60 * 1000);

function mostrarToastActualizacion() {
  // No mostrar si ya hay uno visible
  if (document.getElementById('toast-update')) return;

  const toast = document.createElement('div');
  toast.id = 'toast-update';
  toast.innerHTML = `
    <span>🔄 Hay una nueva actualización disponible</span>
    <button onclick="location.reload()">Actualizar ahora</button>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;padding:0 4px;opacity:0.6">✕</button>
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e2a1e;
    border: 1px solid #00e676;
    color: #f0f0f0;
    padding: 14px 20px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.9rem;
    box-shadow: 0 8px 32px rgba(0,230,118,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease;
    white-space: nowrap;
  `;

  // Botón "Actualizar ahora"
  const btn = toast.querySelector('button');
  btn.style.cssText = `
    background: #00e676;
    color: #0d0d0d;
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: 'DM Sans', sans-serif;
  `;

  // Animación
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
}