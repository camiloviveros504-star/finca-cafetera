# Gestión de Finca Cafetera

Sistema para administrar lotes, cosechas, inventario por movimientos y ventas de una finca cafetera, con trazabilidad del lote a la venta. Proyecto académico de arquitectura de software (monolito modular por capas).

**Los tres drivers del Driver:** D1 consistencia del inventario, D2 trazabilidad de la producción, D3 seguridad y control de acceso. Restricciones: protección de datos personales y conectividad limitada.

> Sistema listo para desplegar. En el primer arranque **no hay datos**: se entra a `/instalacion` y se crean la organización y el administrador. Las pruebas automáticas usan un conjunto de datos de ejemplo marcado DEMO que nunca se carga por defecto.

## Requisitos

- Node.js 22 o superior y npm.
- Para la base de datos, **una** de estas dos opciones:
  - **Sin Docker:** nada más (el paquete `embedded-postgres` trae PostgreSQL real).
  - **Con Docker:** Docker Desktop.
- Google Chrome (solo para las pruebas E2E con Playwright).

## Arranque con un solo comando

```bash
npm install
npm run iniciar       # sin Docker: PostgreSQL real + migraciones + aplicación
# o bien
docker compose up     # con Docker: contenedores `app` y `db`
```

Abra http://localhost:3000: la primera vez lo lleva a **/instalacion**. Allí se ingresa el código de instalación (variable `CODIGO_INSTALACION`; en local por defecto `instalacion-local-0001`), el nombre de la organización y de la primera finca, y la cuenta del administrador. Esa pantalla solo funciona una vez. No se crea ningún precio, tarifa ni equivalencia: los define el administrador en **Tarifas** y **Ajustes**.

**Usuarios nuevos:** no hay registro público. En **Usuarios**, el administrador registra a la persona, elige sus roles y fincas (y, si es recolector o supervisor, la vincula con su ficha de trabajador) y entrega el enlace de un solo uso que genera el sistema; la persona crea su contraseña. El mismo mecanismo restablece contraseñas. Cada rol aterriza en su pantalla de trabajo al iniciar sesión.

**Datos de ejemplo (opcionales, para ensayos y para las pruebas E2E):** `npm run iniciar:ejemplo` o, con una base vacía, `CARGAR_DATOS_EJEMPLO=si npm run db:iniciar`. Cargan una organización marcada DEMO con usuarios `@demo.local` (contraseña `Demo-2026!`):

| Correo | Rol |
|---|---|
| admin@demo.local | Administrador |
| produccion@demo.local | Encargado de producción |
| comercial@demo.local | Responsable comercial |
| comercial2@demo.local | Responsable comercial de la otra finca (para probar el aislamiento) |

## Configuración

Copie `.env.example` a `.env`. Los secretos solo viven en variables de entorno, nunca en el repositorio.

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL. En Render: la URL **externa**, con `?sslmode=require`. |
| `SESSION_SECRET` | Cadena aleatoria de 32 o más caracteres. |
| `APP_URL` | URL pública de la aplicación. |
| `PG_POOL_MAX` | Conexiones por instancia (por defecto 5; Render Free no tiene pool propio). |

Comandos de base de datos: `npm run db:local` (PostgreSQL local), `npm run db:migrar`, `npm run db:reset` (borra, migra y siembra DEMO; bloqueado en producción).

## Pruebas

```bash
npm run db:local &     # PostgreSQL real para las pruebas (o use el servicio de CI)
npm test               # unitarias + integración + concurrencia contra PostgreSQL real
npm run capas          # regla de dependencias entre capas (evidencia del criterio 4)
npm run e2e            # Playwright: flujos con roles, sin conexión y 5 tamaños de pantalla
npm run tipos          # TypeScript estricto
npm run capas:probar   # QA-13: crea un atajo a propósito y comprueba que se detecta
npm run test:volumen   # QA-03: 100.000 movimientos y 10.000 cosechas (tarda unos minutos)
# QA-01 con 1.000 ejecuciones: RONDAS_CONCURRENCIA=1000 npx vitest run tests/concurrencia
# Carga con k6 (QA-10/11): npm run carga:preparar && k6 run pruebas-carga/mixto.js
node scripts/generar-informe.mjs   # arma docs/pruebas/informe-de-pruebas.md con las mediciones guardadas
```

Las pruebas crean una base temporal por archivo y la borran al terminar. Los resultados con fecha y comando están en `docs/pruebas/`. No se reporta ningún resultado que no se haya ejecutado.

## Arquitectura (la que está implementada)

Un solo proceso de aplicación (Next.js) y una sola base PostgreSQL, tal como muestra el C4 nivel 2 (`docs/entregable-1/07-diagramas-c4.md`).

```
src/app          Presentación: páginas, Server Actions y Route Handlers
src/composicion  Raíz de composición: conecta casos de uso con la infraestructura
src/modules/<contexto>/
   domain          Entidades, reglas puras y puertos (interfaces)
   application     Casos de uso: autorizan, validan y orquestan
   infrastructure  Repositorios PostgreSQL
src/shared       Errores tipados, decimales exactos, autorización, base de datos
db/              Migraciones SQL, semilla DEMO, utilidades
tests/           unitarias, integración, concurrencia, e2e
```

Dependencias en una sola dirección: `presentación → composición → aplicación → dominio ← infraestructura`. **`npm run capas` falla si alguien salta una capa** (por ejemplo, importar `pg` desde `src/app`); corre en CI.

Módulos: identidad, auditoria, produccion, inventario, comercial, configuracion, trazabilidad y panel (núcleo); talento, beneficio, finanzas y agricola (extensiones). Roles de demostración: admin@, produccion@, comercial@, supervisor@, recolector@, financiero@, bodega@, auditor@ + `demo.local` (clave `Demo-2026!`).

Documentación: `docs/entregable-1/` (drivers, árbol de utilidad, escenarios, estilo, contextos, tácticas, C4, tres ADR, riesgos), `docs/modelo-datos/` (ER, diccionario, matriz rol-permiso), `docs/sustentacion/`, `docs/pruebas/`, `docs/proteccion-datos.md`, `docs/despliegue.md`, `docs/trabajo-futuro.md`.

## Qué implementa y qué no

El estado real de cada requisito está en `docs/matriz-trazabilidad.md` (columna **Estado**: implementado, parcial o trabajo futuro). Lo que no figura como implementado no debe presentarse como hecho.

## Despliegue

Vercel (Hobby) + Render Postgres (Free). Pasos y limitaciones en `docs/despliegue.md`. URL desplegada: se agrega aquí cuando esté verificada.

## Uso

Proyecto académico. Vercel Hobby es solo para uso no comercial.
