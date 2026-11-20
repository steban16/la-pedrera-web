/* =========================================================
   Distribuciones La Pedrera S.A.S. — Lógica del sitio
   Versión simplificada tipo portal (listas + slider)
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURACIÓN — cambie aquí los datos reales del cliente.
   --------------------------------------------------------- */
const CONFIG = {
  // WhatsApp con indicativo de país, sin "+" ni espacios (57 = Colombia)
  whatsapp: "573000000000", // TODO: número real
  email: "contacto@distribucioneslapedrera.com", // TODO: correo real

  redes: {
    facebook: "https://www.facebook.com/",   // TODO
    instagram: "https://www.instagram.com/", // TODO
    tiktok: "https://www.tiktok.com/",       // TODO
  },

  // "consulta" es lo que se busca en Google Maps: dirección, nombre en Google o "lat,lng"
  ubicaciones: [
    { nombre: "Oficina principal", detalle: "Atención administrativa y cotizaciones", consulta: "La Pedrera, Amazonas, Colombia", imagen: "img/servicio-transporte.jpg" },
    { nombre: "Punto de venta de víveres", detalle: "Productos de primera necesidad", consulta: "La Pedrera, Amazonas, Colombia", imagen: "img/servicio-viveres.jpg" },
    { nombre: "Embarcadero fluvial", detalle: "Cargue y descargue de mercancías", consulta: "Río Caquetá, La Pedrera, Amazonas, Colombia", imagen: "img/servicio-combustible.jpg" },
  ],

  // Tiempo entre diapositivas del slider (milisegundos)
  intervaloSlider: 6000,
};

/* ---------- Utilidades ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const waLink = (msg = "") => `https://wa.me/${CONFIG.whatsapp}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
const formatoTel = (n) => {
  const m = n.match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${n}`;
};
const mapsEmbed = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
const mapsRuta = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.remove("no-js");

/* ---------- Enlaces (WhatsApp, correo, redes, año) ---------- */
function initEnlaces() {
  $$("[data-wa]").forEach((el) => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });
  $$("[data-wa-text]").forEach((el) => (el.textContent = formatoTel(CONFIG.whatsapp)));
  $$("[data-email]").forEach((el) => (el.textContent = CONFIG.email));
  const mail = $("#emailLink");
  if (mail) { mail.href = `mailto:${CONFIG.email}`; mail.textContent = CONFIG.email; }
  $$("[data-social]").forEach((el) => { const u = CONFIG.redes[el.dataset.social]; if (u) el.href = u; });
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- Accesibilidad: tamaño de letra y contraste ---------- */
function initAccesibilidad() {
  const html = document.documentElement;
  let tam = 100;
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  const aplicarTam = () => { html.style.fontSize = `${tam}%`; guardar("lp-font", tam); };
  tam = Number(leer("lp-font")) || 100;
  aplicarTam();

  $$("[data-font]").forEach((b) =>
    b.addEventListener("click", () => {
      const a = b.dataset.font;
      tam = a === "up" ? Math.min(tam + 10, 140) : a === "down" ? Math.max(tam - 10, 80) : 100;
      aplicarTam();
    })
  );

  const btn = $("#contrastBtn");
  const aplicarContraste = (on) => {
    html.classList.toggle("contrast", on);
    btn.setAttribute("aria-pressed", String(on));
    guardar("lp-contrast", on ? "1" : "0");
  };
  aplicarContraste(leer("lp-contrast") === "1");
  btn.addEventListener("click", () => aplicarContraste(!html.classList.contains("contrast")));
}

/* ---------- Slider ---------- */
function initSlider() {
  const slider = $(".slider");
  const slides = $$(".slide", slider);
  const dots = $(".slider__dots", slider);
  let actual = 0;
  let timer = null;

  dots.innerHTML = slides
    .map((_, i) => `<button type="button" role="tab" aria-label="Diapositiva ${i + 1}" aria-selected="${i === 0}"></button>`)
    .join("");
  const botones = $$("button", dots);

  const ir = (i) => {
    actual = (i + slides.length) % slides.length;
    slides.forEach((s, j) => {
      s.classList.toggle("is-active", j === actual);
      s.setAttribute("aria-hidden", String(j !== actual));
      $$("a", s).forEach((a) => (a.tabIndex = j === actual ? 0 : -1));
    });
    botones.forEach((b, j) => b.setAttribute("aria-selected", String(j === actual)));
  };

  const iniciar = () => {
    if (reducido) return;
    detener();
    timer = setInterval(() => ir(actual + 1), CONFIG.intervaloSlider);
  };
  const detener = () => clearInterval(timer);

  $(".slider__arrow--prev", slider).addEventListener("click", () => { ir(actual - 1); iniciar(); });
  $(".slider__arrow--next", slider).addEventListener("click", () => { ir(actual + 1); iniciar(); });
  botones.forEach((b, i) => b.addEventListener("click", () => { ir(i); iniciar(); }));

  // Pausa al pasar el mouse o al enfocar con teclado
  slider.addEventListener("mouseenter", detener);
  slider.addEventListener("mouseleave", iniciar);
  slider.addEventListener("focusin", detener);
  slider.addEventListener("focusout", iniciar);

  // Deslizar con el dedo en celular
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

/* ---------- Menú (móvil + sección activa) ---------- */
function initMenu() {
  const menu = $("#menu");
  const toggle = $("#menuToggle");
  const set = (open) => { menu.classList.toggle("is-open", open); toggle.setAttribute("aria-expanded", String(open)); };
  toggle.addEventListener("click", () => set(!menu.classList.contains("is-open")));
  $$(".menu__list a").forEach((a) => a.addEventListener("click", () => set(false)));

  const links = $$(".menu__list a");
  const obs = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${e.target.id}`));
    }),
    { rootMargin: "-40% 0px -55% 0px" }
  );
  links.forEach((l) => { const s = $(l.getAttribute("href")); if (s) obs.observe(s); });
}

/* ---------- Ubicaciones (lista + mapa) ---------- */
function initUbicaciones() {
  const lista = $("#placeList");
  const frame = $("#mapFrame");

  lista.innerHTML = CONFIG.ubicaciones
    .map((u, i) => `
      <li class="item" role="button" tabindex="0" data-i="${i}" aria-selected="${i === 0}">
        <img src="${u.imagen}" alt="" loading="lazy">
        <div>
          <h3>${u.nombre}</h3>
          <p>${u.detalle}</p>
          <a class="item__link" href="${mapsRuta(u.consulta)}" target="_blank" rel="noopener">Cómo llegar</a>
        </div>
      </li>`)
    .join("");

  const elegir = (i) => {
    $$(".item", lista).forEach((li) => li.setAttribute("aria-selected", String(+li.dataset.i === i)));
    frame.src = mapsEmbed(CONFIG.ubicaciones[i].consulta);
  };

  lista.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const li = e.target.closest(".item");
    if (li) elegir(+li.dataset.i);
  });
  lista.addEventListener("keydown", (e) => {
    const li = e.target.closest(".item");
    if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); elegir(+li.dataset.i); }
  });

  // El mapa carga solo cuando la sección se acerca (más rápido)
  const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { elegir(0); obs.disconnect(); } }, { rootMargin: "300px" });
  obs.observe(frame);
}

/* ---------- Buscador ---------- */
function initBuscador() {
  const form = $("#searchForm");
  const input = $("#q");
  const res = $("#searchResults");

  // Índice simple: cada sección y cada elemento de lista con su texto
  const indice = [
    ...$$("#servicios .item").map((el) => ({ titulo: $("h3", el).textContent, seccion: "Servicios", destino: el, texto: el.textContent })),
    ...CONFIG.ubicaciones.map((u) => ({ titulo: u.nombre, seccion: "Puntos de atención", destino: $("#ubicaciones"), texto: `${u.nombre} ${u.detalle} ubicación mapa dirección` })),
    ...$$("main section[id]").map((s) => ({ titulo: ($(".title, h1", s) || {}).textContent || s.id, seccion: "Sección", destino: s, texto: s.textContent })),
  ];
  const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const buscar = () => {
    const q = norm(input.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    const vistos = new Set();
    const hits = indice
      .filter((it) => norm(it.texto).includes(q))
      .filter((it) => !vistos.has(it.titulo) && vistos.add(it.titulo))
      .slice(0, 6);
    res.innerHTML = hits.length
      ? hits.map((h, i) => `<li><a href="#" data-hit="${indice.indexOf(h)}">${h.titulo}<small>${h.seccion}</small></a></li>`).join("")
      : `<li class="empty">Sin resultados. Escríbanos por WhatsApp.</li>`;
    res.hidden = false;
  };

  input.addEventListener("input", buscar);
  form.addEventListener("submit", (e) => { e.preventDefault(); buscar(); $("a", res)?.focus(); });
  res.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-hit]");
    if (!a) return;
    e.preventDefault();
    indice[+a.dataset.hit].destino.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "start" });
    res.hidden = true;
    input.value = "";
  });
  document.addEventListener("click", (e) => { if (!form.contains(e.target)) res.hidden = true; });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") res.hidden = true; });
}

/* ---------- Formulario -> WhatsApp ---------- */
function initFormulario() {
  const form = $("#contactForm");
  const error = $("#formError");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const campos = $$("[required]", form);
    let primero = null;
    campos.forEach((c) => {
      const malo = c.name === "telefono" ? !/^[\d\s+()-]{7,}$/.test(c.value.trim()) : !c.value.trim();
      c.setAttribute("aria-invalid", String(malo));
      if (malo && !primero) primero = c;
    });
    if (primero) {
      error.textContent = "Revise los campos marcados en rojo.";
      primero.focus();
      return;
    }
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

/* ---------- Inicio ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initEnlaces();
  initAccesibilidad();
  initSlider();
  initMenu();
  initUbicaciones();
  initBuscador();
  initFormulario();
});
