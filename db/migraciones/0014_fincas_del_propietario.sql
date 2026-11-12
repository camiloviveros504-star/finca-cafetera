-- Las fincas las crea cada propietario, no el administrador de la plataforma:
--   · el administrador crea la cuenta del propietario (sin finca) y después solo consulta qué fincas y lotes tiene cada uno;
--   · el propietario crea sus fincas (cada una con su nombre) y en cada finca sus lotes.
-- Cada finca guarda quién es su dueño (finca.propietario_id). El nombre de la finca es único por dueño: dos propietarios
-- distintos pueden tener una finca llamada igual. La relación finca → usuario no forma ciclo (usuario no apunta a finca).

INSERT INTO permiso (codigo, descripcion) VALUES ('finca:crear', 'Crear sus propias fincas') ON CONFLICT (codigo) DO NOTHING;
UPDATE permiso SET descripcion = 'Consultar todas las fincas de la plataforma y a sus propietarios' WHERE codigo = 'finca:administrar';

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM rol r, permiso p WHERE r.codigo = 'propietario' AND p.codigo = 'finca:crear'
ON CONFLICT DO NOTHING;

ALTER TABLE finca ADD COLUMN propietario_id uuid REFERENCES usuario(id);

-- Fincas existentes: su dueño es el propietario que ya la tenía asignada (el más antiguo, si había varios).
UPDATE finca f SET propietario_id = (
  SELECT u.id FROM usuario_finca uf
    JOIN usuario u ON u.id = uf.usuario_id
    JOIN usuario_rol ur ON ur.usuario_id = u.id
    JOIN rol r ON r.id = ur.rol_id AND r.codigo = 'propietario'
   WHERE uf.finca_id = f.id
   ORDER BY u.creado_en, u.id
   LIMIT 1
);

ALTER TABLE finca DROP CONSTRAINT finca_organizacion_id_nombre_key;
CREATE UNIQUE INDEX finca_nombre_por_propietario ON finca
  (organizacion_id, COALESCE(propietario_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
CREATE INDEX finca_propietario ON finca (propietario_id);
