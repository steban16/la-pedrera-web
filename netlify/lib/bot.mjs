/* =====================================================================
   Bot de WhatsApp — Distribuciones La Pedrera
   Lógica PURA de la conversación (sin base de datos ni red), para que se
   pueda probar sola. Recibe el estado de la conversación y el mensaje del
   cliente, y devuelve el nuevo estado, las respuestas y una acción.
   ===================================================================== */

export const SERVICIOS = {
  srv_viveres: { nombre: "Venta de víveres", titulo: "Venta de víveres", desc: "Pedidos al por mayor y al detal" },
  srv_combustible: { nombre: "Transporte de combustible", titulo: "Combustible", desc: "Transporte de tambores y galones" },
  srv_mercancia: { nombre: "Transporte de mercancía", titulo: "Mercancía", desc: "Carga general por el río" },
};

export const DESTINOS = {
  dst_cordoba: "Puerto Córdoba",
  dst_ribera: "Comunidades ribereñas",
  dst_miriti: "Mirití-Paraná",
  dst_araracuara: "Araracuara",
  dst_pedrera: "La Pedrera",
};

export const ESTADOS = {
  nueva: "Nueva",
  cotizada: "Cotizada",
  confirmada: "Confirmada",
  en_ruta: "En ruta",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const VIGENCIA_MS = 6 * 60 * 60 * 1000;   // una conversación a medias vence a las 6 h
const AVISO_FIN_MS = 15 * 60 * 1000;      // no repetir el aviso automático antes de 15 min

/* ---------- Utilidades de texto ---------- */
export const normalizar = (t = "") =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

export const codigoSolicitud = (id) => `LP-${String(id).padStart(4, "0")}`;

const primerNombre = (n = "") => n.trim().split(/\s+/)[0] || "";

/* ---------- Mensajes (formato neutro; whatsapp.mjs los convierte) ---------- */
const texto = (t) => ({ tipo: "texto", texto: t });
const botones = (t, lista) => ({ tipo: "botones", texto: t, botones: lista });
const lista = (t, boton, filas, titulo = "Opciones") => ({ tipo: "lista", texto: t, boton, titulo, filas });

const listaServicios = (intro) =>
  lista(
    `${intro}\n\n¿Qué servicio necesita hoy?`,
    "Ver servicios",
    [
      ...Object.entries(SERVICIOS).map(([id, s]) => ({ id, titulo: s.titulo, descripcion: s.desc })),
      { id: "srv_asesor", titulo: "Hablar con un asesor", descripcion: "Otra consulta" },
    ],
    "Servicios"
  );

const listaDestinos = (pregunta) =>
  lista(
    pregunta,
    "Ver destinos",
    [
      ...Object.entries(DESTINOS).map(([id, nombre]) => ({ id, titulo: nombre })),
      { id: "dst_otro", titulo: "Otro destino", descripcion: "Lo escribo yo" },
    ],
    "Destinos"
  );

const preguntaFecha = () =>
  botones("¿Para cuándo lo necesita?", [
    { id: "fch_pronto", titulo: "Lo antes posible" },
    { id: "fch_semana", titulo: "Esta semana" },
    { id: "fch_otra", titulo: "Otra fecha" },
  ]);

const preguntaDetalle = (servicioId) => ({
  srv_viveres: "¿Qué productos y cantidades necesita?\n\n_Ejemplo: 2 bultos de arroz, 1 caja de aceite, 3 pacas de agua._",
  srv_combustible: "¿Cuántos tambores o galones va a transportar?",
  srv_mercancia: "¿Qué carga va a enviar? Indique bultos o peso aproximado.\n\n_Ejemplo: 15 bultos de cemento._",
}[servicioId]);

export const resumen = (d) =>
  [
    `*Servicio:* ${d.servicio}`,
    `*Nombre:* ${d.nombre}`,
    `*${d.servicioId === "srv_viveres" ? "Pedido" : "Carga"}:* ${d.detalle}`,
    d.servicioId === "srv_viveres" ? null : `*Origen:* ${d.origen}`,
    `*${d.servicioId === "srv_viveres" ? "Entrega en" : "Destino"}:* ${d.destino}`,
    `*Fecha:* ${d.fecha}`,
  ].filter(Boolean).join("\n");

/* ---------- Mensajes que arma la función con datos de la base ---------- */
export const mensajeConfirmado = (codigo, d) =>
  texto(
    `✅ ¡Listo, ${primerNombre(d.nombre) || "gracias"}! Registramos su solicitud *${codigo}*.\n\n${resumen(d)}\n\n` +
      "Un asesor le responde en este mismo chat con el precio y la fecha de salida.\n" +
      "Escriba *estado* para consultar cómo va, o *menú* para una nueva solicitud."
  );

export const mensajeConsultaRegistrada = (codigo) =>
  texto(
    `✅ Recibimos su consulta *${codigo}*. Un asesor le responde en este mismo chat.\n` +
      "Escriba *menú* si quiere hacer una solicitud de servicio."
  );

export const mensajeEstado = (sol) =>
  sol
    ? texto(
        `📋 Su solicitud *${codigoSolicitud(sol.id)}* (${sol.servicio}) está: *${ESTADOS[sol.estado] || sol.estado}*.\n` +
          "Si tiene dudas, escríbalas aquí y un asesor le responde."
      )
    : texto("Todavía no tiene solicitudes registradas. Escriba *menú* para empezar una.");

export const mensajeCambioEstado = (sol) => {
  const frases = {
    cotizada: "ya tiene cotización. Un asesor le comparte el valor en este chat.",
    confirmada: "quedó *confirmada*. Recuerde entregar la carga en el embarcadero el día anterior a la salida.",
    en_ruta: "va *en ruta* 🚤. Le avisamos cuando llegue.",
    entregada: "fue *entregada* ✅. ¡Gracias por confiar en La Pedrera!",
    cancelada: "fue *cancelada*. Si fue un error, escríbanos aquí.",
    nueva: "está registrada y pendiente de revisión.",
  };
  return texto(`📋 Su solicitud *${codigoSolicitud(sol.id)}* ${frases[sol.estado] || `cambió a: ${sol.estado}`}`);
};

/* ---------- Interpretar la entrada ---------- */
const COMANDOS = {
  menu: ["menu", "inicio", "empezar", "comenzar", "nueva solicitud", "volver"],
  cancelar: ["cancelar", "salir"],
  estado: ["estado", "mi solicitud", "como va", "como va mi solicitud"],
  asesor: ["asesor", "hablar con un asesor", "humano", "persona"],
};
const SALUDOS = ["hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "buen dia", "hey", "ola"];

const esComando = (t, cmd) => COMANDOS[cmd].includes(t);

function servicioDesdeTexto(t) {
  if (["1", "uno"].includes(t) || t.includes("viver") || t.includes("mercado") || t.includes("comida")) return "srv_viveres";
  if (["2", "dos"].includes(t) || t.includes("combust") || t.includes("gasolin") || t.includes("acpm") || t.includes("tambor")) return "srv_combustible";
  if (["3", "tres"].includes(t) || t.includes("mercanc") || t.includes("carga") || t.includes("transport") || t.includes("flete")) return "srv_mercancia";
  if (["4", "cuatro"].includes(t) || t.includes("asesor")) return "srv_asesor";
  return null;
}

function destinoDesdeTexto(t) {
  for (const [id, nombre] of Object.entries(DESTINOS)) if (normalizar(nombre) === t) return id;
  return null;
}

/* =====================================================================
   procesar(conv, entrada, ctx)
   conv    = { paso, datos, actualizado (ms) }  — estado guardado
   entrada = { tipo: "texto" | "opcion" | "otro", texto, id }
   ctx     = { ahora (ms), nombrePerfil }
   Devuelve { paso, datos, respuestas: [...], accion }
   accion  = null | { tipo: "crear_solicitud", datos } | { tipo: "estado" }
   ===================================================================== */
export function procesar(conv, entrada, ctx = {}) {
  const ahora = ctx.ahora ?? Date.now();
  let paso = conv?.paso || "inicio";
  let datos = { ...(conv?.datos || {}) };
  const t = normalizar(entrada.texto || "");
  const id = entrada.tipo === "opcion" ? entrada.id : null;
  const crudo = (entrada.texto || "").trim();
  const r = { paso, datos, respuestas: [], accion: null };
  const ir = (nuevoPaso, ...msgs) => { r.paso = nuevoPaso; r.datos = datos; r.respuestas.push(...msgs); return r; };

  // Conversación vieja a medias: empezar de nuevo
  const aMedias = !["inicio", "fin"].includes(paso);
  if (aMedias && conv?.actualizado && ahora - conv.actualizado > VIGENCIA_MS) { paso = "inicio"; datos = {}; }

  // Mensajes que no son texto ni botones (audio, foto, ubicación…)
  if (entrada.tipo === "otro") {
    if (paso === "fin") return ir("fin");   // en atención: el asesor lo ve en el panel
    return ir(paso === "inicio" ? "inicio" : paso,
      texto("Por ahora solo entiendo mensajes de texto y los botones 🙏. Escriba *menú* para ver las opciones."));
  }

  // Comandos globales
  if (esComando(t, "estado")) { r.accion = { tipo: "estado" }; r.paso = paso; r.datos = datos; return r; }
  if (esComando(t, "cancelar") && paso !== "fin") {
    datos = {};
    return ir("servicio", listaServicios("Listo, cancelamos lo que llevábamos."));
  }
  if (esComando(t, "asesor") && paso !== "fin") {
    datos = { servicioId: "srv_asesor", servicio: "Consulta con asesor" };
    return ir("asesor_motivo", texto("Con gusto. Cuéntenos en un solo mensaje qué necesita y un asesor le responde aquí."));
  }
  if (esComando(t, "menu") || paso === "inicio") {
    datos = {};
    const nombre = primerNombre(ctx.nombrePerfil);
    const saludo = `¡Hola${nombre ? ` ${nombre}` : ""}! 👋 Soy el asistente de *Distribuciones La Pedrera* 🚤`;
    // Si el primer mensaje ya dice qué necesita (p. ej. desde un botón de la web), saltar a ese servicio
    const sid = paso === "inicio" && t.length > 3 ? servicioDesdeTexto(t) : null;
    if (sid && sid !== "srv_asesor") {
      datos = { servicioId: sid, servicio: SERVICIOS[sid].nombre };
      return ir("nombre", texto(saludo), pedirNombre(sid, ctx));
    }
    return ir("servicio", listaServicios(`${saludo}\nLlevamos víveres, combustible y mercancía por el río Caquetá.`));
  }

  switch (paso) {
    case "servicio": {
      const sid = id && (SERVICIOS[id] || id === "srv_asesor") ? id : servicioDesdeTexto(t);
      if (!sid) return ir("servicio", listaServicios("No le entendí 😅. Toque *Ver servicios* y elija una opción."));
      if (sid === "srv_asesor") {
        datos = { servicioId: "srv_asesor", servicio: "Consulta con asesor" };
        return ir("asesor_motivo", texto("Con gusto. Cuéntenos en un solo mensaje qué necesita y un asesor le responde aquí."));
      }
      datos = { servicioId: sid, servicio: SERVICIOS[sid].nombre };
      return ir("nombre", pedirNombre(sid, ctx));
    }

    case "nombre": {
      if (id === "nombre_perfil" && ctx.nombrePerfil) datos.nombre = ctx.nombrePerfil;
      else if (crudo.length >= 2 && !id) datos.nombre = crudo.slice(0, 80);
      else return ir("nombre", texto("Escriba el nombre de quien hace la solicitud, por favor."));
      return ir("detalle", texto(preguntaDetalle(datos.servicioId)));
    }

    case "detalle": {
      if (crudo.length < 2 || id) return ir("detalle", texto(preguntaDetalle(datos.servicioId)));
      datos.detalle = crudo.slice(0, 500);
      if (datos.servicioId === "srv_viveres") {
        datos.origen = "Bodega La Pedrera";
        return ir("destino", listaDestinos("¿Dónde le entregamos el pedido?"));
      }
      return ir("origen", botones("¿Desde dónde sale la carga? Toque el botón o escriba el lugar.", [{ id: "org_pedrera", titulo: "Desde La Pedrera" }]));
    }

    case "origen": {
      if (id === "org_pedrera") datos.origen = "La Pedrera";
      else if (crudo.length >= 2 && !id) datos.origen = crudo.slice(0, 120);
      else return ir("origen", texto("Escriba el lugar desde donde sale la carga."));
      return ir("destino", listaDestinos("¿Hacia dónde la llevamos?"));
    }

    case "destino": {
      if (id === "dst_otro") return ir("destino_otro", texto("Escriba el destino, por favor."));
      const did = id && DESTINOS[id] ? id : destinoDesdeTexto(t);
      if (did) datos.destino = DESTINOS[did];
      else if (crudo.length >= 2 && !id) datos.destino = crudo.slice(0, 120);
      else return ir("destino", listaDestinos("Elija un destino de la lista o escríbalo."));
      return ir("fecha", preguntaFecha());
    }

    case "destino_otro": {
      if (crudo.length < 2 || id) return ir("destino_otro", texto("Escriba el destino, por favor."));
      datos.destino = crudo.slice(0, 120);
      return ir("fecha", preguntaFecha());
    }

    case "fecha": {
      if (id === "fch_otra") return ir("fecha_otra", texto("¿Para qué fecha lo necesita?\n\n_Ejemplo: viernes 28 de noviembre._"));
      if (id === "fch_pronto") datos.fecha = "Lo antes posible";
      else if (id === "fch_semana") datos.fecha = "Esta semana";
      else if (crudo.length >= 2 && !id) datos.fecha = crudo.slice(0, 80);
      else return ir("fecha", preguntaFecha());
      return ir("confirmar", confirmar(datos));
    }

    case "fecha_otra": {
      if (crudo.length < 2 || id) return ir("fecha_otra", texto("Escriba la fecha, por favor."));
      datos.fecha = crudo.slice(0, 80);
      return ir("confirmar", confirmar(datos));
    }

    case "confirmar": {
      if (id === "conf_si" || ["si", "confirmar", "confirmo", "ok", "dale", "listo"].includes(t)) {
        r.accion = { tipo: "crear_solicitud", datos: { ...datos } };
        datos = { ultimoAviso: ahora };
        r.paso = "fin"; r.datos = datos;
        return r; // el mensaje con el código lo envía la función al guardar
      }
      if (id === "conf_no" || ["no", "corregir"].includes(t)) {
        datos = {};
        return ir("servicio", listaServicios("Sin problema, empecemos de nuevo."));
      }
      return ir("confirmar", confirmar(datos));
    }

    case "asesor_motivo": {
      if (crudo.length < 2 || id) return ir("asesor_motivo", texto("Cuéntenos en un mensaje qué necesita, por favor."));
      datos.detalle = crudo.slice(0, 500);
      datos.nombre = ctx.nombrePerfil || "";
      r.accion = { tipo: "crear_solicitud", datos: { ...datos } };
      datos = { ultimoAviso: ahora };
      r.paso = "fin"; r.datos = datos;
      return r;
    }

    case "fin":
    default: {
      // En atención por un asesor: el bot no interrumpe, solo avisa de vez en cuando
      if (SALUDOS.includes(t) || !datos.ultimoAviso || ahora - datos.ultimoAviso > AVISO_FIN_MS) {
        datos.ultimoAviso = ahora;
        return ir("fin", texto("Recibimos su mensaje 👍. Un asesor le responde en este chat.\nEscriba *estado* para ver su solicitud o *menú* para una nueva."));
      }
      return ir("fin");
    }
  }
}

function pedirNombre(sid, ctx) {
  const intro = `Perfecto: *${SERVICIOS[sid].nombre}*.`;
  if (ctx.nombrePerfil) {
    return botones(
      `${intro}\n\n¿Registramos la solicitud a nombre de *${ctx.nombrePerfil}*? Si no, escriba el nombre.`,
      [{ id: "nombre_perfil", titulo: "Sí, ese nombre" }]
    );
  }
  return texto(`${intro}\n\n¿A nombre de quién registramos la solicitud?`);
}

function confirmar(d) {
  return botones(`Revise su solicitud:\n\n${resumen(d)}\n\n¿Está todo bien?`, [
    { id: "conf_si", titulo: "Confirmar" },
    { id: "conf_no", titulo: "Corregir" },
  ]);
}
