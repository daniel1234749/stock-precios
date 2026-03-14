console.log("🔥 precompra.js cargado");

let productos = [];
let precompra = [];
let pedidoConfirmado = false;

/* ======================================================
   UTILIDADES GENERALES
====================================================== */
function formatoPesos(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(valor);
}

function colorMargen(m) {
  if (m < 10) return "margen-rojo";
  if (m < 25) return "margen-amarillo";
  return "margen-verde";
}

function actualizarSemaforo(valor) {
  document.querySelector(".luz-roja")?.classList.toggle("encendida", valor < 10);
  document.querySelector(".luz-amarilla")?.classList.toggle(
    "encendida",
    valor >= 10 && valor <= 20
  );
  document.querySelector(".luz-verde")?.classList.toggle("encendida", valor > 20);
}

/* ======================================================
   PEDIDOS GUARDADOS – STORAGE
====================================================== */
function obtenerPedidos() {
  return JSON.parse(localStorage.getItem("pedidosPrecompra")) || [];
}

function guardarPedidos(pedidos) {
  localStorage.setItem("pedidosPrecompra", JSON.stringify(pedidos));
}

function generarNumeroPedido() {
  const pedidos = obtenerPedidos();
  return `PED-${String(pedidos.length + 1).padStart(4, "0")}`;
}

/* ======================================================
   DOM READY
====================================================== */
document.addEventListener("DOMContentLoaded", () => {

  const btnImprimir = document.getElementById("btnImprimir");
  btnImprimir.onclick = () => {
    if (!precompra.length) { alert("No hay productos para imprimir"); return; }
    const pedidoTemp = {
      id: "PED-ACTUAL",
      proveedor: "Pre-compra",
      fecha: new Date().toLocaleString("es-AR"),
      items: precompra,
      total: precompra.reduce((a, p) => a + p.costoTotal, 0)
    };
    localStorage.setItem("pedidoParaImprimir", JSON.stringify(pedidoTemp));
    window.open("print.html", "_blank");
  };

  const modalPedidos = document.getElementById("modalPedidos");
  const listaPedidos = document.getElementById("listaPedidos");
  const cerrarPedidos = document.getElementById("cerrarPedidos");
  cerrarPedidos.onclick = () => { modalPedidos.style.display = "none"; };

  const buscador        = document.getElementById("buscador");
  const modal           = document.getElementById("modalSeleccion");
  const listaModal      = document.getElementById("listaSeleccion");
  const detalleStock    = document.getElementById("detalleStock");
  const tablaBody       = document.getElementById("cuerpoPrecompra");
  const totalPedidoEl   = document.getElementById("totalPedido");
  const rentabilidadEl  = document.getElementById("rentabilidadPedido");

  const btnCerrar          = document.getElementById("btnCerrar");
  const btnVolver          = document.getElementById("btnVolver");
  const btnGuardarPedido   = document.getElementById("btnGuardarPedido");
  const btnPedidosGuardados= document.getElementById("btnPedidosGuardados");
  const btnVaciar          = document.getElementById("btnVaciar");

  btnVaciar.onclick = () => {
    if (pedidoConfirmado) { alert("Este pedido ya está confirmado.\nCreá un nuevo pedido para empezar de cero."); return; }
    if (!precompra.length) { alert("No hay productos para vaciar"); return; }
    if (!confirm("¿Seguro que querés vaciar la pre-compra actual?")) return;
    precompra = [];
    localStorage.removeItem("precompraEmanuel");
    renderTabla();
  };

  const btnNuevoPedido = document.getElementById("btnNuevoPedido");
  btnNuevoPedido.onclick = () => {
    if (precompra.length && !confirm("Se perderá la pre-compra actual. ¿Continuar?")) return;
    precompra = [];
    pedidoConfirmado = false;
    localStorage.removeItem("precompraEmanuel");
    renderTabla();
  };

  btnPedidosGuardados.onclick = () => {
    const pedidos = obtenerPedidos();
    if (!pedidos.length) { alert("No hay pedidos guardados"); return; }
    let texto = "📂 PEDIDOS GUARDADOS\n\n";
    pedidos.forEach((p, i) => {
      texto += `${i + 1}) ${p.id} | ${p.proveedor} | ${p.fecha} | ${formatoPesos(p.total)}\n`;
    });
    const opcion = prompt(texto + "\nEscribí el número del pedido a abrir:");
    const index = Number(opcion) - 1;
    if (isNaN(index) || !pedidos[index]) return;
    precompra = pedidos[index].items;
    localStorage.setItem("precompraEmanuel", JSON.stringify(precompra));
    renderTabla();
  };

  /* ===============================
     CARGA INICIAL
  =============================== */
  const guardado = localStorage.getItem("precompraEmanuel");
  if (guardado) { precompra = JSON.parse(guardado); renderTabla(); }

  fetch("precios.json?_=" + Date.now())
    .then(r => r.json())
    .then(data => { productos = data; console.log("✅ Productos cargados:", productos.length); });

  /* ===============================
     BUSCADOR
  =============================== */
  buscador.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = buscador.value.trim().toLowerCase();
    if (!term) return;
    const resultados = productos.filter(p =>
      String(p.codigos).includes(term) ||
      String(p.productos).toLowerCase().includes(term)
    );
    abrirModal(resultados);
  });

  /* ===============================
     MODAL RESULTADOS
  =============================== */
  function abrirModal(resultados) {
    listaModal.innerHTML = "";
    listaModal.style.display = "block";
    detalleStock.style.display = "none";

    if (!resultados.length) {
      listaModal.innerHTML = "<p>No se encontraron productos</p>";
      modal.style.display = "flex";
      return;
    }

    const tabla = document.createElement("table");
    tabla.className = "tabla-modal";
    tabla.innerHTML = `
      <thead>
        <tr>
          <th>Código</th>
          <th>Producto</th>
          <th>UXB</th>
          <th>Precio</th>
          <th>Agregar</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = tabla.querySelector("tbody");
    resultados.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="codigo-click">${p.codigos}</td>
        <td>${p.productos}</td>
        <td>${p.uxb ?? 1}</td>
        <td>${formatoPesos(p.precio_vta)}</td>
        <td><button>➕</button></td>
      `;
      tr.querySelector(".codigo-click").onclick = () => {
        listaModal.style.display = "none";
        detalleStock.style.display = "block";
        mostrarDetalleStock(p);
      };
      tr.querySelector("button").onclick = () => agregarProducto(p);
      tbody.appendChild(tr);
    });

    listaModal.appendChild(tabla);
    modal.style.display = "flex";
  }

  btnCerrar.onclick = () => (modal.style.display = "none");
  btnVolver.onclick = () => {
    detalleStock.style.display = "none";
    listaModal.style.display = "block";
    btnVolver.style.display = "none";
  };

  /* ===============================
     AGREGAR PRODUCTO
  =============================== */
  window.agregarProducto = function (producto) {
    const existente = precompra.find(p => p.codigos === producto.codigos);
    const cantidad = Number(prompt("Cantidad:", 1));
    if (!cantidad || cantidad <= 0) return;

    if (existente) {
      existente.cantidad += cantidad;
      existente.costoTotal = existente.cantidad * existente.uxb * existente.costoProveedor;
    } else {
      const costoProveedor = Number(prompt("Costo proveedor:"));
      if (!costoProveedor || costoProveedor <= 0) return;

      const uxb = producto.uxb ?? 1;
      const precioNuestro = producto.precio_vta;
      const costoTotal = costoProveedor * uxb * cantidad;
      const ventaTotal = precioNuestro * uxb * cantidad;
      const margen = ((ventaTotal - costoTotal) / ventaTotal) * 100;

      precompra.push({
        codigos: producto.codigos,
        productos: producto.productos,
        uxb,
        cantidad,
        costoProveedor,
        precioNuestro,
        costoTotal,
        margen
      });
    }

    localStorage.setItem("precompraEmanuel", JSON.stringify(precompra));
    renderTabla();
  };

  /* ===============================
     TABLA PRINCIPAL
  =============================== */
  function renderTabla() {
    tablaBody.innerHTML = "";
    let totalCosto = 0;
    let totalVenta = 0;

    precompra.forEach((p, i) => {
      totalCosto += p.costoTotal;
      totalVenta += p.precioNuestro * p.uxb * p.cantidad;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.codigos}</td>
        <td>${p.productos}</td>
        <td>${p.uxb}</td>
        <td>
          <div class="cantidad-control">
            <button onclick="cambiarCantidad(${i}, -1)">−</button>
            <span class="cantidad-editable">${p.cantidad}</span>
            <button onclick="cambiarCantidad(${i}, 1)">+</button>
          </div>
        </td>
        <td>${formatoPesos(p.costoProveedor)}</td>
        <td>${formatoPesos(p.precioNuestro)}</td>
        <td>${formatoPesos(p.costoTotal)}</td>
        <td class="${colorMargen(p.margen)}">${p.margen.toFixed(2)}%</td>
        <td><button onclick="eliminarProducto(${i})">❌</button></td>
      `;
      tablaBody.appendChild(tr);
    });

    totalPedidoEl.textContent = `Total pedido: ${formatoPesos(totalCosto)}`;
    const rent = totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta) * 100 : 0;
    rentabilidadEl.textContent = `Rentabilidad total: ${rent.toFixed(2)} %`;
    actualizarSemaforo(rent);
  }

  window.eliminarProducto = function (i) {
    precompra.splice(i, 1);
    localStorage.setItem("precompraEmanuel", JSON.stringify(precompra));
    renderTabla();
  };

  window.cambiarCantidad = function (index, delta) {
    const p = precompra[index];
    if (!p) return;
    const nueva = p.cantidad + delta;
    if (nueva <= 0) return;
    p.cantidad = nueva;
    p.costoTotal = p.cantidad * p.uxb * p.costoProveedor;
    localStorage.setItem("precompraEmanuel", JSON.stringify(precompra));
    renderTabla();
  };

  /* ===============================
     EXPORTAR EXCEL
  =============================== */
  const btnExcel = document.getElementById("btnExcel");
  btnExcel && (btnExcel.onclick = () => {
    if (!precompra.length) return alert("No hay productos para exportar.");

    const exportData = precompra.map(p => {
      const ventaTotal  = p.precioNuestro * p.uxb * p.cantidad;
      const costoTotal  = p.costoTotal;
      const margen      = ventaTotal > 0 ? ((ventaTotal - costoTotal) / ventaTotal * 100).toFixed(2) + " %" : "";
      return {
        "Código":          p.codigos,
        "Producto":        p.productos,
        "UXB":             p.uxb,
        "Cantidad (btos)": p.cantidad,
        "Costo Proveedor": p.costoProveedor,
        "Precio Nuestro":  p.precioNuestro,
        "Subtotal Costo":  p.costoTotal,
        "Margen %":        margen
      };
    });

    // Fila de totales
    const totalCosto = precompra.reduce((a, p) => a + p.costoTotal, 0);
    const totalVenta = precompra.reduce((a, p) => a + p.precioNuestro * p.uxb * p.cantidad, 0);
    const rentTotal  = totalVenta > 0 ? ((totalVenta - totalCosto) / totalVenta * 100).toFixed(2) + " %" : "";
    exportData.push({
      "Código":          "",
      "Producto":        "TOTALES",
      "UXB":             "",
      "Cantidad (btos)": "",
      "Costo Proveedor": "",
      "Precio Nuestro":  "",
      "Subtotal Costo":  totalCosto,
      "Margen %":        rentTotal
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ancho de columnas
    ws["!cols"] = [
      { wch: 10 }, { wch: 40 }, { wch: 6 }, { wch: 16 },
      { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 10 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Pre-compra");
    const fecha = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    XLSX.writeFile(wb, `precompra_${fecha}.xlsx`);
    alert("✅ Excel exportado correctamente.");
  });

  /* ===============================
     GUARDAR PEDIDO
  =============================== */
  btnGuardarPedido.onclick = () => {
    if (!precompra.length) return alert("No hay productos");
    const proveedor = prompt("Proveedor:");
    if (!proveedor) return;
    const pedidos = obtenerPedidos();
    const id = generarNumeroPedido();
    const total = precompra.reduce((a, p) => a + p.costoTotal, 0);
    pedidos.push({
      id,
      proveedor,
      fecha: new Date().toLocaleString("es-AR"),
      items: JSON.parse(JSON.stringify(precompra)),
      total
    });
    guardarPedidos(pedidos);
    pedidoConfirmado = true;
    alert(`✅ Pedido ${id} guardado`);
    precompra = [];
    localStorage.removeItem("precompraEmanuel");
    renderTabla();
  };
});

function verPedido(index) {
  const pedidos = obtenerPedidos();
  if (!pedidos[index]) return;
  precompra = pedidos[index].items;
  pedidoConfirmado = true;
  localStorage.setItem("precompraEmanuel", JSON.stringify(precompra));
  renderTabla();
}

function eliminarPedido(index) {
  if (!confirm("¿Eliminar este pedido?")) return;
  const pedidos = obtenerPedidos();
  pedidos.splice(index, 1);
  guardarPedidos(pedidos);
  alert("Pedido eliminado");
  location.reload();
}

/* ======================================================
   DETALLE STOCK — con código, encabezados y formato bultos
====================================================== */
function mostrarDetalleStock(p) {
  const contenedor = document.getElementById("detalleStock");
  if (!contenedor) return;

  const num  = v => Number(v ?? 0);
  const uxb  = num(p.uxb) || 1;
  const fmt  = v => `${v} btos x ${uxb}u`;

  // Semáforo stock: rojo si stock <= 0, amarillo si stock <= ventas, verde si ok
  const clase = (s, v) =>
    s <= 0     ? "stock-bajo"  :
    s <= v     ? "stock-medio" : "stock-alto";

  // Días de stock restantes
  const dias = (stock, ventas30) => {
    if (stock <= 0) return { txt: "Sin stock", cls: "dias-critico" };
    if (ventas30 <= 0) return { txt: "Sin ventas", cls: "dias-ok" };
    const d = Math.round((stock / ventas30) * 30);
    const cls = d < 15 ? "dias-critico" : d < 30 ? "dias-alerta" : "dias-ok";
    return { txt: d + " días", cls };
  };

  const fs = num(p.fair_stock),    fv = num(p.fair_ventas);
  const bs = num(p.burzaco_stock), bv = num(p.burzaco_ventas);
  const as = num(p.a_korn_stock),  av = num(p.a_korn_ventas);
  const ts = num(p.tucuman_stock), tv = num(p.tucuman_ventas);

  const df = dias(fs, fv), db = dias(bs, bv), da = dias(as, av), dt = dias(ts, tv);

  contenedor.innerHTML = `
    <div class="card-detalle">
      <p class="cod-detalle" style="font-family:monospace;color:#00e676;font-size:0.85rem;margin-bottom:4px">
        COD ${p.codigos}
      </p>
      <h3 class="titulo-producto">${p.productos}</h3>
      <table class="tabla-modal tabla-stock">
        <thead>
          <tr>
            <th style="text-align:center">Sucursal</th>
            <th style="text-align:center">Stock</th>
            <th style="text-align:center">Ventas <span style="font-size:0.7rem;color:#aaa;font-weight:400">(últ. 30 días)</span></th>
            <th style="text-align:center">Días stock</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center">Fair</td>
            <td style="text-align:center" class="${clase(fs,fv)}">${fmt(fs)}</td>
            <td style="text-align:center">${fmt(fv)}</td>
            <td style="text-align:center" class="${df.cls}">${df.txt}</td>
          </tr>
          <tr>
            <td style="text-align:center">Burzaco</td>
            <td style="text-align:center" class="${clase(bs,bv)}">${fmt(bs)}</td>
            <td style="text-align:center">${fmt(bv)}</td>
            <td style="text-align:center" class="${db.cls}">${db.txt}</td>
          </tr>
          <tr>
            <td style="text-align:center">A. Korn</td>
            <td style="text-align:center" class="${clase(as,av)}">${fmt(as)}</td>
            <td style="text-align:center">${fmt(av)}</td>
            <td style="text-align:center" class="${da.cls}">${da.txt}</td>
          </tr>
          <tr>
            <td style="text-align:center">Tucumán</td>
            <td style="text-align:center" class="${clase(ts,tv)}">${fmt(ts)}</td>
            <td style="text-align:center">${fmt(tv)}</td>
            <td style="text-align:center" class="${dt.cls}">${dt.txt}</td>
          </tr>
          <tr style="border-top:2px solid #00e67655; font-weight:700">
            <td style="text-align:center;color:#ffd600">Total</td>
            <td style="text-align:center;color:#ffd600">${fmt((fs+bs+as+ts).toFixed(2))}</td>
            <td style="text-align:center;color:#ffd600">${fmt((fv+bv+av+tv).toFixed(2))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button class="btn-agregar-detalle" onclick="agregarProducto(${JSON.stringify(p).replace(/"/g, '&quot;')})">
        ➕ Agregar producto
      </button>
    </div>
  `;
}

function imprimirPedido(index) {
  const pedidos = obtenerPedidos();
  const pedido = pedidos[index];
  if (!pedido) return alert("Pedido no encontrado");
  localStorage.setItem("pedidoParaImprimir", JSON.stringify(pedido));
  window.open("print.html", "_blank");
}