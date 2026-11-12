# Despliegue y recuperación

Arquitectura de ejecución (C4 nivel 2): **Vercel Hobby** (aplicación Next.js) ↔ **Render Postgres Free** (base de datos), ambos en Virginia (`iad1`) para reducir la latencia. Local: `docker compose up` (aplicación + PostgreSQL 16) o `npm run iniciar` (sin Docker).

## 1. Límites de los planes gratuitos (de la documentación oficial; ver investigación)
| Plan | Límite | Consecuencia en este proyecto |
|---|---|---|
| Render Postgres Free | **Expira a los 30 días** (14 de gracia), 1 GB, **sin respaldos**, una base por espacio de trabajo, puede reiniciarse, sin pool de conexiones | Anotar la fecha de creación; hacer `pg_dump` antes de la sustentación; el pool de la aplicación es pequeño (`PG_POOL_MAX`, por defecto 5) |
| Vercel Hobby | Uso **no comercial**; 5.000 transformaciones de imagen al mes; arranque en frío de funciones | Las imágenes se sirven sin optimizar; la primera solicitud tras inactividad puede tardar (se mide aparte) |
| Alternativas descartadas | Neon y Supabase ofrecen bases gratuitas sin expiración de 30 días, pero con otro modelo de conexión | El prompt fija Render; no se cambió el plan acordado |

## 2. Variables de entorno (nunca en el repositorio)
| Variable | Dónde | Valor |
|---|---|---|
| `DATABASE_URL` | Vercel y local | Cadena de conexión **externa** de Render, tal como la da Render (sin agregarle `?sslmode=require`: el código ya activa SSL) (local: `postgresql://finca:finca_local@localhost:5433/finca`) |
| `SESSION_SECRET` | Vercel y local | Texto aleatorio de 32 caracteres o más (por ejemplo `openssl rand -base64 48`) |
| `APP_URL` | Vercel | URL pública de la aplicación (para la verificación de origen) |
| `PG_POOL_MAX` | Vercel (opcional) | Conexiones por instancia; por defecto 5. Subirlo solo si Render lo permite |
| `CODIGO_INSTALACION` | Vercel y local | Código de un solo uso (mínimo 12 caracteres) para crear la organización y el administrador en `/instalacion`. Después de instalar no se vuelve a usar |
| `CARGAR_DATOS_EJEMPLO` | Solo ensayos | `si` carga datos de ejemplo marcados DEMO si la base está vacía. **No usar en producción** |

`.env.example` documenta los nombres sin valores reales; `.env` está en `.gitignore`.

## 3. Despliegue paso a paso
1. **Render:** crear *PostgreSQL* plan Free, región Virginia. Anotar la **fecha de creación** (expira a los 30 días). Copiar la *External Database URL*.
2. **Migrar** desde un equipo con el repositorio: `DATABASE_URL="<externa>" npm run db:iniciar` (aplica las migraciones `db/migraciones/*.sql` en orden; no siembra nada).
3. **GitHub:** subir el repositorio (rama `main`); el CI ejecuta lint, tipos, capas, migraciones y pruebas.
4. **Vercel:** importar el repositorio, región `iad1`, y pegar `DATABASE_URL`, `SESSION_SECRET` y `APP_URL` en *Settings → Environment Variables*.
5. **Instalar:** abrir `https://<su-url>/instalacion`, ingresar el `CODIGO_INSTALACION`, la organización y la cuenta del administrador. Luego el administrador crea las cuentas de los propietarios, y cada propietario registra sus fincas, lotes y equipo.
6. **Verificar:** `GET /login` responde 200 e iniciar sesión con la cuenta creada.

## 4. Copias de seguridad y recuperación
Render Free **no hace respaldos**. Estrategia:
- **Respaldo manual:** `pg_dump --no-owner --format=custom "$DATABASE_URL" -f respaldo.dump` antes de la sustentación y antes de cambios grandes. Guardar el archivo **fuera del repositorio**.
- **Restauración:** crear una base nueva y ejecutar `pg_restore --no-owner -d "$NUEVA_URL" respaldo.dump`.
- **Recreación desde cero** (si la base expiró o se corrompió): crear la base nueva en Render → `DATABASE_URL=<nueva> npm run db:iniciar` → cambiar `DATABASE_URL` en Vercel → *Redeploy* → volver a `/instalacion`. Los datos reales solo vuelven con un respaldo (`pg_restore`).
- **Local:** `npm run db:reset` recrea la base local (está bloqueado en producción salvo `PERMITIR_RESET=si`).

La medición de la recuperación (QA-14, meta ≤ 15 minutos) está en el [informe de pruebas](pruebas/informe-de-pruebas.md).

## 5. Riesgos operativos relacionados (ver `entregable-1/09-riesgos.md`)
- **R-01 Conexiones:** cada transacción de venta ocupa una conexión; con Render Free sin pool, es lo primero que se espera que falle con más carga (ver QA-10 y QA-11).
- **Expiración de la base:** verificar la fecha de creación y ensayar la recreación antes de la sustentación.
- **Arranque en frío:** abrir la URL unos minutos antes de presentar.
