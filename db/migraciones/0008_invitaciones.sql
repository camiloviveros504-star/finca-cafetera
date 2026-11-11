-- 0008 · Alta de usuarios por invitación: el administrador crea la cuenta y define los roles; la persona fija su propia
-- contraseña con un enlace de un solo uso. El administrador nunca conoce ni escribe la contraseña de nadie.

ALTER TABLE usuario ADD COLUMN activada_en timestamptz;   -- NULL = invitación pendiente de activar
UPDATE usuario SET activada_en = creado_en;               -- las cuentas existentes ya estaban activas
ALTER TABLE usuario ALTER COLUMN activada_en SET DEFAULT now(); -- toda cuenta nace activada, salvo las invitaciones (que lo piden en NULL)

CREATE TABLE invitacion_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizacion(id),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('alta','restablecimiento')),
  token_hash text NOT NULL UNIQUE,                        -- SHA-256 del token: el token nunca se guarda
  expira_en timestamptz NOT NULL,
  usada_en timestamptz,
  creada_por uuid REFERENCES usuario(id),
  creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitacion_usuario_idx ON invitacion_usuario (usuario_id) WHERE usada_en IS NULL;
