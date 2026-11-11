# Trabajo futuro y límites conocidos

Todo lo que está aquí **no está construido** (o está construido solo en parte). No se presenta como hecho en ningún otro documento. Cada punto dice por qué quedó fuera.

## Funcionalidad que no se construyó
| Tema | Qué falta | Por qué quedó fuera |
|---|---|---|
| Caracterización de la finca | Linderos, vías de acceso, fuentes de agua, áreas de protección y de erosión, mapa de distribución (prompt §9) | Requiere datos geográficos y un componente de mapas; no afecta los tres drivers |
| Detalle de cultivos y lotes | Edad y densidad calculadas, zoca, renovación con historial por lote | Hoy hay variedad, número de árboles, fecha de siembra y estado productivo |
| Modalidad de pago "otras" | Modalidades de remuneración distintas de kg, arroba, jornada y actividad | El esquema usa cuatro modalidades con tarifa propia; agregar una exige una migración |
| Flujos de beneficio largos desde la pantalla | La pantalla crea flujos de hasta 3 etapas (el caso de uso admite hasta 15) y registra un lote por envío | Priorizar el núcleo; el caso de uso ya soporta varios lotes |
| Envío de correos de invitación | El enlace de activación lo entrega el administrador | No hay servicio de correo configurado |
| Segundo factor de autenticación y prueba de penetración | No hay 2FA ni auditoría de seguridad externa | Alcance y presupuesto |
| Política de contenido sin `'unsafe-inline'` | Requiere nonces por solicitud en Next.js | La hidratación actual los necesita |
| Notas de crédito | Una venta con pagos no puede anularse; hay que resolver el cobro | Requiere un nuevo documento contable |
| Reservas de inventario | Reservar existencias para un pedido con vencimiento | ADR-002 la descarta para el alcance actual; pedido → venta automático tampoco está |
| Reportes en PDF | Solo CSV | El prompt dice "PDF solo si da tiempo" |
| Conciliación bancaria | Hoy es una conciliación interna de los movimientos registrados | Requiere extractos bancarios |
| Captura sin conexión de actividades programadas | Solo cosechas, producción de trabajadores e inspecciones | Las actividades se programan desde un puesto con conexión |
| Aviso automático de vencimiento de datos personales | La política de conservación es manual | Requiere reglas de retención definidas por la organización |
| Trazabilidad por kilo | Hoy la trazabilidad es a nivel de **lote** | Seguir cada kilo exigiría identificar unidades físicas; ver ADR-002 y la ficha de D2 |
| Prueba con personas del tiempo de registro (QA-15) | Se midió con automatización | Requiere recolectores reales |
| Pruebas de carga contra Vercel + Render | Si no figuran en el informe, no se hicieron | Los planes gratuitos tienen límites de uso; ver `despliegue.md` |

## Límites de los planes gratuitos (verificados en la documentación oficial, ver investigación)
- **Render Postgres Free:** expira a los 30 días (más 14 de gracia), 1 GB, sin respaldos, una base por espacio de trabajo y sin pool de conexiones administrado.
- **Vercel Hobby:** uso no comercial únicamente; 5.000 transformaciones de imagen al mes (por eso las imágenes se sirven sin optimización de Vercel).
- Un sistema real para una organización necesitaría planes de pago, respaldos automáticos y revisar la licencia de uso comercial.

## Qué se rompe primero si el negocio crece diez veces
Ver las fichas en [`sustentacion/`](sustentacion/fichas-de-decision.md): contención sobre la fila de existencias (D1), tamaño de la tabla de movimientos frente al 1 GB de Render Free (D2) y conexiones de PostgreSQL (riesgo R-01).
