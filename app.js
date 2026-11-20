/* =========================================================
   Distribuciones La Pedrera S.A.S. — Lógica del sitio
   Propuesta 2 · Web + WhatsApp
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURACIÓN — cambie aquí los datos reales del cliente.
   Todo el sitio toma estos valores (botones, mapa, redes).
   --------------------------------------------------------- */
const CONFIG = {
  // Número de WhatsApp con indicativo de país, sin "+" ni espacios (57 = Colombia)
  whatsapp: "573000000000", // TODO: número real
  email: "contacto@distribucioneslapedrera.com", // TODO: correo real

  redes: {
    facebook: "https://www.facebook.com/",   // TODO: URL real de la página
    instagram: "https://www.instagram.com/", // TODO: URL real del perfil
    tiktok: "https://www.tiktok.com/",       // TODO: URL real del perfil
  },

  // Puntos de atención. "consulta" es lo que se busca en Google Maps:
  // puede ser una dirección, el nombre del negocio ya registrado en Google
  // o coordenadas "lat,lng" (más preciso).
  ubicaciones: [
    {
      nombre: "Oficina principal",
      detalle: "Atención administrativa y cotizaciones",
      consulta: "La Pedrera, Amazonas, Colombia", // TODO
      imagen: "img/servicio-transporte.jpg",
    },
    {
      nombre: "Punto de venta de víveres",
      detalle: "Productos de primera necesidad",
      consulta: "La Pedrera, Amazonas, Colombia", // TODO
      imagen: "img/servicio-viveres.jpg",
    },
    {
      nombre: "Embarcadero fluvial",
      detalle: "Cargue y descargue de mercancías",
      consulta: "Río Caquetá, La Pedrera, Amazonas, Colombia", // TODO
      imagen: "img/servicio-combustible.jpg",
    },
  ],

  // Conversación de ejemplo que se muestra en el teléfono
  chatDemo: [
    { de: "in",  texto: "¡Hola! 👋 Bienvenido a Distribuciones La Pedrera. ¿Qué servicio necesita?" },
    { de: "out", texto: "Transporte de mercancías" },
    { de: "in",  texto: "Perfecto. ¿Desde qué lugar será el envío?" },
    { de: "out", texto: "Leticia" },
    { de: "in",  texto: "¿Cuál es el destino?" },
    { de: "out", texto: "La Pedrera" },
    { de: "in",  texto: "¡Listo! ✅ Registramos su solicitud. Un asesor continuará la atención por este mismo chat." },
  ],
};

/* ---------- Utilidades ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const waLink = (mensaje = "") =>
  `https://wa.me/${CONFIG.whatsapp}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ""}`;

const formatoTelefono = (num) => {
  // 573001234567 -> +57 300 123 4567
  const m = num.match(/^(\d{2})(\d{3})(\d{3})(\d{4})$/);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : `+${num}`;
};

const mapsEmbed = (q) => `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
const mapsDirections = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

document.documentElement.classList.remove("no-js");

/* ---------- Enlaces de WhatsApp, correo y redes ---------- */
function initLinks() {
  $$("[data-wa]").forEach((el) => {
    el.href = waLink(el.dataset.wa);
    el.target = "_blank";
    el.rel = "noopener";
  });
  $$("[data-wa-text]").forEach((el) => (el.textContent = formatoTelefono(CONFIG.whatsapp)));

  const email = $("#emailLink");
  if (email) {
    email.href = `mailto:${CONFIG.email}`;
    email.textContent = CONFIG.email;
  }

  $$("[data-social]").forEach((el) => {
    const url = CONFIG.redes[el.dataset.social];
    if (url) el.href = url;
  });

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
}

/* ---------- Encabezado y menú móvil ---------- */
function initHeader() {
  const header = $("#header");
  const nav = $("#nav");
  const toggle = $("#navToggle");

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };

  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$("a", nav).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  // Resalta el enlace de la sección visible
  const links = $$(".nav__link");
  const sections = links.map((l) => $(l.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}

/* ---------- Animación de aparición al hacer scroll ---------- */
function initReveal() {
  const items = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 3) * 90}ms`;
    io.observe(el);
  });
}

/* ---------- Ubicaciones + mapa ---------- */
function initLocations() {
  const list = $("#locTabs");
  const frame = $("#mapFrame");
  if (!list || !frame) return;

  list.innerHTML = CONFIG.ubicaciones
    .map(
      (u, i) => `
      <div class="loc" role="tab" tabindex="0" data-i="${i}" aria-selected="${i === 0}">
        <img src="${u.imagen}" alt="" loading="lazy">
        <span>
          <strong><svg class="ico" aria-hidden="true"><use href="#i-pin"/></svg>${u.nombre}</strong>
          <small>${u.detalle}</small>
          <a class="loc__go" href="${mapsDirections(u.consulta)}" target="_blank" rel="noopener">Cómo llegar →</a>
        </span>
      </div>`
    )
    .join("");

  const select = (i) => {
    $$(".loc", list).forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.i === i)));
    frame.src = mapsEmbed(CONFIG.ubicaciones[i].consulta);
  };

  list.addEventListener("click", (e) => {
    if (e.target.closest(".loc__go")) return; // deja abrir "Cómo llegar"
    const btn = e.target.closest(".loc");
    if (btn) select(+btn.dataset.i);
  });
  list.addEventListener("keydown", (e) => {
    const btn = e.target.closest(".loc");
    if (btn && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(+btn.dataset.i);
    }
  });

  // Carga el mapa solo cuando la sección está cerca (mejor rendimiento)
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        select(0);
        io.disconnect();
      }
    },
    { rootMargin: "300px" }
  );
  io.observe(frame);
}

/* ---------- Simulación del chat de WhatsApp ---------- */
function initChatDemo() {
  const chat = $("#chat");
  const status = $("#chatStatus");
  if (!chat) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let minuto = 24;

  const addMsg = (m) => {
    const el = document.createElement("div");
    el.className = `msg msg--${m.de}`;
    el.innerHTML = `${m.texto}<time>10:${String(minuto).padStart(2, "0")}</time>`;
    chat.appendChild(el);
    if (Math.random() > 0.5) minuto++;
  };

  if (reduced) {
    CONFIG.chatDemo.forEach(addMsg);
    return;
  }

  const run = async () => {
    chat.innerHTML = "";
    minuto = 24;
    for (const m of CONFIG.chatDemo) {
      if (m.de === "in") {
        status.textContent = "escribiendo…";
        const typing = document.createElement("div");
        typing.className = "msg msg--in msg--typing";
        typing.innerHTML = "<span></span><span></span><span></span>";
        chat.appendChild(typing);
        await wait(1100);
        typing.remove();
        status.textContent = "en línea";
      } else {
        await wait(900);
      }
      addMsg(m);
      await wait(500);
    }
    await wait(5000);
    run();
  };

  // Empieza cuando el teléfono es visible
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        run();
        io.disconnect();
      }
    },
    { threshold: 0.3 }
  );
  io.observe(chat);
}

/* ---------- Formulario de contacto -> WhatsApp ---------- */
function initForm() {
  const form = $("#contactForm");
  if (!form) return;

  const reglas = {
    nombre: (v) => (v.trim().length >= 3 ? "" : "Escriba su nombre completo."),
    telefono: (v) => (/^[\d\s+()-]{7,}$/.test(v.trim()) ? "" : "Escriba un teléfono válido."),
    servicio: (v) => (v ? "" : "Seleccione un servicio."),
    mensaje: (v) => (v.trim().length >= 5 ? "" : "Cuéntenos un poco más."),
  };

  const validar = (campo) => {
    const regla = reglas[campo.name];
    if (!regla) return true;
    const error = regla(campo.value);
    const field = campo.closest(".field");
    field.classList.toggle("has-error", !!error);
    $(".field__error", field).textContent = error;
    return !error;
  };

  $$("input, select, textarea", form).forEach((c) =>
    c.addEventListener("input", () => c.closest(".field").classList.contains("has-error") && validar(c))
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const campos = $$("[required]", form);
    const ok = campos.map(validar).every(Boolean);
    if (!ok) {
      campos.find((c) => c.closest(".field").classList.contains("has-error"))?.focus();
      return;
    }

    const d = Object.fromEntries(new FormData(form));
    const lineas = [
      "*Nueva solicitud desde la página web*",
      `*Nombre:* ${d.nombre.trim()}`,
      `*Teléfono:* ${d.telefono.trim()}`,
      `*Servicio:* ${d.servicio}`,
      d.origen.trim() && `*Origen:* ${d.origen.trim()}`,
      d.destino.trim() && `*Destino:* ${d.destino.trim()}`,
      `*Mensaje:* ${d.mensaje.trim()}`,
    ].filter(Boolean);

    window.open(waLink(lineas.join("\n")), "_blank", "noopener");
    form.reset();
  });
}

/* ---------- Botón flotante: muestra el aviso una vez ---------- */
function initFloat() {
  const btn = $(".wa-float");
  if (!btn) return;
  setTimeout(() => {
    btn.classList.add("show-tip");
    setTimeout(() => btn.classList.remove("show-tip"), 4000);
  }, 6000);
}

/* ---------- Inicio ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initLinks();
  initHeader();
  initReveal();
  initLocations();
  initChatDemo();
  initForm();
  initFloat();
});
