# Control de finca cafetera: qué se investigó y qué se construyó

Reestructuración del sistema alrededor del control real de una finca (noviembre de 2026). Este documento separa lo que dicen las fuentes de lo que decidió el equipo y de lo que **no** se encontró; nada de lo que no se encontró se inventó.

## Fuentes consultadas

| Fuente | Qué aportó |
|---|---|
| Cenicafé, Avance Técnico sobre renovación de cafetales ([AVT0484](https://biblioteca.cenicafe.org/bitstream/10778/4210/1/AVT0484.pdf)) | La duración del ciclo productivo depende de la edad, la variedad, la densidad, los sitios perdidos y el estado fitosanitario; la zoca es menos costosa que la siembra y da ciclos de 4 a 5 cosechas; la siembra permite ajustar densidad y arreglo; los lotes con variedades susceptibles a la roya se renuevan por siembra con variedades resistentes |
| Federación Nacional de Cafeteros, [Más agronomía, más productividad](https://federaciondecafeteros.org/static/files/masagronomiamasproductividad.pdf) | Densidades de siembra de referencia (unas 5.000 plantas por hectárea; más en variedades de porte bajo), calendario de siembra y zoca por región, edad promedio nacional del cultivo |
| Federación Nacional de Cafeteros, [ficha metodológica de costos](https://federaciondecafeteros.org/app/uploads/2024/06/Ficha_metodologica_Costos_versio%CC%81n-disen%CC%83o.pdf) | El programa de costos usa registros a nivel de finca (cuaderno de costos del Plan 2.000 Fincas) y participan unos 2.000 productores desde 2015 |
| Cenicafé (registros recomendados) | Registro de aplicación de productos por lote y registro de floración para proyectar la mano de obra de la cosecha |
| ICA, [Resolución 30021 de 2017](https://normograma.invima.gov.co/normograma/docs/pdf/resolucion_ica_30021_2017.pdf) (modificada por la 82394 de 2020) | Marco de Buenas Prácticas Agrícolas: tenencia del predio, asistencia técnica de un agrónomo y croquis con las áreas de cultivo |

Cifras agronómicas usadas en el plan de manejo, todas de Cenicafé: **58 g de nitrógeno por planta en los primeros 18 meses**, en cinco aplicaciones (meses 2, 6, 10, 14 y 18: 7, 9, 12, 14 y 16 g). En producción **no se fijó una dosis**: depende del análisis de suelo y de la producción esperada, y el sistema se lo deja al dueño.

## Qué se decidió con eso

| Necesidad que salió de la investigación | Cómo quedó en el sistema |
|---|---|
| El cultivo tiene ciclo: sin sembrar → levante → producción → renovación | Cada lote tiene estado, fecha de siembra, árboles y edad calculada; muestra si es **café nuevo, zoca o sin sembrar** |
| Renovar por zoca o por siembra | Eventos del lote (siembra, zoca, tumba, nota) con fecha y responsable; la edad se cuenta desde la última zoca |
| Densidad de referencia | Parámetro `arboles_por_hectarea` (por defecto 5.000), editable por finca; se sugiere al sembrar |
| Plan de abonada por edad | Tabla `recomendacion_cultivo` con la fuente de cada fila |
| Registro de aplicaciones por lote | Abonadas y fumigaciones por lote, con responsable, gramos por árbol, árboles del lote y carencia del producto |
| Cuaderno de costos de la finca | Gastos por tipo (incluidos fletes ligados a la venta), compras de insumos, pagos a trabajadores y cartera |
| Quién hace qué en una finca grande | Roles propietario, capataz y trabajador, además del administrador de la plataforma |

## Roles

| Rol | Alcance |
|---|---|
| Administrador | La plataforma: da de alta fincas y propietarios en un solo paso, administra cuentas y ajustes, atiende los derechos de datos personales y consulta todo en solo lectura. **No opera ninguna finca**: no vende, no registra cosechas, no compra ni paga (permisos retirados en la migración 0010) |
| Propietario | Todo lo de **su** finca: lotes, insumos, equipo, recolección, ventas, gastos, pagos. Invita a su capataz y a sus trabajadores |
| Capataz | Recolección, labores y aplicaciones del personal. No ve ventas, cartera ni pagos |
| Trabajador | Sus propios kilos, jornales y lo que le deben |

Cada finca ve solo sus propios compradores, proveedores e insumos; los datos sin finca son compartidos y solo los administra quien administra la plataforma.

## Lo que no se encontró o no se construyó

- La **dosis de abonada en producción por hectárea** no se obtuvo de una fuente verificable; no se incluyó.
- El **detalle de los registros de plaguicidas y de capacitación de trabajadores** que exige la norma de BPA del ICA no se encontró en los resultados; hay que leer el texto completo de la Resolución 30021 antes de afirmar cumplimiento. **El sistema no certifica BPA.**
- Un proyecto de resolución de 2024 podría reemplazar la 30021; no se verificó si se expidió.
- No hay registro de **floración**, **análisis de suelo**, **croquis del predio** ni **caracterización** (linderos, agua, vías). Están en `docs/trabajo-futuro.md`.
- El Sistema de Información Cafetera (SICA) de la Federación se menciona en su informe de gestión; no se encontró cómo se alimenta desde los libros de finca, y no hay integración.
