# Protección de datos personales

Marco: **Ley 1581 de 2012** (régimen general) y **Decreto 1377 de 2013**, cuyo articulado fue compilado en el **Decreto Único 1074 de 2015**. Las citas vienen de la investigación (`docs/investigacion/fase-2-investigacion.md`, estado "Parcial"). **Pendiente antes de entregar:** que el equipo verifique la vigencia del articulado en la SIC o en SUIN-Juriscol. Este documento describe cómo el sistema apoya el cumplimiento; no es asesoría jurídica ni afirma que el sistema "cumple la ley" por sí solo: el responsable del tratamiento sigue siendo la organización que lo usa.

## 1. Quién es quién
| Papel | Quién |
|---|---|
| Responsable del tratamiento | La organización propietaria de las fincas (en la demo, "Organización DEMO"). Debe tener su política de tratamiento y, si aplica, registrar bases de datos ante la SIC. |
| Encargado | El sistema y el proveedor de alojamiento (Vercel, Render) solo almacenan y procesan los datos por cuenta del responsable. |
| Titulares | Clientes, trabajadores, proveedores personas naturales y usuarios del sistema. |

## 2. Datos que se tratan y para qué (finalidades)
| Titular | Datos | Finalidad declarada (se guarda en el registro) |
|---|---|---|
| Cliente | Nombre, documento, teléfono, correo, dirección | Gestión comercial y cartera de ventas de café |
| Trabajador | Tipo y número de documento, nombres, apellidos, teléfono | Registro de producción, liquidación y pago de remuneraciones |
| Proveedor persona natural | Nombre, documento, teléfono, correo | Gestión de compras y cuentas por pagar |
| Usuario | Nombre, correo, contraseña (solo su hash Argon2id) | Control de acceso y auditoría |

No se recogen datos sensibles (salud, biométricos, origen étnico, etc.). Si el equipo decide agregarlos, requiere autorización específica y reevaluar este documento.

## 3. Autorización del titular
- Crear un cliente, trabajador o usuario exige **marcar que el titular autorizó el tratamiento**; sin esa confirmación el sistema rechaza el registro (`autorizo_tratamiento_en`, `finalidad_tratamiento`).
- Se guarda **la fecha** de la autorización y la **finalidad**, no una copia del documento de autorización: el soporte (formulario físico o mensaje) lo conserva la organización. Esto es una limitación documentada.

## 4. Derechos del titular y cómo se atienden
| Derecho | Dónde en el sistema | Quién | Prueba |
|---|---|---|---|
| **Conocer** sus datos | Pantalla "Datos personales (Ley 1581)" del cliente o del trabajador: muestra los datos, la finalidad, la fecha de autorización y el resumen de su historial | Rol con `datos_personales:gestionar` (administrador) | `tests/integracion/anulaciones-y-derechos.test.ts` |
| **Rectificar** | Misma pantalla, formulario "Rectificar datos" | Quien administra clientes o trabajadores | ídem |
| **Suprimir** | "Suprimir datos personales (anonimizar)": borra nombre, documento, teléfono, correo y dirección; el registro se conserva sin datos personales | Administrador, con motivo escrito | ídem |
| Revocar la autorización | Se atiende como supresión | Administrador | ídem |

Por qué **anonimizar y no borrar**: las ventas, los pagos y las liquidaciones son hechos económicos que deben seguir cuadrando y ser trazables (driver D2). Se elimina la información que identifica a la persona y se conserva el hecho. Si un trabajador tiene usuario de acceso, la pantalla avisa que hay que desactivarlo desde "Usuarios". La atención de la solicitud (plazos legales de respuesta) la gestiona la organización fuera del sistema.

## 5. Medidas de seguridad en el sistema (D3)
Cada medida está implementada y tiene prueba; no se afirma seguridad absoluta.
- Contraseñas con **Argon2id**; nunca se guardan ni se registran en claro (prueba: la auditoría no contiene la contraseña).
- Sesiones con cookie **httpOnly, Secure (en producción) y SameSite=Lax**, expiración y cierre de sesión; el token se guarda solo como hash SHA-256.
- **Bloqueo por intentos** (5 fallos por cuenta en 15 minutos, 20 por IP) y respuesta genérica que no revela si el usuario existe (QA-06).
- **Autorización en el servidor** por permiso y por finca en cada caso de uso; los intentos rechazados responden 403 y quedan en la auditoría (QA-05, QA-07).
- **CSRF**: Server Actions con verificación de origen y rutas API con token de sesión.
- Validación de toda entrada en el servidor (Zod); mensajes de error sin detalles internos.
- Cambiar roles, permisos, fincas o estado de un usuario **cierra sus sesiones** para que el cambio aplique de inmediato.
- **Auditoría append-only** (triggers que impiden UPDATE y DELETE) con usuario, acción, entidad, valores antes/después e IP. Los datos personales **no se copian** a la auditoría (se registran identificadores y nombres de campos, no valores).
- Los registros (logs) de la aplicación no incluyen datos personales.
- Secretos solo en variables de entorno; `.env` está en `.gitignore`.
- Reportes CSV con neutralización de fórmulas y limitados a las fincas del usuario.

### Alta de usuarios y recuperación de contraseña
- **No hay registro público.** El administrador registra a la persona y define sus roles y fincas; el sistema genera un enlace de **un solo uso** que vence a las 72 horas, y la persona fija ella misma su contraseña. El administrador nunca conoce ni escribe la contraseña de nadie.
- El token del enlace es aleatorio de 256 bits y solo se guarda su huella SHA-256; se consume dentro de una transacción con bloqueo (dos usos simultáneos: solo uno prospera); generar un enlace nuevo revoca los anteriores; al activar o restablecer se cierran las sesiones abiertas de esa cuenta.
- Enlaces inválidos, vencidos o ya usados responden igual (sin revelar el motivo) y cuentan contra el límite de intentos por IP del inicio de sesión.
- No hay envío de correos: el administrador entrega el enlace (limitación documentada; un servicio de correo transaccional queda como trabajo futuro).

### Amenazas consideradas (qué se hizo y qué lo prueba)
| Ataque | Defensa | Prueba |
|---|---|---|
| Adivinar contraseñas (fuerza bruta) | Bloqueo tras 5 fallos por cuenta y 20 por IP en 15 min; Argon2id; política de contraseñas (10+ caracteres, letras y números, sin palabras comunes ni el usuario del correo) | `seguridad-y-base.test.ts` (QA-06), `invitaciones.test.ts` |
| Saber si un usuario existe (enumeración) | Misma respuesta y mismo trabajo (contraseña de relleno) exista o no | `seguridad-y-base.test.ts` |
| Robar o reutilizar un enlace de activación | Un solo uso, vencimiento, huella en la base, revocación, bloqueo por intentos | `invitaciones.test.ts` |
| Robo de sesión / XSS | Cookie httpOnly, Secure y SameSite; Content-Security-Policy; React escapa el contenido | `flujos.spec.ts`; cabeceras en `next.config.ts` |
| CSRF | Verificación de origen en Server Actions; token de sesión en las rutas API | `flujos.spec.ts` (QA-05) |
| Clickjacking | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | cabeceras |
| Inyección SQL | Todas las consultas son parametrizadas; los nombres de columnas dinámicos salen de listas fijas | revisión de código |
| Escalar privilegios o ver otra finca | Autorización en el servidor por permiso y por finca en cada caso de uso | QA-05, QA-07 |
| Inyección de fórmulas en CSV | Neutralización de `= + - @` | `csv.test.ts` |
| Adueñarse de una instalación nueva | Código de instalación de un solo uso definido en el entorno | `instalacion.test.ts` |

**Límite honesto:** ninguna lista de defensas hace un sistema "impenetrable". La política de contenido usa `'unsafe-inline'` en scripts por la hidratación de Next.js (sin nonces), no hay autenticación de dos factores ni detección de anomalías, y no se ha hecho una prueba de penetración externa. Esos puntos están en `trabajo-futuro.md`.

## 6. Conservación y copias de seguridad
- **Tiempo de conservación:** no hay borrado automático. La política propuesta (a decidir por la organización) es conservar los datos mientras dure la relación comercial o laboral y el tiempo que exijan las obligaciones contables y tributarias, y luego suprimirlos con la función de anonimización. Está como **trabajo futuro** automatizar avisos de vencimiento.
- **Copias de seguridad:** la base gratuita de Render **no incluye respaldos**. La estrategia está en [`despliegue.md`](despliegue.md): `pg_dump` manual antes de la sustentación y restauración con migraciones y semilla.
- **Transferencia internacional:** Vercel y Render alojan en la región de Virginia (EE. UU.). Para datos reales, la organización debe evaluar el cumplimiento de las reglas de transferencia; con datos de demostración no aplica.

## 7. Lo que NO hace el sistema (honestidad)
- No guarda el documento de autorización firmado, solo la fecha y la finalidad.
- No cifra campos individuales en la base (el cifrado en reposo depende del proveedor de alojamiento).
- No gestiona automáticamente los plazos de atención de consultas y reclamos.
- No es un sistema de nómina legal ni de facturación electrónica DIAN.
- Los datos de ejemplo que pueden cargarse para ensayos son ficticios y están marcados DEMO; no se cargan por defecto.
