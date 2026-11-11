# 04 · Estilo arquitectónico

Decisión: **monolito modular por capas** (detalle y alternativas en [ADR-001](adr/ADR-001-estilo-arquitectonico.md)).

## 1. Comparación de los tres estilos evaluados

Criterios sacados de los drivers y restricciones ([01](01-drivers-y-restricciones.md)). Se califica con ++ (favorece), + (neutral o aceptable), − (perjudica), −− (perjudica fuerte).

| Criterio | Monolito modular por capas | Microservicios | Orientada a eventos (broker) |
|---|---|---|---|
| D1 Consistencia: validar y descontar en una sola operación atómica | ++ Una transacción ACID en una base | −− Inventario y ventas en servicios distintos exigen sagas o consistencia eventual; una venta podría confirmarse antes de descontar | − Descuento asíncrono por eventos: ventana donde dos ventas ven el mismo saldo |
| D2 Trazabilidad: cadena cosecha → venta | ++ Claves foráneas y una sola consulta | − Los datos se reparten; trazar exige unir varios servicios | + Un log de eventos es buen historial, pero hay que reconstruir el estado |
| D3 Seguridad: autorización y aislamiento | + Un solo punto de control y una sola superficie | − Autorización repetida y autenticación entre servicios | + Depende del broker y de cada consumidor |
| C-03 Presupuesto cero | ++ Una aplicación y una base | −− Varios despliegues; los planes gratuitos no lo soportan bien | −− Un broker gestionado cuesta o se limita |
| C-07 Equipo de 3 | ++ Un repositorio y un proceso | −− Costo operativo alto para 3 personas | − Operar y depurar flujos asíncronos |
| C-08 Plazo de 2 días | ++ | −− | −− |
| C-02 Conectividad limitada | + La cola vive en el cliente en cualquier estilo | + | + |
| Escalado independiente por módulo | −− No es posible | ++ | + |
| Despliegue independiente por módulo | −− No es posible | ++ | + |

## 2. Por qué se elige el monolito modular por capas

1. **D1 manda.** La regla "no vender más de lo disponible" se resuelve con una transacción sobre una sola base: se bloquea la fila de existencias, se valida, se descuenta y se registra la venta, o no pasa nada. Con servicios separados habría que coordinar entre ellos (sagas, compensaciones) y aparecería una ventana de inconsistencia que es justo lo que el driver prohíbe.
2. **D3 pide un punto único de control.** Con un solo proceso, cada operación pasa por una capa de aplicación que autoriza antes de tocar el dominio. Se puede comprobar con una regla automática de dependencias.
3. **Las restricciones C-03, C-07 y C-08** (presupuesto cero, equipo de 3, plazo corto) hacen inviable operar varios servicios o un broker.

## 3. Capas y dirección de las dependencias

```
Presentación (src/app: páginas, Server Actions, Route Handlers)
        │ depende de
        ▼
Aplicación (src/modules/<contexto>/application: casos de uso, autorización, validación de entrada)
        │ depende de
        ▼
Dominio (src/modules/<contexto>/domain: entidades, reglas, errores tipados, puertos)
        ▲ implementa
        │
Infraestructura (src/modules/<contexto>/infrastructure: repositorios PostgreSQL, ORM)
```

Reglas, que se verifican en CI con dependency-cruiser:

- Presentación no importa infraestructura ni el ORM ni el cliente de base de datos.
- El dominio no importa nada de aplicación, infraestructura ni presentación.
- La infraestructura depende del dominio (implementa sus puertos) y nunca de la aplicación ni de la presentación.
- Un módulo solo usa a otro a través de su capa de aplicación (su API pública), nunca de su dominio o infraestructura.

## 4. Qué se sacrifica y por qué es aceptable

| Se sacrifica | Por qué es aceptable ahora | Cuándo dejaría de serlo |
|---|---|---|
| Escalado independiente por módulo (por ejemplo, solo ventas) | La carga esperada es la de una finca o un grupo pequeño de fincas, y el cuello de botella real será la base, no el cómputo. | Si el volumen creciera diez veces, el primer punto de presión es la contención sobre las filas de existencias y el número de conexiones a PostgreSQL (ver fichas de sustentación). |
| Despliegue independiente por módulo | Un equipo de 3 despliega todo junto y prefiere una sola unidad probada. | Si varios equipos trabajaran en módulos distintos. |
| Aislamiento de fallos (un módulo con error puede afectar a todo el proceso) | Las funciones serverless limitan el impacto a la solicitud. | Si un módulo tuviera carga o riesgo muy distinto. |
| Libertad tecnológica por módulo | Un solo lenguaje y un solo ORM simplifican el mantenimiento. | Si un módulo requiriera otra tecnología. |

La separación en módulos con contratos por la capa de aplicación deja abierta la puerta a extraer un módulo más adelante sin rehacer el diseño.
