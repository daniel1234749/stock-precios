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

// Recalcular campos calculados que no se guardan en localStorage
function recalcularCampos(items) {
  items.forEach(p => {
    const vtas = ["vtafair","vtaburza","vtakorn","vtatucu"]
      .map(a => resolveKeyForAlias(a, items))
      .filter(Boolean);
    let tv = 0;
    vtas.forEach(col => { tv += parseFloat(p[col]) || 0; });
    p.totalVentas = parseFloat(tv.toFixed(1));

    const stocks = ["fair","burza","korn","tucu","cdistrib"]
      .map(a => resolveKeyForAlias(a, items))
      .filter(Boolean);
    let st = 0;
    stocks.forEach(col => { st += parseFloat(p[col]) || 0; });
    p.stockTotal = parseFloat(st.toFixed(1));
  });
}
if (seleccionados.length) recalcularCampos(seleccionados);

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

  // Excluir campos calculados que solo van en modal/Excel
  const camposExcluidos = ["stockTotal", "totalVentas", "codigoProveedor", "precioProveedor"];
  todasClaves.forEach(k => {
    if (!columnasReales.includes(k) && !camposExcluidos.includes(k) && k !== "stockTotal") columnasReales.push(k);
  });
  // Eliminar stockTotal si por alguna razón entró
  const idxST = columnasReales.indexOf("stockTotal");
  if (idxST !== -1) columnasReales.splice(idxST, 1);

  // Encabezado
  const trHead = document.createElement("tr");
  const colSepFair    = resolveKeyForAlias("fair",    data);
  const colSepVtafair = resolveKeyForAlias("vtafair", data);
  const colSepPrecios = resolveKeyForAlias("precios", data);
  const colId1        = resolveKeyForAlias("cod",      data);
  const colId2        = resolveKeyForAlias("productos", data);
  columnasReales.forEach(colKey => {
    const th = document.createElement("th");
    if (colSepFair    && colKey === colSepFair)    th.classList.add("col-sep");
    if (colSepVtafair && colKey === colSepVtafair) th.classList.add("col-sep");
    if (colSepPrecios && colKey === colSepPrecios) th.classList.add("col-sep");
    if ((colId1 && colKey === colId1) || (colId2 && colKey === colId2)) th.classList.add("col-id");
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

  const columnasStock = ["fair", "burza", "korn", "tucu", "cdistrib"];
  const columnasStockReales = columnasStock.map(a => resolveKeyForAlias(a, data)).filter(Boolean);

  data.forEach(item => {
    let totalVentas = 0;
    columnasVentasReales.forEach(col => { totalVentas += parseFloat(item[col]) || 0; });
    item.totalVentas = parseFloat(totalVentas.toFixed(1));

    let stockTotal = 0;
    columnasStockReales.forEach(col => { stockTotal += parseFloat(item[col]) || 0; });
    item.stockTotal = parseFloat(stockTotal.toFixed(1));
  });
  data.sort((a, b) => b.totalVentas - a.totalVentas);

  // ── Badge de productos críticos en botón Pre-compra ──
  const DIAS_CRITICO = 15;
  let criticos = 0;
  data.forEach(item => {
    const sucursales = [
      { s: parseFloat(item.fair_stock    ?? 0), v: parseFloat(item.fair_ventas    ?? 0) },
      { s: parseFloat(item.burzaco_stock ?? 0), v: parseFloat(item.burzaco_ventas ?? 0) },
      { s: parseFloat(item.a_korn_stock  ?? 0), v: parseFloat(item.a_korn_ventas  ?? 0) },
      { s: parseFloat(item.tucuman_stock ?? 0), v: parseFloat(item.tucuman_ventas ?? 0) },
    ];
    const esCritico = sucursales.some(({ s, v }) => v > 0 && (s / v) * 30 < DIAS_CRITICO);
    if (esCritico) criticos++;
  });
  const btnPre = document.getElementById("btnPrecompra");
  if (btnPre) {
    let badge = btnPre.querySelector(".badge-critico");
    if (criticos > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge-critico";
        btnPre.appendChild(badge);
      }
      badge.textContent = criticos;
      btnPre.title = `${criticos} productos con menos de ${DIAS_CRITICO} días de stock`;
    } else if (badge) {
      badge.remove();
    }
  }

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
      // Asegurar campos calculados en la copia
      recalcularCampos([copia]);
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

  // Orden fijo de columnas en modal
  const modalKeys = ["codigoProveedor"];
  const ORDEN_MODAL = [
    "codigos", "productos", "uxb",
    "vtafair", "vtaburza", "vtakorn", "vtatucu",
    "totalVentas",
    "fair", "burza", "korn", "tucu",
    "cdistrib", "stockTotal", "precios"
  ];
  ORDEN_MODAL.forEach(alias => {
    const key = resolveKeyForAlias(alias, seleccionados) || resolveKeyForAlias(alias, datosOriginales);
    if (key && !modalKeys.includes(key)) modalKeys.push(key);
    // totalVentas es campo calculado, no viene de resolveKeyForAlias
    if (alias === "totalVentas" && !modalKeys.includes("totalVentas")) modalKeys.push("totalVentas");
    if (alias === "stockTotal" && !modalKeys.includes("stockTotal")) modalKeys.push("stockTotal");
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

  const ORDEN_EXPORT = [
    "codigos", "productos", "uxb",
    "vtafair", "vtaburza", "vtakorn", "vtatucu",
    "totalVentas",
    "fair", "burza", "korn", "tucu",
    "cdistrib", "stockTotal", "precios"
  ];
  const exportKeys = ["codigoProveedor"];
  ORDEN_EXPORT.forEach(alias => {
    const key = resolveKeyForAlias(alias, seleccionados) || resolveKeyForAlias(alias, datosOriginales);
    if (key && !exportKeys.includes(key)) exportKeys.push(key);
    if (alias === "totalVentas" && !exportKeys.includes("totalVentas")) exportKeys.push("totalVentas");
    if (alias === "stockTotal" && !exportKeys.includes("stockTotal")) exportKeys.push("stockTotal");
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
      } else if (k === resolveKeyForAlias("precios", seleccionados) || k === resolveKeyForAlias("precios", datosOriginales)) {
        // Columna precios con formato moneda ARS
        const n = parseFloat(String(p[k] || 0).replace(",", ".")) || 0;
        obj[lookupAliasForColumn(k)] = !isNaN(n) && n > 0
          ? n.toLocaleString("es-AR", { style: "currency", currency: "ARS" })
          : (p[k] ?? "");
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

// ============================================================
//  EXPORTAR EXCEL CON FORMATO — ExcelJS
// ============================================================
async function exportarExcelFormato() {
  if (!seleccionados.length) return alert("No hay productos para exportar.");

  // Cargar ExcelJS dinámicamente
  if (!window.ExcelJS) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Productos seleccionados");

  // ── Columnas ──────────────────────────────────────────────
  const ORDEN = [
    "codigoProveedor", "codigos", "productos", "uxb",
    "vtafair", "vtaburza", "vtakorn", "vtatucu", "totalVentas",
    "fair", "burza", "korn", "tucu", "cdistrib", "stockTotal",
    "precios", "precioProveedor", "Margen %"
  ];

  const LABELS = {
    codigoProveedor: "Cod.Prov",
    codigos:         "Cod",
    productos:       "Producto",
    uxb:             "UXB",
    vtafair:         "Vta.Fair",
    vtaburza:        "Vta.Burza",
    vtakorn:         "Vta.Korn",
    vtatucu:         "Vta.Tucu",
    totalVentas:     "Tot.Vtas",
    fair:            "Fair",
    burza:           "Burza",
    korn:            "Korn",
    tucu:            "Tucu",
    cdistrib:        "Cdistrib",
    stockTotal:      "St.Total",
    precios:         "Precio",
    precioProveedor: "Precio.Prov",
    "Margen %":      "Margen %"
  };

  // Columnas ventas y stock para colorear
  const COL_VENTAS  = ["vtafair","vtaburza","vtakorn","vtatucu","totalVentas"];
  const COL_STOCK   = ["fair","burza","korn","tucu","cdistrib","stockTotal"];
  const COL_PRECIO  = ["precios","precioProveedor"];

  // Resolver keys reales
  const resolveKey = alias => {
    if (alias === "codigoProveedor" || alias === "precioProveedor" ||
        alias === "totalVentas" || alias === "stockTotal" || alias === "Margen %") return alias;
    return resolveKeyForAlias(alias, seleccionados) || resolveKeyForAlias(alias, datosOriginales) || alias;
  };

  const cols = ORDEN.map(a => ({ alias: a, key: resolveKey(a) }));

  // ── Anchos de columna ─────────────────────────────────────
  ws.columns = cols.map(({ alias }) => ({
    width: alias === "productos" ? 40 : alias === "Margen %" ? 12 : 11
  }));

  // ── Encabezado ────────────────────────────────────────────
  const headerRow = ws.addRow(cols.map(({ alias }) => LABELS[alias] || alias));
  headerRow.height = 20;
  headerRow.eachCell(cell => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D0D0D" } };
    cell.font   = { bold: true, color: { argb: "FF00E676" }, name: "Courier New", size: 9 };
    cell.border = { bottom: { style: "medium", color: { argb: "FF00E676" } } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  // Producto alineado a la izquierda
  headerRow.getCell(3).alignment = { horizontal: "left" };

  // ── Acumuladores para totales ─────────────────────────────
  const totales = {};
  cols.forEach(({ alias }) => { totales[alias] = 0; });

  // ── Filas de datos ────────────────────────────────────────
  seleccionados.forEach((p, idx) => {
    const rowData = cols.map(({ alias, key }) => {
      if (alias === "Margen %") {
        const pv = parseFloat(String(getFirstField(p, ["precios","precio","precio_vta"]) || 0).replace(",",".")) || 0;
        const pp = parseFloat(String(p.precioProveedor || 0).replace(",",".")) || 0;
        return (pv > 0 && pp > 0) ? parseFloat(((pv - pp) / pp * 100).toFixed(2)) : "";
      }
      const v = p[key] ?? "";
      const n = parseFloat(String(v).replace(",","."));
      return isNaN(n) ? v : n;
    });

    const row = ws.addRow(rowData);
    row.height = 16;

    // Fondo alternado muy sutil
    const bgBase = idx % 2 === 0 ? "FF161616" : "FF1A1A1A";

    cols.forEach(({ alias, key }, ci) => {
      const cell = row.getCell(ci + 1);
      const val  = rowData[ci];

      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: bgBase } };
      cell.font      = { name: "Courier New", size: 9, color: { argb: "FFF0F0F0" } };
      cell.alignment = { vertical: "middle", horizontal: ci <= 2 ? "left" : "center" };
      cell.border    = { bottom: { style: "thin", color: { argb: "FF2A2A2A" } } };

      // Colores ventas
      if (COL_VENTAS.includes(alias) && typeof val === "number") {
        cell.font = { ...cell.font, color: { argb: val === 0 ? "FFFF1744" : "FF00E676" }, bold: val === 0 };
        totales[alias] = (totales[alias] || 0) + val;
      }
      // Colores stock
      else if (COL_STOCK.includes(alias) && typeof val === "number") {
        if (val < 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF1744" } };
          cell.font = { ...cell.font, color: { argb: "FFFFFFFF" }, bold: true };
        } else {
          cell.font = { ...cell.font, color: { argb: "FF00E676" } };
        }
        totales[alias] = (totales[alias] || 0) + val;
      }
      // Precio formateado
      else if (COL_PRECIO.includes(alias) && typeof val === "number") {
        cell.numFmt = '"$"#,##0.00';
        cell.font   = { ...cell.font, color: { argb: "FF38BDF8" } };
        if (alias === "precios") totales[alias] = (totales[alias] || 0) + val;
      }
      // Margen %
      else if (alias === "Margen %" && typeof val === "number") {
        cell.numFmt = '0.00"%"';
        cell.font   = { ...cell.font, color: { argb: val < 15 ? "FFFF1744" : val < 25 ? "FFFFD600" : "FF00E676" } };
      }
    });
  });

  // ── Fila de totales ───────────────────────────────────────
  const totRow = ws.addRow(cols.map(({ alias }, i) => {
    if (i === 0) return "TOTALES";
    if (i === 1 || i === 2 || i === 3) return "";
    return totales[alias] ? parseFloat(totales[alias].toFixed(2)) : "";
  }));
  totRow.height = 18;
  totRow.eachCell((cell, ci) => {
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A00" } };
    cell.font      = { bold: true, name: "Courier New", size: 9, color: { argb: "FFFFD600" } };
    cell.border    = { top: { style: "medium", color: { argb: "FFFFD600" } } };
    cell.alignment = { vertical: "middle", horizontal: ci <= 3 ? "left" : "center" };
    // Precio con formato
    const alias = cols[ci - 1]?.alias;
    if (COL_PRECIO.includes(alias)) cell.numFmt = '"$"#,##0.00';
  });

  // ── Descargar ─────────────────────────────────────────────
  const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g,"-");
  const buf   = await wb.xlsx.writeBuffer();
  const blob  = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement("a");
  a.href      = url;
  a.download  = `seleccion_formato_${fecha}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// Listener del botón
document.addEventListener("DOMContentLoaded", () => {
  const btnFmt = document.getElementById("btnExportarFmt");
  if (btnFmt) btnFmt.addEventListener("click", exportarExcelFormato);
});

// ============================================================
//  INFORME HTML — Para compartir por email/WhatsApp
// ============================================================
async function generarInformeHTML() {
  if (!seleccionados.length) return alert("No hay productos para exportar.");

  const fecha     = new Date().toLocaleString("es-AR", { dateStyle:"full", timeStyle:"short" });
  const fechaFN   = new Date().toLocaleDateString("es-AR").replace(/\//g,"-");
  const total     = seleccionados.length;

  // ── Columnas a mostrar ──────────────────────────────────
  const COLS = [
    { alias: "codigos",        label: "Cód",        tipo: "id"     },
    { alias: "productos",      label: "Producto",   tipo: "texto"  },
    { alias: "uxb",            label: "UXB",        tipo: "num"    },
    { alias: "vtafair",        label: "Vta.Fair",   tipo: "venta"  },
    { alias: "vtaburza",       label: "Vta.Burza",  tipo: "venta"  },
    { alias: "vtakorn",        label: "Vta.Korn",   tipo: "venta"  },
    { alias: "vtatucu",        label: "Vta.Tucu",   tipo: "venta"  },
    { alias: "totalVentas",    label: "Tot.Vtas",   tipo: "venta-total" },
    { alias: "fair",           label: "Fair",       tipo: "stock"  },
    { alias: "burza",          label: "Burza",      tipo: "stock"  },
    { alias: "korn",           label: "Korn",       tipo: "stock"  },
    { alias: "tucu",           label: "Tucu",       tipo: "stock"  },
    { alias: "cdistrib",       label: "Cdistrib",   tipo: "stock"  },
    { alias: "stockTotal",     label: "St.Total",   tipo: "stock-total" },
    { alias: "precios",        label: "Precio",     tipo: "precio" },
    { alias: "precioProveedor",label: "P.Prov",     tipo: "precio" },
    { alias: "Margen %",       label: "Margen %",   tipo: "margen" },
  ];

  const resolveK = alias => {
    if (["totalVentas","stockTotal","codigoProveedor","precioProveedor"].includes(alias)) return alias;
    return resolveKeyForAlias(alias, seleccionados) || resolveKeyForAlias(alias, datosOriginales) || alias;
  };

  const cols = COLS.map(c => ({ ...c, key: resolveK(c.alias) }));

  // ── Calcular totales ────────────────────────────────────
  const totales = {};
  cols.forEach(c => { totales[c.alias] = 0; });
  seleccionados.forEach(p => {
    cols.forEach(c => {
      if (["venta","venta-total","stock","stock-total"].includes(c.tipo)) {
        const v = parseFloat(String(p[c.key] ?? 0).replace(",",".")) || 0;
        totales[c.alias] = (totales[c.alias] || 0) + v;
      }
    });
  });

  // ── Helpers ─────────────────────────────────────────────
  const fmtN = v => {
    const n = parseFloat(String(v ?? 0).replace(",","."));
    if (isNaN(n)) return v ?? "";
    return n.toLocaleString("es-AR", { minimumFractionDigits:1, maximumFractionDigits:1 });
  };
  const fmtP = v => {
    const n = parseFloat(String(v ?? 0).replace(",","."));
    return isNaN(n) ? v : n.toLocaleString("es-AR", { style:"currency", currency:"ARS" });
  };

  const cellColor = (v, tipo) => {
    const n = parseFloat(String(v ?? 0).replace(",","."));
    if (tipo === "venta") return n === 0 ? "color:#dc2626;font-weight:700" : "color:#16a34a;font-weight:600";
    if (tipo === "venta-total") {
      const base = n === 0 ? "color:#dc2626;font-weight:800" : "color:#1d4ed8;font-weight:800";
      return base + ";background:#eff6ff;border-left:2px solid #3b82f6;border-right:2px solid #3b82f6";
    }
    if (tipo === "stock") {
      if (n < 0)  return "color:#fff;background:#dc2626;font-weight:700";
      if (n === 0) return "color:#dc2626";
      return "color:#16a34a;font-weight:600";
    }
    if (tipo === "stock-total") {
      if (n < 0)  return "color:#fff;background:#dc2626;font-weight:800;border-left:2px solid #16a34a;border-right:2px solid #16a34a";
      return "color:#15803d;font-weight:800;background:#f0fdf4;border-left:2px solid #16a34a;border-right:2px solid #16a34a";
    }
    if (tipo === "margen") {
      if (n < 15) return "color:#dc2626;font-weight:700";
      if (n < 25) return "color:#d97706;font-weight:700";
      return "color:#16a34a;font-weight:700";
    }
    return "";
  };

  // ── Filas ───────────────────────────────────────────────
  const filas = seleccionados.map((p, idx) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
    const tds = cols.map(c => {
      const v = p[c.key] ?? "";
      let txt = "", style = `padding:8px 10px;font-size:13px;text-align:center;border-bottom:1px solid #e2e8f0;`;
      if (c.tipo === "texto") {
        txt = v;
        style += "text-align:left;font-weight:600;color:#0f172a;min-width:180px;";
      } else if (c.tipo === "id") {
        txt = v;
        style += "font-family:monospace;color:#0369a1;font-weight:700;text-align:left;";
      } else if (c.tipo === "precio") {
        txt = fmtP(v);
        style += "color:#7c3aed;font-weight:700;";
      } else if (c.tipo === "margen") {
        const pv = parseFloat(String(getFirstField(p, ["precios","precio","precio_vta"]) || 0).replace(",",".")) || 0;
        const pp = parseFloat(String(p.precioProveedor || 0).replace(",",".")) || 0;
        const mg = (pv > 0 && pp > 0) ? ((pv - pp) / pp * 100) : null;
        txt = mg !== null ? mg.toFixed(1) + "%" : "—";
        style += cellColor(mg ?? 0, "margen");
      } else {
        txt = fmtN(v);
        style += cellColor(v, c.tipo);
      }
      return `<td style="${style}">${txt}</td>`;
    }).join("");
    return `<tr style="background:${bg}">${tds}</tr>`;
  }).join("");

  // ── Fila totales ────────────────────────────────────────
  const tdsTotales = cols.map((c, i) => {
    let txt = "", style = "padding:9px 10px;font-size:13px;font-weight:800;text-align:center;background:#0f172a;color:#fbbf24;border-top:2px solid #fbbf24;";
    if (i === 0) { txt = "TOTALES"; style += "text-align:left;"; }
    else if (c.tipo === "texto" || c.tipo === "num") { txt = ""; }
    else if (c.tipo === "venta") {
      txt = fmtN(totales[c.alias]);
    } else if (c.tipo === "venta-total") {
      txt = fmtN(totales[c.alias]);
      style += "background:#1e3a5f;color:#60a5fa;border-left:2px solid #3b82f6;border-right:2px solid #3b82f6;font-size:15px;";
    } else if (c.tipo === "stock") {
      txt = fmtN(totales[c.alias]);
    } else if (c.tipo === "stock-total") {
      txt = fmtN(totales[c.alias]);
      style += "background:#14532d;color:#4ade80;border-left:2px solid #16a34a;border-right:2px solid #16a34a;font-size:15px;";
    } else if (c.tipo === "precio" || c.tipo === "margen") {
      txt = "";
    }
    return `<td style="${style}">${txt}</td>`;
  }).join("");

  // ── Encabezado grupos ───────────────────────────────────
  const thVentas = cols.filter(c => ["venta","venta-total"].includes(c.tipo)).length;
  const thStock  = cols.filter(c => ["stock","stock-total"].includes(c.tipo)).length;
  const thOtros  = cols.filter(c => !["venta","venta-total","stock","stock-total","precio","margen"].includes(c.tipo)).length;
  const thPrecio = cols.filter(c => c.tipo === "precio").length;
  const thMargen = cols.filter(c => c.tipo === "margen").length;

  const grupoRow = `<tr>
    <th colspan="${thOtros}" style="padding:6px;background:#1e293b;border:none"></th>
    <th colspan="${thVentas}" style="padding:6px;background:#1e293b;color:#60a5fa;font-size:11px;letter-spacing:.08em;text-align:center;border-bottom:2px solid #3b82f6">VENTAS (últ. 30 días)</th>
    <th colspan="${thStock}"  style="padding:6px;background:#1e293b;color:#4ade80;font-size:11px;letter-spacing:.08em;text-align:center;border-bottom:2px solid #16a34a">STOCK</th>
    <th colspan="${thPrecio}" style="padding:6px;background:#1e293b;color:#c084fc;font-size:11px;letter-spacing:.08em;text-align:center;border-bottom:2px solid #a855f7">PRECIOS</th>
    <th colspan="${thMargen}" style="padding:6px;background:#1e293b;color:#fbbf24;font-size:11px;letter-spacing:.08em;text-align:center;border-bottom:2px solid #f59e0b">MARGEN</th>
  </tr>`;

  const subRow = cols.map(c => {
    const bg = ["venta","venta-total"].includes(c.tipo) ? "#eff6ff"
             : ["stock","stock-total"].includes(c.tipo) ? "#f0fdf4"
             : c.tipo === "precio" ? "#faf5ff"
             : c.tipo === "margen" ? "#fffbeb"
             : "#f8fafc";
    const color = ["venta","venta-total"].includes(c.tipo) ? "#1d4ed8"
                : ["stock","stock-total"].includes(c.tipo) ? "#15803d"
                : c.tipo === "precio" ? "#7c3aed"
                : c.tipo === "margen" ? "#b45309"
                : "#475569";
    return `<th style="padding:8px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${color};background:${bg};text-align:center;white-space:nowrap;border-bottom:2px solid #e2e8f0">${c.label}</th>`;
  }).join("");

  // ── HTML completo ───────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Informe Stock &amp; Ventas — ${fechaFN}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:16px}
  .wrap{max-width:100%;margin:0 auto}
  .header{background:#0f172a;color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
  .header h1{font-size:20px;font-weight:800;letter-spacing:-.02em}
  .header h1 span{color:#22d07a}
  .header p{font-size:11px;color:#94a3b8;margin-top:4px}
  .badge{background:#1e293b;color:#22d07a;border:1px solid #22d07a44;border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700}
  .fecha{color:#64748b;font-size:10px;margin-top:4px;text-align:right}
  .table-wrap{overflow-x:auto;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.08)}
  table{border-collapse:collapse;width:100%;background:#fff;min-width:700px}
  .footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:16px}
  @media(max-width:600px){
    .header{padding:14px 16px}
    .header h1{font-size:16px}
    body{padding:8px}
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div>
      <h1>STOCK <span>&amp;</span> VENTAS</h1>
      <p>Mayorista Emanuel — Informe de productos seleccionados</p>
    </div>
    <div style="text-align:right">
      <div class="badge">${total} producto${total !== 1 ? "s" : ""}</div>
      <div class="fecha">${fecha}</div>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        ${grupoRow}
        <tr>${subRow}</tr>
      </thead>
      <tbody>
        ${filas}
        <tr>${tdsTotales}</tr>
      </tbody>
    </table>
  </div>
  <div class="footer">Informe generado automáticamente — Mayorista Emanuel — ${fecha}</div>
</div>
</body>
</html>`;

  // ── Descargar ───────────────────────────────────────────
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `informe_${fechaFN}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  const btnInf = document.getElementById("btnInforme");
  if (btnInf) btnInf.addEventListener("click", generarInformeHTML);
});