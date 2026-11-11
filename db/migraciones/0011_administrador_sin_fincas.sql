-- El administrador de la plataforma no pertenece a ninguna finca: las ve todas en solo lectura y no opera ninguna.
-- Se quitan las asignaciones de finca que quedaron de la instalación anterior (que creaba una "finca principal" y se la
-- asignaba). Solo afecta a cuentas cuyo único rol es administrador.
DELETE FROM usuario_finca uf
 WHERE NOT EXISTS (
   SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id
    WHERE ur.usuario_id = uf.usuario_id AND r.codigo <> 'administrador'
 );
