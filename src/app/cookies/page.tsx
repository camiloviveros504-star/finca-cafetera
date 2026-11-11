import { PaginaLegal } from "../_componentes/PaginaLegal";

export const metadata = { title: "Política de cookies · Gestión de Finca Cafetera" };

export default function Cookies() {
  return (
    <PaginaLegal titulo="Política de cookies" actualizada="11 de noviembre de 2026">
      <p>
        Este sitio usa únicamente lo necesario para que funcione. <strong>No usa cookies de publicidad, de análisis ni de terceros</strong>, ni rastrea su navegación
        en otros sitios.
      </p>

      <h2>Cookies que se usan</h2>
      <table>
        <thead><tr><th>Nombre</th><th>Para qué sirve</th><th>Duración</th><th>Tipo</th></tr></thead>
        <tbody>
          <tr>
            <td><code>__Host-sesion</code> (en desarrollo, <code>sesion</code>)</td>
            <td>Mantiene su sesión iniciada. Solo contiene un identificador aleatorio; el servidor guarda únicamente una huella de ese identificador. No es accesible desde JavaScript (httpOnly), solo se envía por conexión cifrada y no se comparte con otros sitios.</td>
            <td>Hasta 8 horas o hasta que cierre sesión</td>
            <td>Estrictamente necesaria</td>
          </tr>
        </tbody>
      </table>
      <p>Al ser estrictamente necesaria, esta cookie no requiere consentimiento: sin ella no es posible iniciar sesión.</p>

      <h2>Almacenamiento en su dispositivo</h2>
      <ul>
        <li>
          <strong>Cola de trabajo sin conexión (IndexedDB):</strong> cuando no hay señal, las cosechas, la producción de trabajadores y las inspecciones se guardan
          en su dispositivo y se envían al servidor al volver la conexión. Mientras no se confirmen, figuran como pendientes.
        </li>
        <li>
          <strong>Memoria temporal del navegador (Service Worker):</strong> guarda archivos estáticos (estilos, código e imágenes) y la pantalla de registro de
          cosechas para poder abrirla sin señal. No guarda datos de ventas ni respuestas de la API.
        </li>
      </ul>

      <h2>Cómo gestionarlas</h2>
      <p>
        Puede borrar las cookies y los datos del sitio desde la configuración de su navegador. Al hacerlo se cerrará su sesión y se eliminarán las operaciones que
        aún estén pendientes de enviar en ese dispositivo, así que conviene sincronizar antes.
      </p>
    </PaginaLegal>
  );
}
