# Distribuciones La Pedrera S.A.S. · Sitio web + bot de WhatsApp

Proyecto de demostración (prueba de habilidades) basado en la **Propuesta 2 – Opción A: Web + WhatsApp**.
Los datos de la empresa (rutas, horarios, cifras, ubicaciones, número de WhatsApp) son **de ejemplo**.

**En línea:** https://la-pedrera.netlify.app · Panel: https://la-pedrera.netlify.app/panel.html

## Qué incluye

| Parte | Qué hace | Dónde |
|---|---|---|
| Sitio web | Página informativa responsive: carrusel, servicios, mapa interactivo de rutas del río Caquetá (SVG), catálogo, video, ubicaciones con Google Maps, preguntas frecuentes, formulario que abre WhatsApp | `public/index.html`, `public/styles.css`, `public/app.js` |
| Bot de WhatsApp | Conversación paso a paso con botones y listas (servicio → nombre → carga → origen → destino → fecha → confirmación). Entrega un código `LP-0001`, responde *estado*, *menú*, *asesor* | `netlify/lib/bot.mjs`, `netlify/functions/whatsapp.mjs` |
| Base de datos | Postgres (Netlify Database): conversaciones, solicitudes e historial de mensajes | `netlify/database/migrations/` |
| Aviso al empleado | Cada solicitud nueva se envía por WhatsApp al número del empleado con enlace al panel | `whatsapp.mjs` → `avisarEmpleado` |
| Panel del empleado | Lista con filtros y búsqueda, cambio de estado (avisa al cliente), conversación completa y respuesta al cliente **desde el mismo número del bot** | `public/panel.*`, `netlify/functions/panel.mjs` |

## Arquitectura

```
Cliente (WhatsApp) ──► Meta Cloud API ──► POST /api/whatsapp (función Netlify)
                                              │  verifica firma X-Hub-Signature-256
                                              │  bot.mjs decide el siguiente paso
                                              ├──► Postgres: conversaciones · solicitudes · mensajes
                                              └──► Graph API: respuesta al cliente + aviso al empleado

Empleado (navegador) ──► /panel.html ──► /api/panel/* (clave) ──► Postgres / Graph API
```

- `netlify/lib/bot.mjs` es lógica **pura** (sin red ni base de datos): recibe el estado y el mensaje y devuelve el nuevo estado, las respuestas y una acción. Por eso se puede probar sola: `npm test`.
- Mensajes repetidos por Meta se descartan (`wa_id` único).
- El panel respeta la regla de WhatsApp de 24 horas: solo deja escribir libremente si el cliente escribió en las últimas 24 h.

## Variables de entorno (Netlify → Project configuration → Environment variables)

| Variable | Para qué |
|---|---|
| `WHATSAPP_TOKEN` | Token de acceso de la app de Meta |
| `WHATSAPP_PHONE_ID` | *Phone number ID* del número del bot |
| `WHATSAPP_VERIFY_TOKEN` | Texto inventado para verificar el webhook en Meta |
| `WHATSAPP_APP_SECRET` | *App secret* de Meta (verifica que los avisos vengan de Meta) |
| `EMPLEADO_WHATSAPP` | Número del empleado que recibe los avisos, ej. `573001234567` |
| `PANEL_CLAVE` | Clave para entrar al panel |

Revisión rápida de la configuración (no muestra valores): `GET /api/whatsapp`.

## Pruebas

```bash
npm test   # 24 pruebas de la conversación del bot
```
