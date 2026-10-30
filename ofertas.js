/* ============================================================
   MAYORISTA EMANUEL — ofertas.js
   Consulta de ofertas de proveedores (datos que se cargan con el
   Comparador de Compras y se guardan en Supabase). Solo LEE.
   Es un módulo aparte: si Supabase no responde, el resto de la app
   sigue funcionando igual.
   ============================================================ */
(() => {
  // ---- Configuración (la misma del Comparador) ----
  const SUPABASE_URL = 'https://qrbxlbdbnetmtjabyfiv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_8WAWAPNQrBFZW6UFbZwytw_A76GKTeJ';   // sb_publishable_… (la pública, NO la secret)
  const SEMANAS_HISTORIAL = 12;                             // para "Vs. historial"
  // false = se ven sin usuario (requiere ofertas_sin_login.sql en Supabase). true = pide email y contraseña
  const PEDIR_LOGIN = false;

  let cliente = null;
  let datos = null;            // { filas, porCodigo, proveedores, cargado }
  let preciosVenta = null;     // código -> precio de venta (de precios.json de esta app)
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  let periodo = ['vigentes', 'semana', '4semanas'].includes(leer('ofx-periodo')) ? leer('ofx-periodo') : '4semanas';
  let ultimaBusqueda = '';

  const $o = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pesos = v => v == null || isNaN(v) ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
  const pct = v => v == null || isNaN(v) ? '—' : v.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' %';
  const dos = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const hoy = () => ymd(new Date());
  const fechaCorta = iso => { if (!iso) return '—'; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`; };
  const lunesDe = iso => { const d = new Date(iso); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
  const sumarDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const ddmm = s => s.slice(8, 10) + '/' + s.slice(5, 7);
  // Margen sobre el precio de venta, igual que en el Comparador
  const margen = (venta, costo) => venta && costo ? (venta - costo) / venta * 100 : null;
  const claseMargen = m => m == null ? '' : m < 10 ? 'ofx-rojo' : m < 25 ? 'ofx-amarillo' : 'ofx-verde';

  /* ---------- Interfaz ---------- */
  function crearInterfaz() {
    const botones = document.querySelector('.action-buttons');
    if (!botones || $o('#btnOfertas')) return;
    const b = document.createElement('button');
    b.id = 'btnOfertas'; b.type = 'button'; b.className = 'btn btn-ghost';
    b.innerHTML = '<span>💲</span> Ofertas';
    botones.insertBefore(b, botones.firstChild);
    b.addEventListener('click', abrir);

    const m = document.createElement('div');
    m.id = 'modalOfertas';
    m.innerHTML = `
      <div class="ofx-content" role="dialog" aria-labelledby="ofxTitulo">
        <div class="ofx-header">
          <div>
            <h2 id="ofxTitulo">💲 Ofertas de proveedores</h2>
            <p class="ofx-sub" id="ofxSub">Mejor oferta vigente de cada producto</p>
          </div>
          <button class="modal-close" id="ofxCerrar" title="Cerrar">✕</button>
        </div>
        <div class="ofx-body" id="ofxBody"></div>
      </div>`;
    document.body.appendChild(m);
    $o('#ofxCerrar').addEventListener('click', cerrar);
    m.addEventListener('click', e => { if (e.target === m) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('abierto')) cerrar(); });
  }

  function abrir() {
    $o('#modalOfertas').classList.add('abierto');
    document.body.style.overflow = 'hidden';
    iniciar();
  }
  function cerrar() {
    $o('#modalOfertas').classList.remove('abierto');
    document.body.style.overflow = '';
  }
  const cuerpo = html => { $o('#ofxBody').innerHTML = html; };
  const mensaje = (texto, clase = '') => cuerpo(`<div class="ofx-mensaje ${clase}">${texto}</div>`);

  /* ---------- Conexión ---------- */
  async function iniciar() {
    if (!window.supabase) return mensaje('No se pudo cargar la librería de Supabase (revisá la conexión a internet).', 'ofx-error');
    if (SUPABASE_KEY.startsWith('PEGAR')) return mensaje('Falta configurar la llave pública de Supabase en <b>ofertas.js</b>.', 'ofx-error');
    if (!cliente) {
      cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stock-ofertas-sesion' }
      });
    }
    if (PEDIR_LOGIN) {
      const { data } = await cliente.auth.getSession();
      if (!data.session) return pantallaLogin();
    }
    if (datos && Date.now() - datos.cargado < 5 * 60 * 1000) return pantallaLista();
    await cargarDatos();
  }

  function pantallaLogin(error = '') {
    cuerpo(`
      <form class="ofx-login" id="ofxLogin" autocomplete="on">
        <p>Para ver las ofertas, entrá con el usuario de consulta (se pide una sola vez en esta PC).</p>
        <label>Email<input name="email" type="email" required autocomplete="username"></label>
        <label>Contraseña<input name="clave" type="password" required autocomplete="current-password"></label>
        ${error ? `<p class="ofx-error">${esc(error)}</p>` : ''}
        <button class="btn btn-primary" type="submit">Entrar</button>
      </form>`);
    $o('#ofxLogin').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      f.querySelector('button').disabled = true;
      const { error } = await cliente.auth.signInWithPassword({ email: f.email.value.trim(), password: f.clave.value });
      if (error) return pantallaLogin(/invalid login/i.test(error.message) ? 'Email o contraseña incorrectos.'
        : /fetch|network/i.test(error.message) ? 'No hay conexión con la base de ofertas. Probá de nuevo en un rato.' : error.message);
      await cargarDatos();
    });
  }

  async function traerTodo(consulta) {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await consulta().range(desde, desde + 999);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return filas;
  }

  async function cargarPreciosVenta() {
    if (preciosVenta) return;
    preciosVenta = new Map();
    try {
      const r = await fetch('precios.json?_=' + Date.now());
      const lista = await r.json();
      for (const p of lista) if (p.codigos != null) preciosVenta.set(String(p.codigos), { venta: Number(p.precio_vta) || null, nombre: p.productos, uxb: p.uxb });
    } catch { /* sin precios.json: se usa el precio que tiene el Comparador */ }
  }

  async function cargarDatos() {
    mensaje('<span class="ofx-spinner"></span> Cargando ofertas…');
    try {
      const desde = sumarDias(lunesDe(new Date().toISOString()), -7 * SEMANAS_HISTORIAL);
      const [provs, ofertas] = await Promise.all([
        traerTodo(() => cliente.from('proveedores').select('clave,nombre').order('clave')),
        traerTodo(() => cliente.from('ofertas')
          .select('clave,codigo,proveedor_id,fecha,precio,costo_final,contado,vigencia_hasta,texto_proveedor')
          .gte('fecha', desde).order('clave')),
        cargarPreciosVenta()
      ]);
      // nombres de los productos con ofertas (de la lista del Comparador)
      const codigos = [...new Set(ofertas.map(o => o.codigo))];
      const productos = new Map();
      for (let i = 0; i < codigos.length; i += 300) {
        const { data, error } = await cliente.from('productos').select('clave,descripcion,precio_venta,familia').in('clave', codigos.slice(i, i + 300));
        if (error) throw error;
        for (const p of data) productos.set(p.clave, p);
      }
      datos = armar(ofertas, new Map(provs.map(p => [p.clave, p.nombre])), productos);
      pantallaLista();
    } catch (e) {
      if (PEDIR_LOGIN && /JWT|token|session/i.test(e.message || '')) { await cliente.auth.signOut(); return pantallaLogin('La sesión venció: volvé a entrar.'); }
      mensaje(`No se pudieron cargar las ofertas.<br><span class="ofx-chico">${esc(e.message || e)}</span><br><button class="btn btn-secondary" id="ofxReintentar">Reintentar</button>`, 'ofx-error');
      $o('#ofxReintentar')?.addEventListener('click', cargarDatos);
    }
  }

  /* ---------- Cálculos (mismos criterios que el Comparador) ---------- */
  const vigente = o => !o.vigencia_hasta || o.vigencia_hasta >= hoy();
  const porContado = (a, b) => (a.contado ?? a.costo) - (b.contado ?? b.costo);
  const NOMBRE_PERIODO = { vigentes: 'vigentes', semana: 'cargadas esta semana', '4semanas': 'de las últimas 4 semanas' };

  function armar(ofertas, proveedores, productos) {
    const porCodigo = new Map();
    for (const o of ofertas) {
      if (!proveedores.has(o.proveedor_id)) continue;
      o.proveedor = proveedores.get(o.proveedor_id);
      o.costo = o.costo_final ?? o.precio;
      if (!porCodigo.has(o.codigo)) porCodigo.set(o.codigo, []);
      porCodigo.get(o.codigo).push(o);
    }
    const filas = [];
    for (const [codigo, lista] of porCodigo) {
      // historial semanal (lunes a domingo): la última de cada proveedor en la semana
      const semanas = new Map();
      for (const o of lista) {
        const l = lunesDe(o.fecha);
        if (!semanas.has(l)) semanas.set(l, new Map());
        const s = semanas.get(l), p = s.get(o.proveedor_id);
        if (!p || o.fecha > p.fecha) s.set(o.proveedor_id, o);
      }
      const hist = [...semanas.entries()].sort((a, b) => b[0].localeCompare(a[0]))
        .map(([lunes, m]) => ({ lunes, porProv: m, min: [...m.values()].reduce((a, x) => !a || x.costo < a.costo ? x : a, null) }));
      const prod = productos.get(codigo) || {};
      const local = preciosVenta?.get(String(codigo));
      filas.push({
        codigo, nombre: local?.nombre || prod.descripcion || `Código ${codigo}`, familia: prod.familia || '',
        venta: local?.venta || prod.precio_venta || null, lista, hist,
        ultimaCarga: lista.reduce((a, o) => o.fecha > a ? o.fecha : a, '')
      });
    }
    filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return { filas, porCodigo: new Map(filas.map(f => [f.codigo, f])), cargado: Date.now() };
  }

  /* Igual que la vista "Por proveedor" del Comparador:
     vigentes = la última vigente de cada proveedor; semana / 4 semanas = la última de cada proveedor cargada en ese lapso */
  function ranking(f, per) {
    const desde = per === 'semana' ? lunesDe(new Date().toISOString()) : per === '4semanas' ? sumarDias(hoy(), -28) : null;
    const ultima = new Map();
    for (const o of f.lista) {
      if (per === 'vigentes' ? !vigente(o) : ymd(new Date(o.fecha)) < desde) continue;
      const p = ultima.get(o.proveedor_id);
      if (!p || o.fecha > p.fecha) ultima.set(o.proveedor_id, o);
    }
    return [...ultima.values()].sort(porContado);
  }

  function calcular(f) {
    const r = ranking(f, periodo);
    const mejor = r[0] || null;
    return { ...f, r, mejor, margen: mejor ? margen(f.venta, mejor.costo) : null,
      veredicto: mejor ? frenteAlHistorial(f.hist, lunesDe(new Date().toISOString()), mejor.costo) : null };
  }

  function frenteAlHistorial(hist, esta, costo) {
    const previas = hist.filter(s => s.lunes < esta).slice(0, SEMANAS_HISTORIAL);
    if (previas.length < 2 || !costo) return null;
    const mins = previas.map(s => s.min.costo).sort((a, b) => a - b);
    const n = mins.length;
    const habitual = n % 2 ? mins[(n - 1) / 2] : (mins[n / 2 - 1] + mins[n / 2]) / 2;
    const mejor = previas.reduce((a, s) => !a || s.min.costo < a.costo ? s.min : a, null);
    let clase, texto;
    if (costo <= mejor.costo + 0.5) { clase = 'record'; texto = 'Precio récord'; }
    else if (costo < habitual * 0.99) { clase = 'bueno'; texto = 'Bueno'; }
    else if (costo > habitual * 1.01) { clase = 'caro'; texto = 'Caro'; }
    else { clase = 'normal'; texto = 'Habitual'; }
    return { clase, texto, habitual, mejor, semanas: previas.length, vs: (costo - habitual) / habitual * 100 };
  }

  const etiqueta = v => v
    ? `<span class="ofx-pill ofx-${v.clase}" title="Mejor precio visto: ${esc(pesos(v.mejor.costo))} (${esc(v.mejor.proveedor)}, ${fechaCorta(v.mejor.fecha)}) · Habitual: ${esc(pesos(v.habitual))} · ${v.semanas} semanas">${v.texto}${v.clase !== 'record' ? ` ${v.vs > 0 ? '+' : ''}${pct(v.vs)}` : ''}</span>`
    : '<span class="ofx-tenue ofx-chico" title="Hacen falta al menos 2 semanas anteriores con precios">sin historial</span>';

  const hora = iso => { const d = new Date(iso); return `${dos(d.getHours())}:${dos(d.getMinutes())}`; };
  function tituloCelda(o, venta) {
    return [
      o.proveedor,
      `Cargado: ${fechaCorta(o.fecha)} ${hora(o.fecha)}`,
      o.vigencia_hasta ? `Vigente hasta: ${fechaCorta(o.vigencia_hasta)}${vigente(o) ? '' : ' (VENCIDA)'}` : '',
      `Como lo escribió: ${o.texto_proveedor || '—'}`,
      `Costo final: ${pesos(o.costo)}`,
      venta ? `Margen: ${pct(margen(venta, o.costo))}` : ''
    ].filter(Boolean).join('\n');
  }

  /* ---------- Pantallas ---------- */
  function pantallaLista() {
    const ultima = datos.filas.reduce((a, f) => f.ultimaCarga > a ? f.ultimaCarga : a, '');
    cuerpo(`
      <div class="ofx-barra">
        <div class="search-input-wrap ofx-buscar">
          <span class="search-icon">⌕</span>
          <input type="text" id="ofxBuscar" placeholder="Buscar por código o producto…" autocomplete="off">
        </div>
        <select id="ofxPeriodo" title="Qué ofertas mostrar">
          <option value="vigentes">Ofertas vigentes</option>
          <option value="semana">Cargadas esta semana</option>
          <option value="4semanas">Últimas 4 semanas</option>
        </select>
        <button class="btn btn-secondary" id="ofxActualizar" title="Volver a leer las ofertas">⟳ Actualizar</button>
        ${PEDIR_LOGIN ? '<button class="btn btn-ghost" id="ofxSalir" title="Cerrar sesión en esta PC">Salir</button>' : ''}
      </div>
      <div class="ofx-tabla-wrap ofx-matriz-wrap"><table class="ofx-tabla ofx-matriz" id="ofxTabla"></table></div>
      <p class="ofx-chico ofx-tenue">Cada columna es un proveedor con su <b>costo final</b> y la fecha en que se cargó. ★ verde = el más barato, rojo = el más caro, apagado = vencida. Pasá el mouse por un precio para ver hasta cuándo vale y cómo lo escribió el proveedor. Margen sobre tu precio de venta. Tocá un producto para ver su historial.</p>`);
    const buscar = $o('#ofxBuscar');
    $o('#ofxPeriodo').value = periodo;
    buscar.value = ultimaBusqueda;
    buscar.addEventListener('input', () => { ultimaBusqueda = buscar.value; pintarTabla(); });
    $o('#ofxPeriodo').addEventListener('change', e => { periodo = e.target.value; guardar('ofx-periodo', periodo); pintarTabla(); });
    $o('#ofxActualizar').addEventListener('click', cargarDatos);
    $o('#ofxSalir')?.addEventListener('click', async () => { await cliente.auth.signOut(); datos = null; pantallaLogin(); });
    $o('#ofxSub').dataset.ultima = ultima;
    pintarTabla();
    if (window.matchMedia('(min-width: 700px)').matches) buscar.focus();
  }

  function coincide(f, q) {
    if (!q) return true;
    if (String(f.codigo) === q) return true;
    const t = (f.nombre + ' ' + f.codigo).toLowerCase();
    return q.toLowerCase().split(/\s+/).every(p => t.includes(p));
  }

  function pintarTabla() {
    const q = ultimaBusqueda.trim();
    const todas = datos.filas.map(calcular).filter(f => f.mejor);
    const filas = todas.filter(f => coincide(f, q));
    const ultima = $o('#ofxSub').dataset.ultima;
    $o('#ofxSub').textContent = `${todas.length} productos con ofertas ${NOMBRE_PERIODO[periodo]} · última carga ${ultima ? fechaCorta(ultima) : '—'}`;
    const t = $o('#ofxTabla');
    if (!filas.length) { t.innerHTML = `<tbody><tr><td class="ofx-vacio">${q ? 'Ningún producto con ofertas coincide con la búsqueda.' : 'No hay ofertas en este período.'}</td></tr></tbody>`; return; }
    const visibles = filas.slice(0, 300);
    // columnas: los proveedores que aparecen en lo que se está mostrando
    const cols = [...new Set(visibles.flatMap(f => f.r.map(o => o.proveedor)))].sort((a, b) => a.localeCompare(b, 'es'));
    t.innerHTML = `
      <thead><tr>
        <th class="ofx-fijo1">Cód</th><th class="ofx-fijo2">Producto</th><th class="ofx-num ofx-col-venta">Venta</th>
        ${cols.map(p => `<th class="ofx-num ofx-th-prov">${esc(p)}</th>`).join('')}
        <th class="ofx-num" title="Margen de tu precio de venta contra el proveedor más barato">Margen vs mejor</th>
        <th title="El mejor precio comparado con las semanas anteriores">Vs. historial</th>
      </tr></thead>
      <tbody>${visibles.map(f => {
        const porProv = new Map(f.r.map(o => [o.proveedor, o]));
        const peor = f.r.length > 1 ? f.r[f.r.length - 1] : null;
        return `
        <tr data-codigo="${esc(f.codigo)}">
          <td class="codigo-click ofx-fijo1">${esc(f.codigo)}</td>
          <td class="ofx-prod ofx-fijo2">${esc(f.nombre)}</td>
          <td class="ofx-num ofx-col-venta">${pesos(f.venta)}</td>
          ${cols.map(p => {
            const o = porProv.get(p);
            if (!o) return '<td class="ofx-num ofx-celda ofx-tenue">—</td>';
            const esMejor = o === f.mejor && f.r.length > 1;
            const clase = esMejor ? 'ofx-mejor' : o === peor ? 'ofx-peor' : '';
            return `<td class="ofx-num ofx-celda ${clase} ${vigente(o) ? '' : 'ofx-vencida'}" title="${esc(tituloCelda(o, f.venta))}">${esMejor ? '★ ' : ''}${pesos(o.costo)}<span class="ofx-fecha">${fechaCorta(o.fecha)}</span></td>`;
          }).join('')}
          <td class="ofx-num"><span class="ofx-margen ${claseMargen(f.margen)}">${pct(f.margen)}</span></td>
          <td>${etiqueta(f.veredicto)}</td>
        </tr>`; }).join('')}
      </tbody>`;
    if (filas.length > 300) t.insertAdjacentHTML('beforeend', `<tbody><tr><td colspan="${cols.length + 5}" class="ofx-vacio">Mostrando 300 de ${filas.length}: buscá para achicar la lista.</td></tr></tbody>`);
    t.querySelectorAll('tr[data-codigo]').forEach(tr => tr.addEventListener('click', () => pantallaDetalle(tr.dataset.codigo)));
  }

  function pantallaDetalle(codigo) {
    const base = datos.porCodigo.get(codigo);
    if (!base) return;
    const f = calcular(base);
    const provs = [...new Set(f.hist.flatMap(s => [...s.porProv.values()].map(o => o.proveedor)))].sort((a, b) => a.localeCompare(b, 'es'));
    const esta = lunesDe(new Date().toISOString());
    const record = f.hist.length ? Math.min(...f.hist.map(s => s.min.costo)) : null;
    cuerpo(`
      <button class="btn btn-secondary ofx-volver" id="ofxVolver">⬅ Volver</button>
      <div class="card-detalle ofx-detalle">
        <p class="ofx-cod">COD ${esc(f.codigo)}</p>
        <h3 class="titulo-producto">${esc(f.nombre)}</h3>
        <div class="ofx-kpis">
          <div class="ofx-kpi"><span>Venta Emanuel</span><b>${pesos(f.venta)}</b></div>
          <div class="ofx-kpi"><span>Mejor oferta</span><b>${f.mejor ? pesos(f.mejor.costo) : '—'}</b><small>${f.mejor ? esc(f.mejor.proveedor) : ''}</small></div>
          <div class="ofx-kpi"><span>Margen</span><b class="${claseMargen(f.margen)}">${pct(f.margen)}</b></div>
          <div class="ofx-kpi"><span>Vs. historial</span><b>${etiqueta(f.veredicto)}</b>${f.veredicto ? `<small>habitual ${pesos(f.veredicto.habitual)}</small>` : ''}</div>
        </div>

        <h4 class="ofx-h4">Proveedores <span class="ofx-tenue ofx-chico">(ofertas ${NOMBRE_PERIODO[periodo]})</span></h4>
        <div class="ofx-tabla-wrap"><table class="ofx-tabla">
          <thead><tr><th>#</th><th>Proveedor</th><th class="ofx-num">Costo</th><th class="ofx-num">Margen</th><th>Cargada</th><th>Vence</th><th>Cómo lo escribió</th></tr></thead>
          <tbody>${f.r.length ? f.r.map((o, i) => `
            <tr class="${vigente(o) ? '' : 'ofx-vencida'}"><td>${i + 1}</td><td><b>${esc(o.proveedor)}</b></td>
              <td class="ofx-num ${i === 0 && f.r.length > 1 ? 'ofx-mejor' : ''}">${i === 0 && f.r.length > 1 ? '★ ' : ''}${pesos(o.costo)}</td>
              <td class="ofx-num ${claseMargen(margen(f.venta, o.costo))}">${pct(margen(f.venta, o.costo))}</td>
              <td class="ofx-chico">${fechaCorta(o.fecha)}</td><td class="ofx-chico">${o.vigencia_hasta ? fechaCorta(o.vigencia_hasta) + (vigente(o) ? '' : ' (vencida)') : '—'}</td>
              <td class="ofx-chico ofx-tenue">${esc(o.texto_proveedor || '')}</td></tr>`).join('')
            : '<tr><td colspan="7" class="ofx-vacio">Sin ofertas en este período</td></tr>'}</tbody>
        </table></div>

        <h4 class="ofx-h4">Historial por semana <span class="ofx-tenue ofx-chico">(últimas ${SEMANAS_HISTORIAL} · de la más reciente a la más vieja)</span></h4>
        <div class="ofx-tabla-wrap"><table class="ofx-tabla">
          <thead><tr><th>Semana</th>${provs.map(p => `<th class="ofx-num">${esc(p)}</th>`).join('')}<th class="ofx-num">Mejor</th></tr></thead>
          <tbody>${f.hist.map(s => `
            <tr class="${s.lunes === esta ? 'ofx-actual' : ''}">
              <td>${s.lunes === esta ? '<b>Esta semana</b>' : `${ddmm(s.lunes)} al ${ddmm(sumarDias(s.lunes, 6))}`}</td>
              ${provs.map(p => { const o = [...s.porProv.values()].find(x => x.proveedor === p);
                return o ? `<td class="ofx-num ${o === s.min && s.porProv.size > 1 ? 'ofx-mejor' : ''}">${o.costo <= record + 0.5 ? '★ ' : ''}${pesos(o.costo)}</td>` : '<td class="ofx-num ofx-tenue">—</td>'; }).join('')}
              <td class="ofx-num"><b>${pesos(s.min.costo)}</b></td>
            </tr>`).join('')}</tbody>
        </table></div>
      </div>`);
    $o('#ofxVolver').addEventListener('click', pantallaLista);
    $o('#ofxBody').scrollTop = 0;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', crearInterfaz);
  else crearInterfaz();
})();