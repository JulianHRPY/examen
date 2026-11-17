import { DatabaseSync } from 'node:sqlite';
import { GraphQLError } from 'graphql';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/** Ruta al archivo SQLite. Se puede cambiar con la variable de entorno DB_PATH. */
export const dbPath = process.env.DB_PATH
  ? resolve(process.env.DB_PATH)
  : resolve(projectRoot, 'data', 'colegio.db');

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS estudiantes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    numeroIdentificacion  TEXT NOT NULL UNIQUE,
    nombres               TEXT NOT NULL,
    apellidos             TEXT NOT NULL,
    fechaNacimiento       TEXT,
    genero                TEXT,
    grado                 TEXT NOT NULL,
    seccion               TEXT,
    correo                TEXT,
    telefono              TEXT,
    direccion             TEXT,
    promedio              REAL,
    activo                INTEGER NOT NULL DEFAULT 1,
    fechaIngreso          TEXT NOT NULL
  );
`);

const datosIniciales = [
  ['1002345678', 'Ana María',   'Gómez Ramírez',     '2010-04-12', 'F', '10°', 'A', 'ana.gomez@colegio.edu.co',     '3001234567', 'Calle 12 # 34-56',      4.6, 1, '2023-02-01'],
  ['1002345679', 'Juan David',  'Pérez López',       '2009-11-23', 'M', '11°', 'B', 'juan.perez@colegio.edu.co',    '3001234568', 'Carrera 8 # 21-10',     4.2, 1, '2022-02-01'],
  ['1002345680', 'Valentina',   'Rodríguez Suárez',  '2011-07-05', 'F', '9°',  'A', 'valentina.r@colegio.edu.co',   '3001234569', 'Avenida 5 # 18-33',     4.8, 1, '2024-02-01'],
  ['1002345681', 'Santiago',    'Martínez Torres',   '2010-01-30', 'M', '10°', 'B', 'santiago.m@colegio.edu.co',    '3001234570', 'Calle 45 # 12-07',      3.9, 1, '2023-02-01'],
  ['1002345682', 'Camila',      'Hernández Vega',    '2012-03-17', 'F', '8°',  'C', 'camila.h@colegio.edu.co',      '3001234571', 'Carrera 3 # 9-24',      4.5, 1, '2025-02-01'],
  ['1002345683', 'Sebastián',   'Castillo Peña',     '2009-09-08', 'M', '11°', 'A', 'sebastian.c@colegio.edu.co',   '3001234572', 'Calle 7 # 51-18',       4.1, 1, '2022-02-01'],
  ['1002345684', 'Isabella',    'Moreno Gil',        '2011-12-02', 'F', '9°',  'B', 'isabella.m@colegio.edu.co',    '3001234573', 'Avenida 9 # 30-41',     4.7, 0, '2024-02-01'],
  ['1002345685', 'Mateo',       'Jiménez Cortés',    '2010-06-14', 'M', '10°', 'A', 'mateo.j@colegio.edu.co',       '3001234574', 'Calle 22 # 14-09',      4.3, 1, '2023-02-01'],
];

const columnas = [
  'numeroIdentificacion', 'nombres', 'apellidos', 'fechaNacimiento', 'genero',
  'grado', 'seccion', 'correo', 'telefono', 'direccion', 'promedio', 'activo',
  'fechaIngreso',
];

/** Siembra datos de ejemplo únicamente cuando la tabla está vacía. */
export function sembrarDatos() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM estudiantes').get();
  if (total > 0) return false;

  const insertar = db.prepare(
    `INSERT INTO estudiantes (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
  );

  db.exec('BEGIN');
  try {
    for (const estudiante of datosIniciales) insertar.run(...estudiante);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return true;
}

function mapearEstudiante(row) {
  if (!row) return null;
  return {
    ...row,
    activo: Boolean(row.activo),
    nombreCompleto: `${row.nombres} ${row.apellidos}`.trim(),
  };
}

/** Funcionalidad 1: consulta general de los estudiantes. */
export function obtenerEstudiantes({ activosSolo = false } = {}) {
  const where = activosSolo ? 'WHERE activo = 1' : '';
  const filas = db.prepare(
    `SELECT * FROM estudiantes ${where} ORDER BY apellidos ASC, nombres ASC`,
  ).all();
  return filas.map(mapearEstudiante);
}

/** Funcionalidad 2: consulta de un estudiante por su número de identificación. */
export function obtenerEstudiantePorIdentificacion(numeroIdentificacion) {
  const fila = db.prepare(
    'SELECT * FROM estudiantes WHERE numeroIdentificacion = ?',
  ).get(numeroIdentificacion);
  return mapearEstudiante(fila);
}

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
const correoRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorDeEntrada(mensaje) {
  return new GraphQLError(mensaje, { extensions: { code: 'BAD_USER_INPUT' } });
}

function texto(valor, campo, { obligatorio = false, maximo = 120 } = {}) {
  if (valor === undefined || valor === null) {
    if (obligatorio) throw errorDeEntrada(`El campo ${campo} es obligatorio.`);
    return null;
  }
  const resultado = String(valor).trim();
  if (obligatorio && resultado.length === 0) {
    throw errorDeEntrada(`El campo ${campo} no puede estar vacío.`);
  }
  if (resultado.length > maximo) {
    throw errorDeEntrada(`El campo ${campo} no puede superar ${maximo} caracteres.`);
  }
  return resultado || null;
}

function fecha(valor, campo) {
  const resultado = texto(valor, campo);
  if (resultado && (!fechaRegex.test(resultado) || Number.isNaN(Date.parse(resultado)))) {
    throw errorDeEntrada(`El campo ${campo} debe tener el formato YYYY-MM-DD.`);
  }
  return resultado;
}

function validarEstudiante(input) {
  const numeroIdentificacion = texto(input.numeroIdentificacion, 'numeroIdentificacion', {
    obligatorio: true,
    maximo: 30,
  });
  const nombres = texto(input.nombres, 'nombres', { obligatorio: true });
  const apellidos = texto(input.apellidos, 'apellidos', { obligatorio: true });
  const grado = texto(input.grado, 'grado', { obligatorio: true, maximo: 20 });
  const fechaIngreso = fecha(input.fechaIngreso, 'fechaIngreso');
  if (!fechaIngreso) throw errorDeEntrada('El campo fechaIngreso es obligatorio.');

  const correo = texto(input.correo, 'correo', { maximo: 160 });
  if (correo && !correoRegex.test(correo)) {
    throw errorDeEntrada('El campo correo no tiene un formato válido.');
  }

  const promedio = input.promedio === undefined || input.promedio === null
    ? null
    : Number(input.promedio);
  if (promedio !== null && (!Number.isFinite(promedio) || promedio < 0 || promedio > 5)) {
    throw errorDeEntrada('El campo promedio debe estar entre 0 y 5.');
  }

  return {
    numeroIdentificacion,
    nombres,
    apellidos,
    fechaNacimiento: fecha(input.fechaNacimiento, 'fechaNacimiento'),
    genero: texto(input.genero, 'genero', { maximo: 20 }),
    grado,
    seccion: texto(input.seccion, 'seccion', { maximo: 20 }),
    correo,
    telefono: texto(input.telefono, 'telefono', { maximo: 30 }),
    direccion: texto(input.direccion, 'direccion', { maximo: 200 }),
    promedio,
    activo: input.activo === undefined || input.activo === null ? 1 : (input.activo ? 1 : 0),
    fechaIngreso,
  };
}

function valores(datos) {
  return columnas.map((columna) => datos[columna] ?? null);
}

const insertarEstudiante = db.prepare(
  `INSERT INTO estudiantes (${columnas.join(', ')}) VALUES (${columnas.map(() => '?').join(', ')})`,
);

/** Funcionalidad 3: ingresar un nuevo estudiante mediante una mutación. */
export function crearEstudiante(input) {
  const datos = validarEstudiante(input);

  const existente = db.prepare(
    'SELECT 1 FROM estudiantes WHERE numeroIdentificacion = ?',
  ).get(datos.numeroIdentificacion);
  if (existente) {
    throw new GraphQLError(
      `Ya existe un estudiante con el número de identificación ${datos.numeroIdentificacion}.`,
      { extensions: { code: 'CONFLICT' } },
    );
  }

  insertarEstudiante.run(...valores(datos));
  return obtenerEstudiantePorIdentificacion(datos.numeroIdentificacion);
}

/** Ingresa varios estudiantes en una sola mutación (operación transaccional). */
export function crearEstudiantes(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw errorDeEntrada('Debe enviar al menos un estudiante.');
  }

  const datos = inputs.map(validarEstudiante);
  const vistos = new Set();
  for (const estudiante of datos) {
    if (vistos.has(estudiante.numeroIdentificacion)) {
      throw errorDeEntrada(
        `El número de identificación ${estudiante.numeroIdentificacion} está repetido en la lista.`,
      );
    }
    vistos.add(estudiante.numeroIdentificacion);
  }

  const identificaciones = [...vistos];
  const existentes = db.prepare(
    `SELECT numeroIdentificacion FROM estudiantes WHERE numeroIdentificacion IN (${identificaciones.map(() => '?').join(', ')})`,
  ).all(...identificaciones);
  if (existentes.length > 0) {
    throw new GraphQLError(
      `Ya existen estudiantes con las identificaciones: ${existentes.map((f) => f.numeroIdentificacion).join(', ')}.`,
      { extensions: { code: 'CONFLICT' } },
    );
  }

  db.exec('BEGIN');
  try {
    for (const estudiante of datos) insertarEstudiante.run(...valores(estudiante));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return datos.map((estudiante) =>
    obtenerEstudiantePorIdentificacion(estudiante.numeroIdentificacion),
  );
}

/** Elimina la base de datos (utilizado por el script reset-db). */
export function reiniciarBaseDeDatos() {
  db.close();
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
}

sembrarDatos();
