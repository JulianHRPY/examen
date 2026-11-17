import { GraphQLError } from 'graphql';
import {
  obtenerEstudiantes,
  obtenerEstudiantePorIdentificacion,
  crearEstudiante,
  crearEstudiantes,
} from './db.js';
import { generarReporteEstudiantesPdf } from './pdf.js';

export const typeDefs = `#graphql
  """Información académica y personal de un estudiante del colegio."""
  type Estudiante {
    id: Int!
    numeroIdentificacion: String!
    nombres: String!
    apellidos: String!
    """Nombres y apellidos concatenados (campo calculado)."""
    nombreCompleto: String!
    fechaNacimiento: String
    genero: String
    grado: String!
    seccion: String
    correo: String
    telefono: String
    direccion: String
    promedio: Float
    activo: Boolean!
    fechaIngreso: String!
  }

  """Datos necesarios para registrar un estudiante nuevo."""
  input CrearEstudianteInput {
    numeroIdentificacion: String!
    nombres: String!
    apellidos: String!
    fechaNacimiento: String
    genero: String
    grado: String!
    seccion: String
    correo: String
    telefono: String
    direccion: String
    promedio: Float
    activo: Boolean = true
    fechaIngreso: String!
  }

  """Archivo PDF listo para descargar, codificado en base64."""
  type ReportePdf {
    nombreArchivo: String!
    contentType: String!
    base64: String!
    tamanoBytes: Int!
    totalEstudiantes: Int!
  }

  type Query {
    """Funcionalidad 1: devuelve todos los estudiantes registrados."""
    estudiantes: [Estudiante!]!

    """
    Funcionalidad 2: devuelve un estudiante por su número de identificación.
    Retorna null cuando no existe.
    """
    estudiante(numeroIdentificacion: String!): Estudiante

    """Funcionalidad 4: genera un reporte PDF con el listado de estudiantes."""
    reporteEstudiantesPdf(activosSolo: Boolean = false): ReportePdf!
  }

  type Mutation {
    """Funcionalidad 3: ingresa un nuevo estudiante a la base de datos."""
    crearEstudiante(input: CrearEstudianteInput!): Estudiante!

    """Ingresa varios estudiantes en una sola operación transaccional."""
    crearEstudiantes(inputs: [CrearEstudianteInput!]!): [Estudiante!]!
  }
`;

export const resolvers = {
  Query: {
    estudiantes: () => obtenerEstudiantes(),

    estudiante: (_parent, { numeroIdentificacion }) => {
      const numero = String(numeroIdentificacion ?? '').trim();

      if (numero.length === 0) {
        throw new GraphQLError('El número de identificación no puede estar vacío.', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      return obtenerEstudiantePorIdentificacion(numero);
    },

    reporteEstudiantesPdf: async (_parent, { activosSolo }) => {
      const estudiantes = obtenerEstudiantes({ activosSolo: Boolean(activosSolo) });
      const pdf = await generarReporteEstudiantesPdf(estudiantes);
      const fecha = new Date().toISOString().slice(0, 10);

      return {
        nombreArchivo: `reporte-estudiantes-${fecha}.pdf`,
        contentType: 'application/pdf',
        base64: pdf.toString('base64'),
        tamanoBytes: pdf.length,
        totalEstudiantes: estudiantes.length,
      };
    },
  },

  Mutation: {
    crearEstudiante: (_parent, { input }) => crearEstudiante(input),
    crearEstudiantes: (_parent, { inputs }) => crearEstudiantes(inputs),
  },

  Estudiante: {
    nombreCompleto: (estudiante) =>
      `${estudiante.nombres} ${estudiante.apellidos}`.trim(),
  },
};
