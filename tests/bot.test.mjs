import { procesar, mensajeConfirmado, codigoSolicitud, resumen } from "../netlify/lib/bot.mjs";
let fallos = 0;
const ok = (c, m) => { if (!c) { fallos++; console.log("  ✗", m); } else console.log("  ✓", m); };
const T = (texto) => ({ tipo: "texto", texto });
const O = (id, texto = "") => ({ tipo: "opcion", id, texto });
const ctx = { nombrePerfil: "Ana Gómez", ahora: 1_000_000_000 };
function run(pasos, conv = { paso: "inicio", datos: {} }, c = ctx) {
  let res;
  for (const e of pasos) { res = procesar(conv, e, c); conv = { paso: res.paso, datos: res.datos, actualizado: c.ahora }; }
  return { res, conv };
}
const limites = (msgs) => msgs.every(m => {
  if (m.tipo === "botones") return m.botones.length <= 3 && m.botones.every(b => b.titulo.length <= 20 && b.id.length <= 256) && m.texto.length <= 1024;
  if (m.tipo === "lista") return m.boton.length <= 20 && m.filas.length <= 10 && m.filas.every(f => f.titulo.length <= 24 && (!f.descripcion || f.descripcion.length <= 72)) && m.texto.length <= 1024;
  return m.texto.length <= 4096;
});

console.log("1. Flujo completo de mercancía con botones");
let { res, conv } = run([T("hola")]);
ok(res.paso === "servicio" && res.respuestas[0].tipo === "lista", "saludo con lista de servicios");
ok(limites(res.respuestas), "lista respeta límites de WhatsApp");
({ res, conv } = run([O("srv_mercancia"), O("nombre_perfil"), T("15 bultos de cemento"), O("org_pedrera"), O("dst_miriti"), O("fch_semana")], conv));
ok(res.paso === "confirmar" && res.respuestas[0].tipo === "botones", "llega a confirmar");
ok(res.respuestas[0].texto.includes("Mirití-Paraná") && res.respuestas[0].texto.includes("15 bultos"), "resumen correcto");
({ res } = run([O("conf_si")], conv));
ok(res.accion?.tipo === "crear_solicitud" && res.accion.datos.destino === "Mirití-Paraná" && res.accion.datos.nombre === "Ana Gómez", "acción crear_solicitud con datos");
ok(res.paso === "fin", "pasa a fin");

console.log("2. Víveres escribiendo todo a mano (sin botones)");
({ res, conv } = run([T("Buenas"), T("1"), T("Pedro Ruiz"), T("2 bultos de arroz"), T("Araracuara"), T("viernes 28"), T("sí")]));
ok(res.accion?.datos.servicio === "Venta de víveres" && res.accion.datos.origen === "Bodega La Pedrera", "víveres no pregunta origen");
ok(res.accion.datos.destino === "Araracuara" && res.accion.datos.fecha === "viernes 28" && res.accion.datos.nombre === "Pedro Ruiz", "datos escritos guardados");

console.log("3. Mensaje prellenado desde la web salta al servicio");
({ res } = run([T("Hola, necesito transporte de combustible.")]));
ok(res.paso === "nombre" && res.datos.servicioId === "srv_combustible" && res.respuestas.length === 2, "detecta combustible y pide nombre");
({ res } = run([T("Hola, quiero reservar cupo en la próxima salida.")]));
ok(res.paso === "servicio", "mensaje genérico muestra el menú");

console.log("4. Comandos: asesor, estado, menú, cancelar");
({ res, conv } = run([T("asesor")]));
ok(res.paso === "asesor_motivo", "asesor de entrada");
({ res } = run([T("Necesito precio de flete a Leticia")], conv));
ok(res.accion?.datos.servicio === "Consulta con asesor" && res.accion.datos.detalle.includes("Leticia"), "consulta con asesor registrada");
({ res } = run([T("Estado")], { paso: "fin", datos: {} }));
ok(res.accion?.tipo === "estado", "estado devuelve acción");
({ res } = run([T("menú")], { paso: "fin", datos: {} }));
ok(res.paso === "servicio", "menú reinicia desde fin");
({ res } = run([T("cancelar")], { paso: "fecha", datos: { servicio: "x" } }));
ok(res.paso === "servicio" && !res.datos.servicio, "cancelar borra datos");

console.log("5. Robustez");
({ res } = run([T("blablá")], { paso: "servicio", datos: {} }));
ok(res.paso === "servicio" && res.respuestas[0].texto.includes("No le entendí"), "opción inválida repite lista");
({ res } = run([{ tipo: "otro" }], { paso: "destino", datos: { servicioId: "srv_mercancia" } }));
ok(res.paso === "destino" && res.respuestas[0].texto.includes("solo entiendo"), "audio/foto: aviso sin perder el paso");
({ res } = run([T("hola")], { paso: "fecha", datos: { servicio: "x" }, actualizado: ctx.ahora - 7 * 3600e3 }));
ok(res.paso === "servicio", "conversación vieja (7 h) reinicia");
({ res, conv } = run([T("gracias")], { paso: "fin", datos: {} }));
ok(res.respuestas.length === 1, "en fin: primer mensaje recibe aviso");
({ res } = run([T("ok ya")], conv));
ok(res.respuestas.length === 0, "en fin: no repite el aviso enseguida");
({ res } = run([T("x")], { paso: "nombre", datos: { servicioId: "srv_mercancia" } }, { ahora: ctx.ahora }));
ok(res.paso === "nombre", "nombre de 1 letra no se acepta");
({ res } = run([T("hola")], undefined, { ahora: ctx.ahora }));
ok(res.respuestas[0].texto.startsWith("¡Hola! 👋"), "sin nombre de perfil saluda sin nombre");

console.log("6. Formatos");
ok(codigoSolicitud(7) === "LP-0007", "código LP-0007");
ok(limites([mensajeConfirmado("LP-0001", { servicio: "Venta de víveres", servicioId: "srv_viveres", nombre: "Ana", detalle: "arroz", origen: "x", destino: "Araracuara", fecha: "hoy" })]), "mensaje de confirmación dentro de límites");

console.log(fallos ? `\n${fallos} FALLOS` : "\nTodas las pruebas pasan");
process.exit(fallos ? 1 : 0);
