const pedido = JSON.parse(localStorage.getItem("pedidoParaImprimir"));

if (!pedido) {
  document.body.innerHTML = "<h2 style='font-family:monospace;padding:40px'>No hay pedido para imprimir</h2>";
  throw new Error("Sin pedido");
}

document.getElementById("infoPedido").innerHTML = `
  <strong>Pedido:</strong> ${pedido.id}<br>
  <strong>Proveedor:</strong> ${pedido.proveedor}<br>
  <strong>Fecha:</strong> ${pedido.fecha}
`;

const fmt = n => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

const tbody = document.getElementById("tablaPrint");
let total = 0;

pedido.items.forEach(p => {
  total += p.costoTotal;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${p.codigos}</td>
    <td style="text-align:left">${p.productos}</td>
    <td>${p.uxb}</td>
    <td>${p.cantidad}</td>
    <td>${fmt(p.costoProveedor)}</td>
    <td>${fmt(p.costoTotal)}</td>
  `;
  tbody.appendChild(tr);
});

document.getElementById("totalPrint").textContent = fmt(total);

window.print();