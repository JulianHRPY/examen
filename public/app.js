const ENDPOINT = '/graphql';
const $ = (id) => document.getElementById(id);

const QUERY_ESTUDIANTES = `
  query ListaEstudiantes {
    estudiantes {
      id
      numeroIdentificacion
      nombres
      apellidos
      nombreCompleto
      grado
      seccion
      promedio
      activo
      fechaIngreso
    }
  }
`;

const QUERY_ESTUDIANTE = `
  query EstudiantePorIdentificacion($numero: String!) {
    estudiante(numeroIdentificacion: $numero) {
      numeroIdentificacion
      nombreCompleto
      nombres
      apellidos
      fechaNacimiento
      genero
      grado
      seccion
      correo
      telefono
      direccion
      promedio
      activo
      fechaIngreso
    }
  }
`;

const QUERY_REPORTE = `
  query Reporte($activosSolo: Boolean!) {
    reporteEstudiantesPdf(activosSolo: $activosSolo) {
      nombreArchivo
      contentType
      base64
      totalEstudiantes
    }
  }
`;

const MUTATION_CREAR = `
  mutation CrearEstudiante($input: CrearEstudianteInput!) {
    crearEstudiante(input: $input) {
      numeroIdentificacion
      nombreCompleto
    }
  }
`;

async function ejecutarGraphQL(query, variables = {}) {
  const respuesta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!respuesta.ok) throw new Error(`Error HTTP ${respuesta.status}`);

  const cuerpo = await respuesta.json();
  if (cuerpo.errors && cuerpo.errors.length > 0) {
    throw new Error(cuerpo.errors.map((error) => error.message).join(' · '));
  }
  return cuerpo.data;
}

let temporizadorToast;
function mostrarToast(mensaje, tipo = 'info') {
  const toast = $('toast');
  window.clearTimeout(temporizadorToast);
  toast.textContent = mensaje;
  toast.className = `toast toast--${tipo}`;
  toast.hidden = false;
  temporizadorToast = window.setTimeout(() => { toast.hidden = true; }, 4000);
}

function textoSeguro(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : String(valor);
}

function celda(texto) {
  const td = document.createElement('td');
  td.textContent = texto;
  return td;
}

function renderTabla(estudiantes) {
  const cuerpo = $('cuerpo-tabla');
  cuerpo.replaceChildren();

  if (estudiantes.length === 0) {
    const fila = document.createElement('tr');
    const td = celda('No hay estudiantes registrados.');
    td.colSpan = 5;
    td.className = 'vacio';
    fila.appendChild(td);
    cuerpo.appendChild(fila);
  }

  for (const estudiante of estudiantes) {
    const fila = document.createElement('tr');
    fila.appendChild(celda(estudiante.numeroIdentificacion));
    fila.appendChild(celda(`${estudiante.nombres} ${estudiante.apellidos}`));
    fila.appendChild(celda(
      `${estudiante.grado}${estudiante.seccion ? ` · ${estudiante.seccion}` : ''}`,
    ));
    fila.appendChild(celda(
      estudiante.promedio === null ? '—' : Number(estudiante.promedio).toFixed(1),
    ));

    const tdEstado = document.createElement('td');
    const etiqueta = document.createElement('span');
    etiqueta.className = `estado ${estudiante.activo ? 'estado--activo' : 'estado--inactivo'}`;
    etiqueta.textContent = estudiante.activo ? 'Activo' : 'Inactivo';
    tdEstado.appendChild(etiqueta);
    fila.appendChild(tdEstado);
    cuerpo.appendChild(fila);
  }

  $('total-estudiantes').textContent = String(estudiantes.length);
}

async function cargarEstudiantes() {
  const boton = $('btn-actualizar');
  boton.disabled = true;
  try {
    const datos = await ejecutarGraphQL(QUERY_ESTUDIANTES);
    renderTabla(datos.estudiantes);
  } catch (error) {
    mostrarToast(`No se pudo cargar el listado: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
  }
}

function construirDetalle(estudiante) {
  const contenedor = document.createElement('div');
  contenedor.className = 'detalle';

  const titulo = document.createElement('div');
  titulo.className = 'detalle__titulo';
  titulo.textContent = `${estudiante.nombreCompleto} · ${estudiante.numeroIdentificacion}`;
  contenedor.appendChild(titulo);

  const campos = [
    ['Nombres', estudiante.nombres],
    ['Apellidos', estudiante.apellidos],
    ['Grado', `${estudiante.grado}${estudiante.seccion ? ` · ${estudiante.seccion}` : ''}`],
    ['Promedio', estudiante.promedio === null ? '—' : Number(estudiante.promedio).toFixed(1)],
    ['Fecha de nacimiento', estudiante.fechaNacimiento],
    ['Género', estudiante.genero],
    ['Correo', estudiante.correo],
    ['Teléfono', estudiante.telefono],
    ['Dirección', estudiante.direccion],
    ['Fecha de ingreso', estudiante.fechaIngreso],
    ['Estado', estudiante.activo ? 'Activo' : 'Inactivo'],
  ];

  const grid = document.createElement('div');
  grid.className = 'detalle__grid';
  for (const [etiqueta, valor] of campos) {
    const item = document.createElement('div');
    item.className = 'detalle__item';
    const nombre = document.createElement('span');
    nombre.textContent = etiqueta;
    const contenido = document.createElement('strong');
    contenido.textContent = textoSeguro(valor);
    item.append(nombre, contenido);
    grid.appendChild(item);
  }
  contenedor.appendChild(grid);
  return contenedor;
}

async function buscarEstudiante(numero) {
  const contenedor = $('resultado-busqueda');
  const boton = $('btn-buscar');
  boton.disabled = true;

  try {
    const datos = await ejecutarGraphQL(QUERY_ESTUDIANTE, { numero });
    contenedor.replaceChildren();

    if (!datos.estudiante) {
      const mensaje = document.createElement('p');
      mensaje.className = 'vacio';
      mensaje.textContent = `No se encontró ningún estudiante con la identificación ${numero}.`;
      contenedor.appendChild(mensaje);
      return;
    }

    contenedor.appendChild(construirDetalle(datos.estudiante));
  } catch (error) {
    mostrarToast(`No se pudo realizar la búsqueda: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
  }
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function valoresDelFormulario() {
  const datos = new FormData($('form-estudiante'));
  const valor = (clave) => String(datos.get(clave) ?? '').trim();
  const promedio = valor('promedio');

  return {
    numeroIdentificacion: valor('numeroIdentificacion'),
    nombres: valor('nombres'),
    apellidos: valor('apellidos'),
    fechaNacimiento: valor('fechaNacimiento') || null,
    genero: valor('genero') || null,
    grado: valor('grado'),
    seccion: valor('seccion') || null,
    correo: valor('correo') || null,
    telefono: valor('telefono') || null,
    direccion: valor('direccion') || null,
    promedio: promedio === '' ? null : Number(promedio),
    activo: $('activo').checked,
    fechaIngreso: valor('fechaIngreso') || fechaHoy(),
  };
}

function descargarPdf(base64, nombreArchivo, contentType) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

  const url = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('form-busqueda').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const numero = $('buscar-identificacion').value.trim();
  if (!numero) {
    mostrarToast('Ingresa un número de identificación para buscar.', 'error');
    return;
  }
  buscarEstudiante(numero);
});

$('form-estudiante').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const input = valoresDelFormulario();

  if (!input.numeroIdentificacion || !input.nombres || !input.apellidos || !input.grado) {
    mostrarToast('Completa los campos obligatorios marcados con *.', 'error');
    return;
  }

  const boton = $('btn-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando…';

  try {
    const datos = await ejecutarGraphQL(MUTATION_CREAR, { input });
    mostrarToast(`Estudiante ${datos.crearEstudiante.nombreCompleto} registrado correctamente.`, 'ok');
    $('form-estudiante').reset();
    $('activo').checked = true;
    $('fechaIngreso').value = fechaHoy();
    await cargarEstudiantes();
    $('buscar-identificacion').value = datos.crearEstudiante.numeroIdentificacion;
    await buscarEstudiante(datos.crearEstudiante.numeroIdentificacion);
  } catch (error) {
    mostrarToast(`No se pudo registrar el estudiante: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar estudiante';
  }
});

$('btn-actualizar').addEventListener('click', cargarEstudiantes);

$('btn-pdf').addEventListener('click', async () => {
  const boton = $('btn-pdf');
  boton.disabled = true;
  boton.textContent = 'Generando…';
  try {
    const datos = await ejecutarGraphQL(QUERY_REPORTE, {
      activosSolo: $('solo-activos').checked,
    });
    const reporte = datos.reporteEstudiantesPdf;
    descargarPdf(reporte.base64, reporte.nombreArchivo, reporte.contentType);
    mostrarToast(`Reporte PDF generado con ${reporte.totalEstudiantes} estudiantes.`, 'ok');
  } catch (error) {
    mostrarToast(`No se pudo generar el reporte: ${error.message}`, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Descargar PDF';
  }
});

$('fechaIngreso').value = fechaHoy();
cargarEstudiantes();
