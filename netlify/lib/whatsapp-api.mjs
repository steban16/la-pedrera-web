/* =====================================================================
   Envío de mensajes por la API de WhatsApp (Cloud API de Meta)
   Variables de entorno (Netlify → Project configuration → Environment variables):
     WHATSAPP_TOKEN     token de acceso de Meta
     WHATSAPP_PHONE_ID  "Phone number ID" del número del bot (no es el número)
     GRAPH_VERSION      opcional, versión de la Graph API (por defecto v23.0)
   ===================================================================== */
import crypto from "node:crypto";

const env = (k, porDefecto = "") => (globalThis.Netlify?.env?.get(k) ?? process.env[k] ?? porDefecto);

/* Convierte un mensaje neutro del bot al formato de la API */
export function aPayload(para, msg) {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to: para };
  if (msg.tipo === "botones") {
    return {
      ...base, type: "interactive",
      interactive: {
        type: "button",
        body: { text: msg.texto },
        action: { buttons: msg.botones.map((b) => ({ type: "reply", reply: { id: b.id, title: b.titulo } })) },
      },
    };
  }
  if (msg.tipo === "lista") {
    return {
      ...base, type: "interactive",
      interactive: {
        type: "list",
        body: { text: msg.texto },
        action: {
          button: msg.boton,
          sections: [{
            title: msg.titulo || "Opciones",
            rows: msg.filas.map((f) => ({ id: f.id, title: f.titulo, ...(f.descripcion ? { description: f.descripcion } : {}) })),
          }],
        },
      },
    };
  }
  return { ...base, type: "text", text: { preview_url: false, body: msg.texto } };
}

/* Texto plano que se guarda en el historial para un mensaje del bot */
export function textoHistorial(msg) {
  if (msg.tipo === "botones") return `${msg.texto}\n[${msg.botones.map((b) => b.titulo).join("] [")}]`;
  if (msg.tipo === "lista") return `${msg.texto}\n[${msg.boton}: ${msg.filas.map((f) => f.titulo).join(", ")}]`;
  return msg.texto;
}

/* Envía un mensaje. Devuelve { ok, id, error } sin lanzar excepciones. */
export async function enviar(para, msg) {
  const token = env("WHATSAPP_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_ID");
  if (!token || !phoneId) return { ok: false, error: "Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en Netlify" };
  try {
    const res = await fetch(`https://graph.facebook.com/${env("GRAPH_VERSION", "v23.0")}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(aPayload(para, msg)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data?.error || {};
      // 131047: pasaron más de 24 h desde el último mensaje del cliente
      const fuera24h = e.code === 131047 || /24|re-engagement/i.test(e.message || "");
      return { ok: false, error: fuera24h ? "Pasaron más de 24 horas desde el último mensaje del cliente; WhatsApp solo permite responder con una plantilla aprobada." : (e.message || `Error ${res.status}`), codigo: e.code };
    }
    return { ok: true, id: data?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: `No se pudo conectar con WhatsApp: ${err.message}` };
  }
}

/* Marca como leído el mensaje del cliente (los dos chulitos azules) */
export async function marcarLeido(waId) {
  const token = env("WHATSAPP_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_ID");
  if (!token || !phoneId || !waId) return;
  try {
    await fetch(`https://graph.facebook.com/${env("GRAPH_VERSION", "v23.0")}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: waId }),
    });
  } catch { /* no es crítico */ }
}

/* Verifica que el aviso venga de verdad de Meta (firma X-Hub-Signature-256) */
export function firmaValida(cuerpoCrudo, firma) {
  const secreto = env("WHATSAPP_APP_SECRET");
  if (!secreto) return true; // sin secreto configurado no se verifica (solo para pruebas)
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = "sha256=" + crypto.createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex");
  const a = Buffer.from(esperada), b = Buffer.from(firma);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export { env };
