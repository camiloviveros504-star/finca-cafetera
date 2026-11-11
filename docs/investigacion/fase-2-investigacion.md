# Fase 2 · Investigación de la administración cafetera colombiana

Fecha de consulta: 2026-11-10. Cada afirmación lleva su fuente y un estado:
**Verificado** (leído en la fuente), **Parcial** (confirmado solo en fuente secundaria o en un resumen de búsqueda) o **Pendiente** (no se encontró; no se usa como dato en el sistema).

## 1. Unidades y equivalencias del café

| Afirmación | Estado | Fuente | Consecuencia de diseño |
|---|---|---|---|
| El precio interno de referencia de la FNC se expresa por **carga de 125 kg de café pergamino seco**. | Parcial | Reportes de prensa que citan el informe de la FNC: [La República](https://www.larepublica.co/economia/como-se-ha-comportado-el-precio-del-cafe-en-diciembre-4297418), [Agronegocios](https://www.agronegocios.co/mercados/precio-de-la-carga-interna-de-cafe-aumento-cerca-de-4-5-y-se-ubico-en-2-22-millones-4448659). Fuente primaria: [FNC, cómo se fija el precio](https://federaciondecafeteros.org/coffee-grower-services/learn-to-sell-your-coffee/?lang=en) (la página no pudo leerse en la consulta; hay que revisarla a mano). | La carga (125 kg) es una unidad configurable, no una constante. |
| La **arroba de café = 12,5 kg**, es decir 1/10 de carga. | Parcial | Se deduce de reportes de precios de Almacafé donde arroba = 12,5 × precio por kilo (resumen de búsqueda sobre prensa). No se encontró definición primaria de la FNC. | Se guarda como conversión con factor, ámbito (general o finca) y vigencia, tal como pide la sección 8. No se asume un factor único. |
| **Factor de rendimiento (FR)**: kg de pergamino seco necesarios para obtener un saco de 70 kg de excelso. Ejemplo: FR 94. Menor FR implica mejor calidad y mayor precio. | Parcial | Resumen de búsqueda sobre [Cenicafé, avance técnico 316](https://biblioteca.cenicafe.org/bitstream/10778/388/1/avt0316.pdf) y [Cenicafé, Calidad café](https://biblioteca.cenicafe.org/bitstream/10778/1033/1/Calidad%20caf%C3%A9.pdf). | El FR es un atributo del lote o de la partida, no una constante. Se modela en la transformación pergamino → excelso. |
| Con FR 94, la carga de 125 kg rinde ≈ 93,09 kg de excelso (125 × 70 / 94). | Cálculo propio | Aritmética sobre la definición anterior. | Sirve como caso de prueba del módulo de transformaciones. |
| Humedad comercial del pergamino seco: **10 % a 12 %** (base húmeda). | Parcial | Resumen de búsqueda sobre [Cenicafé, método de humedad en secado solar](https://biblioteca.cenicafe.org/handle/10778/188) y [Cenicafé 61(2):108-118](https://biblioteca.cenicafe.org/bitstream/10778/488/1/arc061(02)108-118.pdf). | Parámetro de calidad configurable en la etapa de secado. |
| Promedio nacional de FR citado por Cenicafé: 92,8. | Parcial | Mismo resumen. Las fuentes lo describen de forma distinta (promedio frente a valor óptimo). | No se usa como meta del sistema. Solo se menciona como contexto. |

Los precios de la carga cambian a diario. Ningún precio real entra al código ni a la base. Los datos semilla de precios van marcados **DEMO** (sección 6 del prompt).

## 2. Etapas del beneficio y la poscosecha

| Afirmación | Estado | Fuente |
|---|---|---|
| El beneficio por vía húmeda en Colombia incluye despulpado, remoción del mucílago (natural, con enzimas o mecánica), lavado y secado, hasta llegar a pergamino seco. | Parcial | Resumen de búsqueda sobre [Cenicafé, Cartilla 20 · Beneficio del café](https://www.cenicafe.org/es/publications/cartilla_20_beneficio_del_cafe.pdf) y [Cenicafé, avance técnico 323](https://biblioteca.cenicafe.org/bitstream/10778/419/1/avt0323.pdf). La lectura directa de la cartilla falló (HTTP 404). |
| Cenicafé clasifica los beneficiaderos (convencional, en transición, ecológico, ecológico sin vertimientos) según el consumo de agua. Los ecológicos usan menos de 10 L por kg de pergamino seco. | Parcial | Mismo resumen. |
| La cadena de producto del prompt (cereza → pergamino húmedo → pergamino seco → excelso) coincide con estas etapas. La trilla (pergamino seco → excelso y pasilla) es el paso que define el FR. | Parcial | Los dos puntos anteriores. |
| La secuencia exacta de etapas varía según la finca. Por eso los flujos de proceso son configurables por tipo de producto, como pide la sección 9. | Decisión de diseño | Derivado de que Cenicafé describe más de una tecnología de beneficio. |

Pendiente: confirmar con la Cartilla 20 directamente la tabla de etapas, para citar páginas exactas en el documento final.

## 3. Protección de datos personales (Colombia)

| Afirmación | Estado | Fuente |
|---|---|---|
| El régimen general está en la **Ley 1581 de 2012**. El art. 8 consagra los derechos del titular, entre ellos revocar la autorización y pedir la supresión del dato. | Parcial | Conceptos de la SIC, vía búsqueda: [SIC concepto 15-039288](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Concepto_15-039288.pdf), [Supersociedades, ley de protección de datos](https://supersociedades.gov.co/ley-de-proteccion-de-datos). |
| El **Decreto 1377 de 2013** reglamenta la ley y sus artículos se compilaron en el **Decreto Único 1074 de 2015**. Por ejemplo, la autorización del titular está en el art. 2.2.2.25.2.2. | Parcial | [Decreto 1377 de 2013, texto](https://normograma.invima.gov.co/normograma/docs/pdf/decreto_1377_2013.pdf) y los conceptos de la SIC anteriores. |
| El titular solo puede presentar queja ante la SIC después de agotar la consulta o el reclamo ante el responsable. | Parcial | Conceptos de la SIC. |

Ajuste al prompt: en `docs/proteccion-datos.md` se cita la Ley 1581 y el Decreto 1074 de 2015 (compilación), con el Decreto 1377 de 2013 como origen. Antes de entregar hay que revisar la vigencia del articulado en la SIC o en SUIN-Juriscol, y que el equipo no la presente como asesoría jurídica.

## 4. Condiciones de las plataformas elegidas

| Afirmación | Estado | Fuente |
|---|---|---|
| Render Postgres Free **expira a los 30 días** de su creación. | **Verificado** | [Render, Deploy for Free](https://render.com/docs/free) |
| Hay **14 días de gracia** para pasar a plan pago. Después Render borra la base con sus datos. | **Verificado** | Misma página |
| Almacenamiento fijo de **1 GB**. | **Verificado** | Misma página |
| **Sin copias de seguridad** de ningún tipo. | **Verificado** | Misma página |
| Solo **una** base gratuita activa por workspace. | **Verificado** | Misma página |
| Render puede **reiniciar** la base en cualquier momento. | **Verificado** | Misma página |
| **Sin pool de conexiones administrado.** La página no publica un límite numérico de conexiones. | **Verificado** | Misma página |
| Vercel Hobby es solo para **uso personal no comercial**. Pedir donaciones no cuenta como uso comercial. | **Verificado** | [Vercel, Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (actualizada 2026-09-14) |
| Guías de uso mensual en Hobby: 100 GB de transferencia rápida, 1.000.000 de invocaciones, 4 h de CPU activa, 360 GB-h de memoria, **5.000 transformaciones de imagen por mes**. | **Verificado** | Misma página |

Consecuencias:
- Los usuarios de la sustentación son un uso académico, compatible con Hobby. Si el sistema pasara a uso real con cobro, habría que pasar a Pro. Se documenta en `docs/despliegue.md`.
- El límite de 5.000 transformaciones de imagen es una restricción real. Con 11 imágenes en dos tamaños el consumo es bajo, pero se mide.
- La falta de pool y de respaldos en Render confirma el riesgo que describe la sección 16 del prompt. Se documenta como riesgo con prueba de carga (QA-10 y QA-11).

## 5. Pendientes de la fase

1. Leer la fuente primaria de la FNC sobre la carga de 125 kg y el FR de referencia, y buscar una definición oficial de la arroba.
2. Leer directamente la Cartilla 20 de Cenicafé para citar páginas.
3. Revisar en la SIC la vigencia del Decreto 1074 de 2015 (libro 2, parte 2, título 2, capítulos 25 y 26).
4. Cualquier cifra marcada "Parcial" se muestra en la documentación final como tal, o se reemplaza por la lectura primaria.

## 6. Qué cambia en el diseño por esta investigación

- Carga, arroba y FR son parámetros con vigencia, no constantes. Esto respalda la sección 6 y el escenario QA-12.
- El FR hace que la trazabilidad pergamino → excelso necesite un registro de transformación con rendimiento propio, lo que respalda el requisito R-06.
- Las limitaciones de Render Free (sin respaldos, sin pool, reinicios) justifican `npm run db:reset`, `pg_dump` antes de la sustentación y el pool limitado.
