import { PaginaLegal } from "../_componentes/PaginaLegal";

export const metadata = { title: "Política de privacidad · Gestión de Finca Cafetera" };

export default function Privacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizada="11 de noviembre de 2026">
      <p>
        Esta política explica cómo se tratan los datos personales en el sistema Gestión de Finca Cafetera, conforme a la Ley 1581 de 2012 y a sus decretos
        reglamentarios (Decreto 1377 de 2013, compilado en el Decreto Único 1074 de 2015). La organización que usa el sistema es la responsable del tratamiento;
        puede dirigir cualquier solicitud al administrador de su organización.
      </p>

      <h2>Qué datos se tratan y para qué</h2>
      <table>
        <thead><tr><th>Titular</th><th>Datos</th><th>Finalidad</th></tr></thead>
        <tbody>
          <tr><td>Clientes</td><td>Nombre, documento, teléfono, correo y dirección</td><td>Gestión comercial y cartera de ventas de café</td></tr>
          <tr><td>Trabajadores</td><td>Tipo y número de documento, nombres, apellidos y teléfono</td><td>Registro de producción, liquidación y pago de remuneraciones</td></tr>
          <tr><td>Proveedores (personas naturales)</td><td>Nombre, documento, teléfono y correo</td><td>Compras y cuentas por pagar</td></tr>
          <tr><td>Usuarios del sistema</td><td>Nombre, correo y contraseña (solo se guarda su versión cifrada)</td><td>Control de acceso y auditoría de operaciones</td></tr>
        </tbody>
      </table>
      <p>No se recogen datos sensibles (salud, datos biométricos, origen étnico u otros).</p>

      <h2>Autorización</h2>
      <p>
        Los datos solo se registran cuando el titular ha autorizado su tratamiento. El sistema guarda la fecha de la autorización y la finalidad. La autorización
        puede revocarse en cualquier momento.
      </p>

      <h2>Derechos del titular</h2>
      <ul>
        <li>Conocer los datos que se tienen sobre usted y la finalidad con que se usan.</li>
        <li>Solicitar la actualización o rectificación de datos inexactos.</li>
        <li>Solicitar la supresión de sus datos o revocar la autorización.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio, una vez agotado el reclamo ante el responsable.</li>
      </ul>
      <p>
        El administrador atiende estas solicitudes desde el propio sistema. La supresión anonimiza los datos que identifican a la persona y conserva los registros
        económicos (ventas, pagos y liquidaciones) sin datos personales, porque deben seguir siendo consistentes.
      </p>

      <h2>Seguridad</h2>
      <p>
        Las contraseñas se almacenan con un algoritmo de cifrado de un solo sentido (Argon2id). Los permisos se verifican en el servidor, el acceso se limita por
        rol y por finca, los intentos de acceso fallidos se limitan y las operaciones sensibles quedan registradas en una auditoría que no se puede modificar. Ninguna
        medida garantiza una seguridad absoluta; si detecta un uso indebido, informe al administrador.
      </p>

      <h2>Conservación y transferencia</h2>
      <p>
        Los datos se conservan mientras dure la relación comercial o laboral y el tiempo que exijan las obligaciones contables y tributarias; después se suprimen
        o se anonimizan. El sistema se aloja en infraestructura de terceros ubicada en Estados Unidos (aplicación y base de datos), que actúan como encargados del
        tratamiento.
      </p>

      <h2>Imágenes del sitio</h2>
      <p>
        Las imágenes de paisajes, cultivos y procesos que aparecen en este sitio son ilustrativas y fueron generadas con inteligencia artificial. No muestran fincas
        ni personas reales.
      </p>

      <h2>Cambios en esta política</h2>
      <p>Cuando esta política cambie, se actualizará la fecha indicada arriba.</p>
    </PaginaLegal>
  );
}
