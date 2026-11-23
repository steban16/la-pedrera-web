/* =====================================================================
   API del panel del empleado — https://<sitio>/api/panel/...
   Protegida con la clave PANEL_CLAVE (encabezado "x-clave").
     GET  /api/panel/solicitudes            lista + conteo por estado
     GET  /api/panel/mensajes?telefono=...  conversación con un cliente
     POST /api/panel/estado     {id, estado, avisar}
     POST /api/panel/responder  {telefono, texto}
   ===================================================================== */
import crypto from "node:crypto";
import { ESTADOS, codigoSolicitud, mensajeCambioEstado } from "../lib/bot.mjs";
import { enviar, env } from "../lib/whatsapp-api.mjs";
import { listarSolicitudes, mensajesDe, cambiarEstado, registrarSaliente, ultimoEntrante } from "../lib/datos.mjs";

const VENTANA_MS = 24 * 60 * 60 * 1000;
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function claveValida(req) {
  const clave = env("PANEL_CLAVE");
  const dada = req.headers.get("x-clave") || "";
  if (!clave) return null;
  const a = crypto.createHash("sha256").update(clave).digest();
  const b = crypto.createHash("sha256").update(dada).digest();
  return crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  const valida = claveValida(req);
  if (valida === null) return json({ error: "Falta configurar PANEL_CLAVE en Netlify." }, 503);
  if (!valida) { await espera(600); return json({ error: "Clave incorrecta." }, 401); }

  const url = new URL(req.url);
  const ruta = url.pathname.replace(/^\/api\/panel\/?/, "");

  try {
    if (req.method === "GET" && ruta === "solicitudes") {
      const filas = await listarSolicitudes();
      const ahora = Date.now();
      const solicitudes = filas.map((s) => ({
        ...s,
        codigo: codigoSolicitud(s.id),
        estadoNombre: ESTADOS[s.estado] || s.estado,
        // Solo se puede escribir libremente al cliente si escribió en las últimas 24 h
        puedeResponder: s.ultimo_entrante ? ahora - new Date(s.ultimo_entrante).getTime() < VENTANA_MS : false,
      }));
      const resumen = Object.fromEntries(Object.keys(ESTADOS).map((e) => [e, 0]));
      solicitudes.forEach((s) => { resumen[s.estado] = (resumen[s.estado] || 0) + 1; });
      return json({ solicitudes, resumen, estados: ESTADOS });
    }

    if (req.method === "GET" && ruta === "mensajes") {
      const telefono = url.searchParams.get("telefono") || "";
      if (!/^\d{6,20}$/.test(telefono)) return json({ error: "Teléfono inválido." }, 400);
      return json({ mensajes: await mensajesDe(telefono) });
    }

    if (req.method === "POST" && ruta === "estado") {
      const { id, estado, avisar } = await req.json().catch(() => ({}));
      if (!Number.isInteger(id) || !ESTADOS[estado]) return json({ error: "Datos inválidos." }, 400);
      const sol = await cambiarEstado(id, estado);
      if (!sol) return json({ error: "No existe esa solicitud." }, 404);
      let aviso = null;
      if (avisar) {
        const msg = mensajeCambioEstado(sol);
        aviso = await enviar(sol.telefono, msg);
        if (aviso.ok) await registrarSaliente(aviso.id, sol.telefono, "asesor", msg.texto);
      }
      return json({ solicitud: { ...sol, codigo: codigoSolicitud(sol.id) }, aviso });
    }

    if (req.method === "POST" && ruta === "responder") {
      const { telefono, texto } = await req.json().catch(() => ({}));
      const limpio = String(texto || "").trim();
      if (!/^\d{6,20}$/.test(String(telefono || "")) || !limpio) return json({ error: "Escriba un mensaje." }, 400);
      if (limpio.length > 4000) return json({ error: "El mensaje es demasiado largo." }, 400);
      const ultimo = await ultimoEntrante(telefono);
      if (!ultimo || Date.now() - ultimo > VENTANA_MS) {
        return json({ ok: false, error: "Pasaron más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite escribirle de nuevo con una plantilla aprobada." }, 409);
      }
      const r = await enviar(telefono, { tipo: "texto", texto: limpio });
      if (r.ok) await registrarSaliente(r.id, telefono, "asesor", limpio);
      return json(r, r.ok ? 200 : 502);
    }

    return json({ error: "Ruta no encontrada." }, 404);
  } catch (err) {
    console.error("Error en el panel:", err);
    return json({ error: "Error del servidor. Revise los registros de la función en Netlify." }, 500);
  }
};

export const config = { path: "/api/panel/*" };
