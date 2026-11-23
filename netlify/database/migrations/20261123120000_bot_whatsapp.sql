-- Bot de WhatsApp y panel de solicitudes — Distribuciones La Pedrera

-- En qué paso va la conversación de cada número
CREATE TABLE conversaciones (
  telefono      TEXT PRIMARY KEY,
  nombre_perfil TEXT,
  paso          TEXT NOT NULL DEFAULT 'inicio',
  datos         JSONB NOT NULL DEFAULT '{}'::jsonb,
  actualizado   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada solicitud confirmada por un cliente
CREATE TABLE solicitudes (
  id             SERIAL PRIMARY KEY,
  telefono       TEXT NOT NULL,
  nombre         TEXT,
  servicio       TEXT NOT NULL,
  detalle        TEXT,
  origen         TEXT,
  destino        TEXT,
  fecha_deseada  TEXT,
  estado         TEXT NOT NULL DEFAULT 'nueva'
                 CHECK (estado IN ('nueva', 'cotizada', 'confirmada', 'en_ruta', 'entregada', 'cancelada')),
  creado         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX solicitudes_telefono_idx ON solicitudes (telefono);
CREATE INDEX solicitudes_estado_idx ON solicitudes (estado);

-- Historial de mensajes (entrantes y salientes) para el panel
CREATE TABLE mensajes (
  id         SERIAL PRIMARY KEY,
  wa_id      TEXT UNIQUE,
  telefono   TEXT NOT NULL,
  direccion  TEXT NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
  autor      TEXT NOT NULL DEFAULT 'cliente' CHECK (autor IN ('cliente', 'bot', 'asesor')),
  texto      TEXT,
  creado     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX mensajes_telefono_idx ON mensajes (telefono, creado);
