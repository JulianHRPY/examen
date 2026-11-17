/**
 * Demostración de las cuatro funcionalidades contra el servidor en ejecución.
 * Uso: npm start (en una terminal) y npm run demo (en otra).
 */
const endpoint = (process.env.API_URL || 'http://localhost:4000/').replace(/\/?$/, '/graphql');

async function consultar(query, variables = {}) {
  const respuesta = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}: ${await respuesta.text()}`);

  const resultado = await respuesta.json();
  if (resultado.errors) {
    throw new Error(resultado.errors.map((error) => error.message).join('; '));
  }
  return resultado.data;
}

try {
  console.log('=== 1) Consulta general de estudiantes ===');
  const { estudiantes } = await consultar(`
    query {
      estudiantes { numeroIdentificacion nombreCompleto grado seccion promedio activo }
    }
  `);
  console.table(estudiantes);

  console.log('\n=== 2) Consulta por número de identificación ===');
  const { estudiante } = await consultar(`
    query ($numero: String!) {
      estudiante(numeroIdentificacion: $numero) {
        numeroIdentificacion nombres apellidos grado correo promedio
      }
    }
  `, { numero: '1002345680' });
  console.log(estudiante);

  console.log('\n=== 3) Ingreso de un estudiante mediante mutación ===');
  const sufijo = String(Date.now()).slice(-6);
  const input = {
    numeroIdentificacion: `9${sufijo}`,
    nombres: 'Demo',
    apellidos: 'Estudiante',
    grado: '7°',
    seccion: 'A',
    correo: `demo${sufijo}@colegio.edu.co`,
    promedio: 4.4,
    fechaIngreso: new Date().toISOString().slice(0, 10),
  };
  const { crearEstudiante } = await consultar(`
    mutation ($input: CrearEstudianteInput!) {
      crearEstudiante(input: $input) { numeroIdentificacion nombreCompleto activo }
    }
  `, { input });
  console.log(crearEstudiante);

  console.log('\n=== 4) Reporte PDF ===');
  const { reporteEstudiantesPdf } = await consultar(`
    query {
      reporteEstudiantesPdf(activosSolo: false) {
        nombreArchivo contentType tamanoBytes totalEstudiantes
      }
    }
  `);
  console.log(reporteEstudiantesPdf);
  console.log('\nTodo funcionó correctamente. ✨');
} catch (error) {
  console.error('No se pudo completar la demostración:', error.message);
  console.error('Asegúrate de ejecutar "npm start" en otra terminal.');
  process.exitCode = 1;
}
