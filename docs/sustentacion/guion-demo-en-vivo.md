# Guion de la demo en vivo (paso a paso)

Duración objetivo: **3 minutos** dentro de los 7. Todas las cuentas son de demostración (contraseña `Demo-2026!`). Antes de empezar: ejecutar la lista de verificación del final.

## Preparación (una vez, antes de entrar al salón)
1. Tener abiertas dos ventanas del navegador: una **normal** y una de **incógnito** (dos usuarios a la vez).
2. Tener la demo en dos lugares: **local** (`npm run iniciar:ejemplo`, http://localhost:3000, con los datos de ejemplo cargados) y **desplegada** (URL en el README). Si la desplegada tarda en responder por arranque en frío, abrirla 5 minutos antes.
3. Reiniciar los datos de demostración si quedaron modificados: `npm run db:reset` (local).

## Paso 1 · Quién eres define lo que puedes hacer (D3) — 45 s
1. Ventana normal: iniciar sesión como **comercial@demo.local**. Mostrar el menú: Ventas, Clientes, Cartera, Inventario… **sin** Finanzas ni Usuarios.
2. Ventana de incógnito: **produccion@demo.local**. Menú sin Ventas.
3. En la ventana de producción escribir `/ventas/nueva` en la barra de direcciones → "No tiene permiso". Decir: *"el menú oculta, pero quien decide es el servidor; y este intento quedó en la auditoría"*.
4. Entrar como **admin@demo.local** → **Auditoría** → filtrar "Denegados": aparece el intento que acabamos de hacer, con usuario, hora e IP.

## Paso 2 · Una venta nunca supera las existencias (D1) — 60 s
1. Como comercial: **Inventario** → ver Pergamino seco DEMO, lote L-01 con 60 kg y L-02 con 40 kg.
2. **Ventas → Registrar venta**: producto Pergamino seco DEMO, **cantidad 999999** → mensaje claro: "Existencias insuficientes: disponibles 100 kg". Decir: *"no queda nada a medias: no hay movimientos de una venta rechazada"*.
3. Registrar una venta de **1 kg** → pasa a la pantalla de **trazabilidad**: venta → lote de origen → cosechas del lote (D2).
4. Mostrar la evidencia de concurrencia (no se hace en vivo): abrir `docs/pruebas/informe-de-pruebas.md`, fila QA-01: *"1.000 rondas × 50 solicitudes simultáneas sobre 60 kg: 1.000 confirmadas, 49.000 rechazadas, 0 saldos negativos"*.

## Paso 3 · Conectividad limitada (ADR-003) — 45 s
1. Ventana del encargado de producción (**produccion@demo.local**) → **Cosechas → Registrar cosecha** (4 pasos en celular; abrir las herramientas de desarrollo en tamaño de celular).
2. En las herramientas del navegador: pestaña Red → **Sin conexión**. Completar el registro. Mostrar el indicador "Sin conexión · 1 pendiente" y que el registro figura como **PENDIENTE**, nunca como confirmado.
3. Volver a **En línea** → el indicador pasa a "En línea" y el registro a "Sincronizada" sin tocar nada. Decir: *"el identificador único del registro evita que se duplique si la red se corta a medias"*.

## Paso 4 · Una tarifa nueva no cambia el pasado (QA-12) — 30 s
1. Como **admin@demo.local** → **Tarifas**: mostrar el precio del pergamino y su historial de versiones.
2. Crear una versión nueva con vigencia desde mañana; mostrar que las ventas ya hechas conservan su precio y que no se permite una vigencia en el pasado.

## Si algo falla en vivo
| Síntoma | Qué hacer |
|---|---|
| La URL desplegada tarda | Es el arranque en frío del plan gratuito: esperar 20–30 s o pasar a la demo local |
| Error al iniciar sesión | Verificar que la contraseña sea `Demo-2026!`; tras 5 fallos la cuenta se bloquea 15 min (usar otro usuario) |
| Datos modificados por ensayos | `npm run db:reset` en local; en producción, ver `docs/despliegue.md` |
| La base de Render expiró | Seguir la recreación de `docs/despliegue.md` (medida en QA-14) y usar la demo local mientras tanto |

## Lista de verificación 15 minutos antes
- [ ] `docker compose up -d` o `npm run iniciar:ejemplo` responde 200 en `/login`.
- [ ] La URL desplegada responde 200 en `/login` (la primera vez puede tardar).
- [ ] Inicia sesión `comercial@demo.local` y `produccion@demo.local` en las dos ventanas.
- [ ] Inventario muestra 60 kg y 40 kg de pergamino seco en la finca El Mirador.
- [ ] Fecha de creación de la base de Render anotada y vigente (expira a los 30 días).
