/* =====================================================================
   Panel de solicitudes — lógica
   Habla con /api/panel/... (función de Netlify) usando la clave del panel.
   ===================================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const API = "/api/panel";
  const CLAVE_KEY = "lp-panel-clave";
  const COLORES = { nueva: "var(--e-nueva)", cotizada: "var(--e-cotizada)", confirmada: "var(--e-confirmada)", en_ruta: "var(--e-en_ruta)", entregada: "var(--e-entregada)", cancelada: "var(--e-cancelada)" };

  const estado = { clave: "", solicitudes: [], estados: {}, resumen: {}, filtro: "todas", buscar: "", sel: null, timers: [] };

  /* ---------- Utilidades ---------- */
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const leerClave = () => { try { return sessionStorage.getItem(CLAVE_KEY) || ""; } catch { return ""; } };
  const guardarClave = (v) => { try { v ? sessionStorage.setItem(CLAVE_KEY, v) : sessionStorage.removeItem(CLAVE_KEY); } catch { /* sin almacenamiento */ } };
  const fmtFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
  const fmtHora = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
  function hace(fecha) {
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
    return fmtFecha.format(new Date(fecha));
  }
  // Formato de WhatsApp: *negrita* y _cursiva_ (después de escapar el HTML)
  const formatoWa = (t) => esc(t).replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>").replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>");
  const nota = (el, texto, error = false) => { el.textContent = texto; el.classList.toggle("is-error", error); };

  async function api(ruta, opciones = {}) {
    const res = await fetch(`${API}/${ruta}`, {
      ...opciones,
      headers: { "x-clave": estado.clave, "Content-Type": "application/json", ...(opciones.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { salir("La clave no es correcta o cambió."); throw new Error("401"); }
    if (!res.ok && !data.error) data.error = `Error ${res.status}`;
    return { ok: res.ok, status: res.status, data };
  }

  /* ---------- Entrar / salir ---------- */
  async function entrar(clave) {
    estado.clave = clave;
    const err = $("#loginError");
    nota(err, "");
    try {
      const r = await api("solicitudes");
      if (!r.ok) { nota(err, r.data.error, true); return false; }
      guardarClave(clave);
      cargarDatos(r.data);
      $("#login").hidden = true;
      $("#app").hidden = false;
      programar();
      return true;
    } catch (e) {
      if (e.message !== "401") nota(err, "No se pudo conectar con el servidor.", true);
      return false;
    }
  }

  function salir(mensaje = "") {
    estado.timers.forEach(clearInterval);
    estado.timers = [];
    guardarClave("");
    estado.clave = "";
    estado.sel = null;
    $("#app").hidden = true;
    $("#login").hidden = false;
    nota($("#loginError"), mensaje, Boolean(mensaje));
    $("#clave").value = "";
    $("#clave").focus();
  }

  function programar() {
    estado.timers.forEach(clearInterval);
    estado.timers = [
      setInterval(() => refrescar(), 20000),
      setInterval(() => { if (estado.sel && !document.hidden) cargarChat(estado.sel); }, 10000),
    ];
  }

  /* ---------- Datos ---------- */
  function cargarDatos(d) {
    estado.solicitudes = d.solicitudes || [];
    estado.estados = d.estados || {};
    estado.resumen = d.resumen || {};
    pintarFiltros();
    pintarLista();
    if (estado.sel) pintarFicha(false);
    $("#sync").textContent = `Actualizado ${fmtHora.format(new Date())}`;
  }

  async function refrescar() {
    if (document.hidden) return;
    try { const r = await api("solicitudes"); if (r.ok) cargarDatos(r.data); } catch { /* se reintenta */ }
  }

  /* ---------- Filtros ---------- */
  function pintarFiltros() {
    const total = estado.solicitudes.length;
    const botones = [["todas", "Todas", total, null], ...Object.entries(estado.estados).map(([k, n]) => [k, n, estado.resumen[k] || 0, COLORES[k]])];
    $("#filters").innerHTML = botones.map(([k, n, c, color]) => `
      <button class="filter" type="button" data-filtro="${k}" aria-pressed="${estado.filtro === k}">
        ${color ? `<i style="background:${color}"></i>` : ""}${esc(n)} <b>${c}</b>
      </button>`).join("");
  }

  /* ---------- Lista ---------- */
  function filtradas() {
    const q = estado.buscar.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return estado.solicitudes.filter((s) => {
      if (estado.filtro !== "todas" && s.estado !== estado.filtro) return false;
      if (!q) return true;
      const t = [s.codigo, s.nombre, s.telefono, s.destino, s.origen, s.servicio, s.detalle].join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return t.includes(q);
    });
  }

  function pintarLista() {
    const lista = filtradas();
    $("#vacio").hidden = lista.length > 0;
    $("#vacio").textContent = estado.solicitudes.length ? "No hay solicitudes con este filtro." : "Todavía no han llegado solicitudes. Escríbale al bot por WhatsApp para crear la primera.";
    $("#lista").innerHTML = lista.map((s) => `
      <li><button class="item" type="button" data-id="${s.id}" aria-current="${s.id === estado.sel}">
        <span class="item__code">${esc(s.codigo)}</span>
        <span class="item__time">${esc(hace(s.creado))}</span>
        <span class="item__name">${esc(s.nombre || "Sin nombre")}</span>
        <span class="badge" style="--dot:${COLORES[s.estado]}">${esc(s.estadoNombre)}</span>
        <span class="item__route">${esc(s.servicio)}${s.destino ? ` · ${esc(s.origen || "")} → ${esc(s.destino)}` : ""}</span>
      </button></li>`).join("");
  }

  /* ---------- Ficha ---------- */
  function pintarFicha(cargar = true) {
    const s = estado.solicitudes.find((x) => x.id === estado.sel);
    if (!s) { $("#ficha").hidden = true; $("#sinSeleccion").hidden = false; return; }
    $("#sinSeleccion").hidden = true;
    $("#ficha").hidden = false;
    $("#fCodigo").textContent = `${s.codigo} · ${fmtFecha.format(new Date(s.creado))}`;
    $("#fNombre").textContent = s.nombre || "Sin nombre";
    $("#fTelefono").textContent = `+${s.telefono}`;
    $("#fTelefono").href = `https://wa.me/${s.telefono}`;
    const badge = $("#fBadge");
    badge.textContent = s.estadoNombre;
    badge.style.setProperty("--dot", COLORES[s.estado]);

    const campos = [
      ["Servicio", s.servicio],
      [s.servicio === "Venta de víveres" ? "Pedido" : s.servicio === "Consulta con asesor" ? "Consulta" : "Carga", s.detalle],
      ["Origen", s.origen],
      [s.servicio === "Venta de víveres" ? "Entrega en" : "Destino", s.destino],
      ["Fecha deseada", s.fecha_deseada],
    ].filter(([, v]) => v);
    $("#fDatos").innerHTML = campos.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

    const sel = $("#fEstado");
    if (cargar || document.activeElement !== sel) {
      sel.innerHTML = Object.entries(estado.estados).map(([k, n]) => `<option value="${k}" ${k === s.estado ? "selected" : ""}>${esc(n)}</option>`).join("");
    }

    const puede = s.puedeResponder;
    $("#fRespuesta").disabled = !puede;
    $("#respuestaForm button").disabled = !puede;
    if (!puede) nota($("#respuestaNota"), "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp no permite escribirle libremente.", true);
    else if ($("#respuestaNota").classList.contains("is-error")) nota($("#respuestaNota"), "");

    if (cargar) { nota($("#estadoNota"), ""); cargarChat(s.id); }
  }

  async function cargarChat(id) {
    const s = estado.solicitudes.find((x) => x.id === id);
    if (!s) return;
    try {
      const r = await api(`mensajes?telefono=${encodeURIComponent(s.telefono)}`);
      if (!r.ok || estado.sel !== id) return;
      const chat = $("#chat");
      const abajo = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
      const quien = { cliente: s.nombre || "Cliente", bot: "Bot", asesor: "Asesor" };
      // Todo en una línea: el texto se muestra con sus saltos de línea reales (white-space: pre-wrap)
      chat.innerHTML = r.data.mensajes.map((m) =>
        `<li class="msg msg--${m.autor}"><span class="msg__who">${esc(quien[m.autor] || m.autor)}</span>${formatoWa(m.texto)}<time>${esc(fmtFecha.format(new Date(m.creado)))}</time></li>`
      ).join("") || `<li class="empty">Sin mensajes.</li>`;
      if (abajo || chat.dataset.id !== String(id)) chat.scrollTop = chat.scrollHeight;
      chat.dataset.id = String(id);
    } catch { /* se reintenta en el siguiente ciclo */ }
  }

  /* ---------- Eventos ---------- */
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = e.submitter || $("#loginForm button");
    boton.disabled = true;
    await entrar($("#clave").value.trim());
    boton.disabled = false;
  });
  $("#logout").addEventListener("click", () => salir());
  $("#refresh").addEventListener("click", () => { refrescar(); if (estado.sel) cargarChat(estado.sel); });

  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    pintarFiltros();
    pintarLista();
  });
  $("#buscar").addEventListener("input", (e) => { estado.buscar = e.target.value; pintarLista(); });

  $("#lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    estado.sel = Number(b.dataset.id);
    pintarLista();
    pintarFicha(true);
    $("#app").classList.add("ver-detalle");
    $("#chat").dataset.id = "";
    if (window.matchMedia("(max-width: 860px)").matches) window.scrollTo(0, 0);
  });
  $("#volver").addEventListener("click", () => { $("#app").classList.remove("ver-detalle"); });

  $("#estadoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const s = estado.solicitudes.find((x) => x.id === estado.sel);
    if (!s) return;
    const boton = $("#estadoForm button");
    boton.disabled = true;
    const nuevo = $("#fEstado").value;
    const avisar = $("#fAvisar").checked;
    try {
      const r = await api("estado", { method: "POST", body: JSON.stringify({ id: s.id, estado: nuevo, avisar }) });
      if (!r.ok) nota($("#estadoNota"), r.data.error, true);
      else if (avisar && r.data.aviso && !r.data.aviso.ok) nota($("#estadoNota"), `Estado guardado, pero el cliente no fue avisado: ${r.data.aviso.error}`, true);
      else nota($("#estadoNota"), avisar ? "Estado guardado y cliente avisado por WhatsApp." : "Estado guardado.");
      await refrescar();
      cargarChat(s.id);
    } catch { nota($("#estadoNota"), "No se pudo guardar.", true); }
    boton.disabled = false;
  });

  $("#respuestaForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const s = estado.solicitudes.find((x) => x.id === estado.sel);
    const campo = $("#fRespuesta");
    const texto = campo.value.trim();
    if (!s || !texto) return;
    const boton = $("#respuestaForm button");
    boton.disabled = true;
    try {
      const r = await api("responder", { method: "POST", body: JSON.stringify({ telefono: s.telefono, texto }) });
      if (r.ok) { campo.value = ""; nota($("#respuestaNota"), "Mensaje enviado al cliente."); await cargarChat(s.id); }
      else nota($("#respuestaNota"), r.data.error, true);
    } catch { nota($("#respuestaNota"), "No se pudo enviar.", true); }
    boton.disabled = false;
  });
  $("#fRespuesta").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("#respuestaForm").requestSubmit();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && estado.clave) refrescar(); });

  /* ---------- Inicio ---------- */
  const guardada = leerClave();
  if (guardada) entrar(guardada); else $("#clave").focus();
})();
