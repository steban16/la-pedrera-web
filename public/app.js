/* =====================================================================
   Distribuciones La Pedrera S.A.S. — Lógica del sitio (rediseño)
   ===================================================================== */

/* ---------------------------------------------------------------------
   CONFIGURACIÓN — cambie aquí los datos reales del cliente.
   --------------------------------------------------------------------- */
const CONFIG = {
  // WhatsApp con indicativo de país, sin "+" ni espacios (57 = Colombia)
  whatsapp: "15551692244", // número de PRUEBA del bot (Meta). Cambiar por el real en producción
  email: "contacto@distribucioneslapedrera.com", // TODO: correo real

  redes: {
    facebook: "https://www.facebook.com/",   // TODO
    instagram: "https://www.instagram.com/", // TODO
    tiktok: "https://www.tiktok.com/",       // TODO
  },

  /* RUTAS (datos de ejemplo). "punto" es la posición en el esquema del río,
     de 0 (Araracuara, río arriba) a 11 (frontera con Brasil). */
  rutas: [
    { id: "cordoba", destino: "Puerto Córdoba", punto: 10, frecuencia: "Semanal", salida: "Lunes 6:00 a. m.", tiempo: "1 h", carga: "Víveres y combustible" },
    { id: "ribera", destino: "Comunidades ribereñas", punto: 6, frecuencia: "Semanal", salida: "Viernes 6:00 a. m.", tiempo: "Según destino", carga: "Víveres" },
    { id: "miriti", destino: "Mirití-Paraná", punto: 4, frecuencia: "Quincenal", salida: "Martes 5:00 a. m.", tiempo: "10 h", carga: "Víveres y mercancía" },
    { id: "araracuara", destino: "Araracuara", punto: 1, frecuencia: "Mensual", salida: "Primer jueves", tiempo: "2 días", carga: "Carga general" },
  ],

  /* PUNTOS DE ATENCIÓN (coordenadas DE PRUEBA en el pueblo de La Pedrera)
     Para poner las reales:
       1. Abra Google Maps y busque el lugar.
       2. Clic derecho exactamente sobre el sitio (en celular: dejar el dedo presionado).
       3. El primer renglón son las coordenadas: haga clic y quedan copiadas.
       4. Pegue el primer número en "lat" y el segundo en "lng".
     Si el negocio ya tiene Perfil de Empresa en Google, ponga su nombre exacto
     en "consulta" y el mapa mostrará la ficha con fotos y reseñas. */
  ubicaciones: [
    {
      nombre: "Oficina principal",
      detalle: "Cotizaciones, reservas y pagos",
      direccion: "Calle principal, frente a la cancha",
      horario: "Lun a sáb · 7:00 a. m. – 6:00 p. m.",
      lat: -1.318559, lng: -69.586087,
    },
    {
      nombre: "Punto de venta de víveres",
      detalle: "Venta al por mayor y al detal",
      direccion: "Barrio centro, a una cuadra de la oficina",
      horario: "Lun a dom · 6:00 a. m. – 8:00 p. m.",
      lat: -1.319213, lng: -69.586602,
    },
    {
      nombre: "Embarcadero fluvial",
      detalle: "Recepción, cargue y descargue",
      direccion: "Orilla del río Caquetá, junto al muelle",
      horario: "Lun a sáb · 5:00 a. m. – 5:00 p. m.",
      lat: -1.3171, lng: -69.585004,
    },
  ],

  tipoMapa: "k",          // "k" = satélite, "m" = mapa de calles
  intervaloSlider: 6000,  // milisegundos entre fotos
};

/* ---------- Utilidades ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const waLink = (msg = "") => `https://wa.me/${CONFIG.whatsapp}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
const formatoTel = (n) => {
  const m = n.match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${n}`;
};
const destinoMapa = (u) => u.consulta || `${u.lat},${u.lng}`;
const mapsEmbed = (u, t) => `https://maps.google.com/maps?q=${encodeURIComponent(destinoMapa(u))}&t=${t}&z=17&output=embed`;
const mapsRuta = (u) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoMapa(u))}`;
const mapsVer = (u) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinoMapa(u))}`;

/* ---------- Enlaces ---------- */
function initEnlaces() {
  $$("[data-wa]").forEach((el) => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });
  $$("[data-wa-text]").forEach((el) => (el.textContent = formatoTel(CONFIG.whatsapp)));
  const mail = $("#emailLink");
  if (mail) { mail.href = `mailto:${CONFIG.email}`; mail.textContent = CONFIG.email; }
  $$("[data-social]").forEach((el) => { const u = CONFIG.redes[el.dataset.social]; if (u) el.href = u; });
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- Menú ---------- */
function initMenu() {
  const nav = $("#nav");
  const toggle = $("#navToggle");
  const set = (open) => { nav.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => set(!nav.classList.contains("is-open")));
  $$("#navMenu a").forEach((a) => a.addEventListener("click", () => set(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && set(false));

  const links = $$("#navMenu ul a");
  const obs = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${e.target.id}`));
    }),
    { rootMargin: "-35% 0px -60% 0px" }
  );
  links.forEach((l) => { const s = $(l.getAttribute("href")); if (s) obs.observe(s); });
}

/* ---------- Carrusel ---------- */
function initSlider() {
  const slider = $("#slider");
  const slides = $$(".slide", slider);
  const dots = $(".slider__dots", slider);
  let actual = 0;
  let timer = null;

  dots.innerHTML = slides.map((_, i) =>
    `<button type="button" role="tab" aria-label="Foto ${i + 1} de ${slides.length}" aria-selected="${i === 0}"></button>`).join("");
  const botones = $$("button", dots);

  const ir = (i) => {
    actual = (i + slides.length) % slides.length;
    slides.forEach((s, j) => { s.classList.toggle("is-active", j === actual); s.setAttribute("aria-hidden", String(j !== actual)); });
    botones.forEach((b, j) => b.setAttribute("aria-selected", String(j === actual)));
  };
  const detener = () => clearInterval(timer);
  const iniciar = () => { if (reducido) return; detener(); timer = setInterval(() => ir(actual + 1), CONFIG.intervaloSlider); };

  $$(".slider__btn", slider).forEach((b) => b.addEventListener("click", () => { ir(actual + Number(b.dataset.dir)); iniciar(); }));
  botones.forEach((b, i) => b.addEventListener("click", () => { ir(i); iniciar(); }));
  slider.addEventListener("mouseenter", detener);
  slider.addEventListener("mouseleave", iniciar);
  slider.addEventListener("focusin", detener);
  slider.addEventListener("focusout", iniciar);

  let x0 = null;
  slider.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  slider.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { ir(actual + (dx < 0 ? 1 : -1)); iniciar(); }
    x0 = null;
  });

  ir(0);
  iniciar();
}

/* ---------- Lancha en el río de la portada ---------- */
function initLancha() {
  if (reducido) {
    const m = $("#boatMotion");
    if (m) m.remove();
    const boat = $("#boat");
    if (boat) boat.setAttribute("transform", "translate(1040 70)");
  }
}

/* ---------- Mapa de rutas del río ---------- */
function initRutas() {
  const svg = $("#riverMap");
  const lista = $("#routeList");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";

  // Puntos del río (esquema), de Araracuara (oeste) a la frontera con Brasil (este)
  const P = [[20, 118], [110, 150], [205, 118], [300, 150], [385, 205], [475, 182], [565, 232], [655, 208], [745, 252], [835, 236], [915, 268], [985, 258]];
  const CASA = 8; // La Pedrera

  // Curva suave (Catmull-Rom → Bézier)
  const curva = (pts) => {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  };
  const el = (tag, attrs, padre = svg) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    padre.appendChild(n);
    return n;
  };
  const tramo = (a, b) => curva(P.slice(Math.min(a, b), Math.max(a, b) + 1));

  // Selva (orillas) y río
  el("path", { class: "map-bank", d: `${curva(P.map(([x, y]) => [x, y - 34]))} L985 0 L20 0 Z`, opacity: ".55" });
  el("path", { class: "map-river", d: curva(P) });
  el("path", { class: "map-river-line", d: curva(P) });

  // Frontera, rosa de los vientos y etiquetas
  el("line", { class: "map-border", x1: 930, y1: 44, x2: 930, y2: 350 });
  el("text", { class: "map-label", x: 922, y: 36, "text-anchor": "end" }).textContent = "COLOMBIA";
  el("text", { class: "map-label", x: 938, y: 36 }).textContent = "BRASIL";
  el("text", { class: "map-label", x: 40, y: 360 }).textContent = "Río Caquetá — corre de oeste a este";
  const rosa = el("g", { transform: "translate(70 290)" });
  el("path", { class: "map-small", d: "M0 -26 L6 0 L0 26 L-6 0 Z" }, rosa);
  el("text", { class: "map-label", x: 0, y: -32, "text-anchor": "middle" }, rosa).textContent = "N";

  // Pequeñas comunidades a lo largo del río
  [5.5, 6.5, 7.4].forEach((t) => {
    const i = Math.floor(t), f = t - i;
    const x = P[i][0] + (P[i + 1][0] - P[i][0]) * f, y = P[i][1] + (P[i + 1][1] - P[i][1]) * f;
    el("circle", { class: "map-small", cx: x, cy: y + 20, r: 4 });
  });

  // Tramos de cada ruta (ocultos hasta elegirla)
  const tramos = {};
  CONFIG.rutas.forEach((r) => { tramos[r.id] = el("path", { class: "map-route", d: tramo(CASA, r.punto) }); });

  // Nodos de destino
  const nodos = {};
  CONFIG.rutas.forEach((r) => {
    const [x, y] = P[r.punto];
    const arriba = r.punto % 2 === 0;
    const g = el("g", { class: "map-node", "data-ruta": r.id, tabindex: "0", role: "button", "aria-label": `Ver ruta a ${r.destino}` });
    el("circle", { cx: x, cy: y, r: 11 }, g);
    el("text", { x, y: arriba ? y - 24 : y + 38, "text-anchor": "middle" }, g).textContent = r.destino;
    el("text", { class: "sub", x, y: arriba ? y - 42 : y + 55, "text-anchor": "middle" }, g).textContent = `${r.frecuencia} · ${r.tiempo}`;
    nodos[r.id] = g;
  });

  // La Pedrera (casa)
  const [hx, hy] = P[CASA];
  const casa = el("g", { class: "map-node map-home" });
  el("circle", { cx: hx, cy: hy, r: 15 }, casa);
  el("text", { x: hx, y: hy + 44, "text-anchor": "middle" }, casa).textContent = "La Pedrera";
  el("text", { class: "sub", x: hx, y: hy + 62, "text-anchor": "middle" }, casa).textContent = "nuestro embarcadero";

  // Lista de rutas
  lista.innerHTML = CONFIG.rutas.map((r) => `
    <li><button class="route" type="button" data-ruta="${r.id}" aria-pressed="false">
      <strong>La Pedrera a ${r.destino}</strong>
      <dl>
        <dt>Frecuencia</dt><dd>${r.frecuencia}</dd>
        <dt>Salida</dt><dd>${r.salida}</dd>
        <dt>Tiempo</dt><dd>${r.tiempo}</dd>
        <dt>Carga</dt><dd>${r.carga}</dd>
      </dl>
    </button></li>`).join("") + `
    <li><a class="route" href="${waLink("Hola, necesito un flete especial.")}" target="_blank" rel="noopener">
      <strong>Fletes especiales</strong>
      <dl><dt>Frecuencia</dt><dd>Bajo pedido</dd><dt>Salida</dt><dd>A convenir</dd><dt>Carga</dt><dd>Combustible y carga completa</dd></dl>
    </a></li>`;

  const elegir = (id) => {
    Object.entries(tramos).forEach(([k, p]) => p.classList.toggle("is-on", k === id));
    Object.entries(nodos).forEach(([k, n]) => n.classList.toggle("is-on", k === id));
    $$("button.route", lista).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ruta === id)));
  };

  lista.addEventListener("click", (e) => { const b = e.target.closest("button.route"); if (b) elegir(b.dataset.ruta); });
  svg.addEventListener("click", (e) => { const n = e.target.closest(".map-node[data-ruta]"); if (n) elegir(n.dataset.ruta); });
  svg.addEventListener("keydown", (e) => {
    const n = e.target.closest(".map-node[data-ruta]");
    if (n && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); elegir(n.dataset.ruta); }
  });

  elegir(CONFIG.rutas[0].id);

  // En celular el esquema se desplaza: mostrar primero la zona de La Pedrera
  const caja = svg.parentElement;
  requestAnimationFrame(() => { if (caja.scrollWidth > caja.clientWidth) caja.scrollLeft = caja.scrollWidth - caja.clientWidth; });
}

/* ---------- Ubicaciones ---------- */
function initUbicaciones() {
  const lista = $("#placeList");
  const frame = $("#mapFrame");
  let actual = 0;
  let tipo = CONFIG.tipoMapa || "k";

  lista.innerHTML = CONFIG.ubicaciones.map((u, i) => `
    <li><div class="place" role="button" tabindex="0" data-i="${i}" aria-selected="${i === 0}">
      <h3>${u.nombre}</h3>
      <p>${u.detalle}</p>
      <p class="meta">${u.direccion}<br>${u.horario}</p>
      <div class="place__links">
        <a class="link" href="${mapsRuta(u)}" target="_blank" rel="noopener">Cómo llegar</a>
        <a class="link" href="${mapsVer(u)}" target="_blank" rel="noopener">Abrir en Google Maps</a>
      </div>
    </div></li>`).join("");

  const pintar = () => {
    $$(".place", lista).forEach((p) => p.setAttribute("aria-selected", String(+p.dataset.i === actual)));
    $$("[data-maptype]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.maptype === tipo)));
    frame.src = mapsEmbed(CONFIG.ubicaciones[actual], tipo);
    frame.title = `Mapa: ${CONFIG.ubicaciones[actual].nombre}`;
  };
  const elegir = (i) => { actual = i; pintar(); };

  lista.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const p = e.target.closest(".place");
    if (p) elegir(+p.dataset.i);
  });
  lista.addEventListener("keydown", (e) => {
    const p = e.target.closest(".place");
    if (p && e.target === p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); elegir(+p.dataset.i); }
  });
  $$("[data-maptype]").forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.maptype; pintar(); }));

  // El mapa carga solo cuando la sección se acerca
  const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { pintar(); obs.disconnect(); } }, { rootMargin: "400px" });
  obs.observe(frame);
}

/* ---------- Cifras ---------- */
function initCifras() {
  const nums = $$("[data-count]");
  if (!nums.length || reducido) return;
  const fmt = (n) => n.toLocaleString("es-CO");
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, fin = +el.dataset.count, pre = el.dataset.prefix || "", t0 = performance.now();
      const paso = (t) => {
        const p = Math.min((t - t0) / 1400, 1);
        el.textContent = pre + fmt(Math.round(fin * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
      obs.unobserve(el);
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => obs.observe(n));
}

/* ---------- Video ---------- */
function initVideo() {
  const video = $("#promoVideo");
  const play = $("#videoPlay");
  if (!video) return;
  const caja = video.parentElement;
  video.controls = false;
  play.addEventListener("click", () => { video.controls = true; video.play(); });
  video.addEventListener("play", () => caja.classList.add("is-playing"));
  video.addEventListener("ended", () => { caja.classList.remove("is-playing"); video.controls = false; video.load(); });
  new IntersectionObserver(([e]) => { if (!e.isIntersecting && !video.paused) video.pause(); }, { threshold: 0.2 }).observe(video);
}

/* ---------- Formulario → WhatsApp ---------- */
function initFormulario() {
  const form = $("#contactForm");
  const error = $("#formError");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let primero = null;
    $$("[required]", form).forEach((c) => {
      const malo = c.name === "telefono" ? !/^[\d\s+()-]{7,}$/.test(c.value.trim()) : !c.value.trim();
      c.setAttribute("aria-invalid", String(malo));
      if (malo && !primero) primero = c;
    });
    if (primero) { error.textContent = "Revise los campos marcados en rojo."; primero.focus(); return; }
    error.textContent = "";
    const d = Object.fromEntries(new FormData(form));
    const texto = [
      "*Solicitud desde la página web*",
      `*Nombre:* ${d.nombre.trim()}`,
      `*Teléfono:* ${d.telefono.trim()}`,
      `*Servicio:* ${d.servicio}`,
      `*Mensaje:* ${d.mensaje.trim()}`,
    ].join("\n");
    window.open(waLink(texto), "_blank", "noopener");
    form.reset();
  });
  $$("[required]", form).forEach((c) => c.addEventListener("input", () => c.setAttribute("aria-invalid", "false")));
}

/* ---------- WhatsApp flotante: aparece al pasar la portada ---------- */
function initFlotante() {
  const btn = $(".wa-float");
  const hero = $("#inicio");
  if (!btn || !hero) return;
  btn.classList.add("is-hidden");
  new IntersectionObserver(([e]) => btn.classList.toggle("is-hidden", e.isIntersecting), { threshold: 0.35 }).observe(hero);
}

/* ---------- Inicio ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initEnlaces();
  initMenu();
  initSlider();
  initLancha();
  initRutas();
  initUbicaciones();
  initCifras();
  initVideo();
  initFormulario();
  initFlotante();
});
