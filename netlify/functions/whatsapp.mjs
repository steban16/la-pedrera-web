/* =====================================================================
   Webhook de WhatsApp — https://<sitio>/api/whatsapp
   GET  → verificación de Meta (y, sin parámetros, revisión de configuración)
   POST → llega un mensaje: se guarda, se procesa con el bot y se responde
   Variables: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN,
              WHATSAPP_APP_SECRET, EMPLEADO_WHATSAPP
   ===================================================================== */
import { procesar, normalizar, mensajeConfirmado, mensajeConsultaRegistrada, mensajeEstado, codigoSolicitud, resumen } from "../lib/bot.mjs";
import { enviar, marcarLeido, textoHistorial, firmaValida, env } from "../lib/whatsapp-api.mjs";
import {
  leerConversacion, guardarConversacion, registrarEntrante, registrarSaliente,
  crearSolicitud, ultimaSolicitud,
} from "../lib/datos.mjs";

const soloDigitos = (n = "") => String(n).replace(/\D/g, "");

export default async (req, context) => {
  if (req.method === "GET") return verificar(req);
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const crudo = await req.text();
  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"))) {
    console.warn("Firma inválida: el aviso no viene de Meta");
    return new Response("Firma inválida", { status: 403 });
  }

  let cuerpo;
  try { cuerpo = JSON.parse(crudo); } catch { return new Response("JSON inválido", { status: 400 }); }

  const sitio = context?.site?.url || new URL(req.url).origin;
  try {
    for (const entry of cuerpo.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        const nombres = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name || ""]));
        for (const msg of v.messages || []) await atender(msg, nombres[msg.from] || "", sitio);
      }
    }
  } catch (err) {
    // Se responde 200 igual para que Meta no reintente en bucle; el error queda en los registros de Netlify
    console.error("Error procesando el webhook:", err);
  }
  return new Response("OK", { status: 200 });
};

/* ---------- Verificación del webhook (paso de configuración en Meta) ---------- */
function verificar(req) {
  const u = new URL(req.url);
  const modo = u.searchParams.get("hub.mode");
  if (!modo) {
    // Revisión rápida: qué variables están configuradas (sin mostrar sus valores)
    const tiene = (k) => Boolean(env(k));
    return Response.json({
      servicio: "Bot de WhatsApp · Distribuciones La Pedrera",
      configurado: {
        WHATSAPP_TOKEN: tiene("WHATSAPP_TOKEN"),
        WHATSAPP_PHONE_ID: tiene("WHATSAPP_PHONE_ID"),
        WHATSAPP_VERIFY_TOKEN: tiene("WHATSAPP_VERIFY_TOKEN"),
        WHATSAPP_APP_SECRET: tiene("WHATSAPP_APP_SECRET"),
        EMPLEADO_WHATSAPP: tiene("EMPLEADO_WHATSAPP"),
        PANEL_CLAVE: tiene("PANEL_CLAVE"),
      },
    });
  }
  const esperado = env("WHATSAPP_VERIFY_TOKEN");
  if (modo === "subscribe" && esperado && u.searchParams.get("hub.verify_token") === esperado) {
    return new Response(u.searchParams.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Token de verificación incorrecto", { status: 403 });
}

/* ---------- Atender un mensaje entrante ---------- */
async function atender(msg, nombrePerfil, sitio) {
  const de = msg.from;
  const entrada = leerEntrada(msg);
  const textoLog = entrada.tipo === "otro" ? `[${msg.type}]` : (entrada.texto || entrada.id || "");

  const esNuevo = await registrarEntrante(msg.id, de, textoLog);
  if (!esNuevo) return; // Meta reenvió un mensaje que ya atendimos
  marcarLeido(msg.id);

  // El empleado también puede escribirle al bot (así WhatsApp le permite recibir avisos 24 h).
  // Si escribe "panel" o "empleado" recibe el enlace al panel; cualquier otro mensaje sigue
  // el flujo normal de cliente (útil para hacer la demostración con un solo celular).
  const empleado = soloDigitos(env("EMPLEADO_WHATSAPP"));
  const pideP = ["panel", "empleado"].includes(normalizar(entrada.texto || ""));
  if (empleado && soloDigitos(de) === empleado && pideP) {
    await responder(de, [{ tipo: "texto", texto: `👷 Hola. Este número está registrado como *empleado* de La Pedrera.\nDurante las próximas 24 horas le llegarán aquí los avisos de solicitudes nuevas.\n\nPanel de solicitudes: ${sitio}/panel.html` }]);
    return;
  }

  const conv = await leerConversacion(de);
  const res = procesar(conv, entrada, { ahora: Date.now(), nombrePerfil });
  const respuestas = [...res.respuestas];
  let aviso = null;

  if (res.accion?.tipo === "crear_solicitud") {
    const d = res.accion.datos;
    const sol = await crearSolicitud(de, d);
    const codigo = codigoSolicitud(sol.id);
    respuestas.push(d.servicioId === "srv_asesor" ? mensajeConsultaRegistrada(codigo) : mensajeConfirmado(codigo, d));
    aviso = () => avisarEmpleado(sol, d, sitio);
  }
  if (res.accion?.tipo === "estado") {
    respuestas.push(mensajeEstado(await ultimaSolicitud(de)));
  }

  await guardarConversacion(de, nombrePerfil, res.paso, res.datos);
  await responder(de, respuestas);   // primero el cliente
  if (aviso) await aviso();           // luego el aviso al empleado
}

function leerEntrada(msg) {
  if (msg.type === "text") return { tipo: "texto", texto: msg.text?.body || "" };
  if (msg.type === "interactive") {
    const r = msg.interactive?.button_reply || msg.interactive?.list_reply;
    if (r) return { tipo: "opcion", id: r.id, texto: r.title };
  }
  if (msg.type === "button") return { tipo: "texto", texto: msg.button?.text || "" };
  return { tipo: "otro" };
}

async function responder(para, mensajes) {
  for (const m of mensajes) {
    const r = await enviar(para, m);
    if (!r.ok) console.error(`No se pudo enviar a ${para}:`, r.error);
    await registrarSaliente(r.id, para, "bot", textoHistorial(m) + (r.ok ? "" : `\n⚠️ No enviado: ${r.error}`));
  }
}

async function avisarEmpleado(sol, d, sitio) {
  const empleado = soloDigitos(env("EMPLEADO_WHATSAPP"));
  if (!empleado) return;
  const texto =
    `🔔 *Nueva solicitud ${codigoSolicitud(sol.id)}*\n\n` +
    (d.servicioId === "srv_asesor" ? `*Consulta:* ${d.detalle}` : resumen(d)) +
    `\n*Cliente:* +${sol.telefono}\n\nVer y responder: ${sitio}/panel.html`;
  const r = await enviar(empleado, { tipo: "texto", texto });
  if (!r.ok) console.warn("Aviso al empleado no enviado (el empleado debe escribirle al bot al menos una vez cada 24 h):", r.error);
}

export const config = { path: "/api/whatsapp" };
