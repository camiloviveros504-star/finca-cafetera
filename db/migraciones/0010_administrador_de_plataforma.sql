-- El administrador es el de la PLATAFORMA: crea fincas y cuentas, define ajustes, atiende los derechos de datos personales y
-- consulta todo en solo lectura. La operación de cada finca (ventas, cosechas, pagos, compras, aplicaciones, inventario,
-- trabajadores, lotes) es del propietario y de su equipo: así nadie ajeno a la finca puede mover su dinero ni sus existencias.
DELETE FROM rol_permiso rp
 USING rol r, permiso p
 WHERE rp.rol_id = r.id AND rp.permiso_id = p.id AND r.codigo = 'administrador'
   AND p.codigo NOT LIKE '%:ver'
   AND p.codigo NOT IN ('finca:administrar', 'usuario:administrar', 'usuario:invitar_equipo', 'configuracion:modificar', 'datos_personales:gestionar');
