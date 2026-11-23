/* =====================================================================
   Acceso a la base de datos (Netlify Database / Postgres)
   Las tablas se crean con la migración de netlify/database/migrations.
   ===================================================================== */
import { getDatabase } from "@netlify/database";

let _db;
const db = () => (_db ??= getDatabase());
const filas = (r) => (Array.isArray(r) ? r : r?.rows ?? []);

/* ---------- Conversaciones ---------- */
export async function leerConversacion(telefono) {
  const [c] = filas(await db().sql`SELECT paso, datos, actualizado FROM conversaciones WHERE telefono = ${telefono}`);
  if (!c) return null;
  return { paso: c.paso, datos: typeof c.datos === "string" ? JSON.parse(c.datos) : c.datos || {}, actualizado: new Date(c.actualizado).getTime() };
}

export async function guardarConversacion(telefono, nombrePerfil, paso, datos) {
  await db().sql`
    INSERT INTO conversaciones (telefono, nombre_perfil, paso, datos, actualizado)
    VALUES (${telefono}, ${nombrePerfil || null}, ${paso}, ${JSON.stringify(datos || {})}::jsonb, NOW())
    ON CONFLICT (telefono) DO UPDATE
      SET nombre_perfil = COALESCE(EXCLUDED.nombre_perfil, conversaciones.nombre_perfil),
          paso = EXCLUDED.paso, datos = EXCLUDED.datos, actualizado = NOW()`;
}

/* ---------- Mensajes ---------- */
// Devuelve false si el mensaje ya se había procesado (Meta a veces reenvía)
export async function registrarEntrante(waId, telefono, texto) {
  const r = filas(await db().sql`
    INSERT INTO mensajes (wa_id, telefono, direccion, autor, texto)
    VALUES (${waId}, ${telefono}, 'entrante', 'cliente', ${texto})
    ON CONFLICT (wa_id) DO NOTHING
    RETURNING id`);
  return r.length > 0;
}

export async function registrarSaliente(waId, telefono, autor, texto) {
  await db().sql`
    INSERT INTO mensajes (wa_id, telefono, direccion, autor, texto)
    VALUES (${waId || null}, ${telefono}, 'saliente', ${autor}, ${texto})`;
}

export async function mensajesDe(telefono, limite = 60) {
  return filas(await db().sql`
    SELECT * FROM (
      SELECT id, direccion, autor, texto, creado FROM mensajes
      WHERE telefono = ${telefono} ORDER BY creado DESC, id DESC LIMIT ${limite}
    ) m ORDER BY creado ASC, id ASC`);
}

/* ---------- Solicitudes ---------- */
export async function crearSolicitud(telefono, d) {
  const [s] = filas(await db().sql`
    INSERT INTO solicitudes (telefono, nombre, servicio, detalle, origen, destino, fecha_deseada)
    VALUES (${telefono}, ${d.nombre || null}, ${d.servicio}, ${d.detalle || null},
            ${d.origen || null}, ${d.destino || null}, ${d.fecha || null})
    RETURNING *`);
  return s;
}

export async function ultimaSolicitud(telefono) {
  const [s] = filas(await db().sql`SELECT * FROM solicitudes WHERE telefono = ${telefono} ORDER BY creado DESC LIMIT 1`);
  return s || null;
}

export async function listarSolicitudes() {
  return filas(await db().sql`
    SELECT s.*,
      (SELECT MAX(creado) FROM mensajes m WHERE m.telefono = s.telefono AND m.direccion = 'entrante') AS ultimo_entrante
    FROM solicitudes s ORDER BY s.creado DESC LIMIT 300`);
}

export async function cambiarEstado(id, estado) {
  const [s] = filas(await db().sql`
    UPDATE solicitudes SET estado = ${estado}, actualizado = NOW() WHERE id = ${id} RETURNING *`);
  return s || null;
}

export async function ultimoEntrante(telefono) {
  const [m] = filas(await db().sql`
    SELECT MAX(creado) AS creado FROM mensajes WHERE telefono = ${telefono} AND direccion = 'entrante'`);
  return m?.creado ? new Date(m.creado).getTime() : null;
}
