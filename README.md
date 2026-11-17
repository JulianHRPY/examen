# API GraphQL + frontend — Gestión de estudiantes de un colegio

Proyecto completo que expone una **API GraphQL** conectada a una base de datos **SQLite** y un **frontend web** integrado para usarla sin herramientas externas.

## Funcionalidades

| # | Funcionalidad | Operación GraphQL |
| --- | --- | --- |
| 1 | Consulta general de los estudiantes | `query { estudiantes }` |
| 2 | Consulta de un estudiante por su número de identificación | `query { estudiante(numeroIdentificacion: ...) }` |
| 3 | Ingresar nuevos estudiantes | `mutation { crearEstudiante(input: ...) }` |
| 4 | Reportes básicos en PDF | `query { reporteEstudiantesPdf }` |

El frontend permite hacer las cuatro cosas desde el navegador: listar, buscar, registrar y descargar el PDF.

## Tecnologías

- **Node.js 22.5+** con el módulo integrado `node:sqlite` (no requiere drivers nativos)
- **Apollo Server 5** + **GraphQL 16**
- **Express 5** (servir el frontend y montar GraphQL en `/graphql`)
- **PDFKit** para generar los reportes
- **HTML, CSS y JavaScript vanilla** en el frontend (sin pasos de compilación)

## Instalación y ejecución

```bash
npm install
npm start
```

> **Nota para entornos con proxy/certificados corporativos:** si `npm install` falla con
> `UNABLE_TO_VERIFY_LEAF_SIGNATURE` o `403 Forbidden`, usa:
> `npm install --registry=https://registry.npmmirror.com --strict-ssl=false`

URLs después de arrancar:

- **Frontend:** http://localhost:4000/
- **Endpoint GraphQL:** http://localhost:4000/graphql

Variables de entorno opcionales:

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto del servidor | `4000` |
| `DB_PATH` | Ruta del archivo SQLite | `data/colegio.db` |

En PowerShell: `$env:PORT=5000; npm start`.

La base de datos se crea sola en `data/colegio.db` y se siembra con 8 estudiantes de ejemplo la primera vez.

## Esquema GraphQL

```graphql
type Estudiante {
  id: Int!
  numeroIdentificacion: String!
  nombres: String!
  apellidos: String!
  nombreCompleto: String!      # calculado
  fechaNacimiento: String      # YYYY-MM-DD
  genero: String
  grado: String!
  seccion: String
  correo: String
  telefono: String
  direccion: String
  promedio: Float              # 0 a 5
  activo: Boolean!
  fechaIngreso: String!
}

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

type ReportePdf {
  nombreArchivo: String!
  contentType: String!
  base64: String!
  tamanoBytes: Int!
  totalEstudiantes: Int!
}

type Query {
  estudiantes: [Estudiante!]!
  estudiante(numeroIdentificacion: String!): Estudiante
  reporteEstudiantesPdf(activosSolo: Boolean = false): ReportePdf!
}

type Mutation {
  crearEstudiante(input: CrearEstudianteInput!): Estudiante!
  crearEstudiantes(inputs: [CrearEstudianteInput!]!): [Estudiante!]!
}
```

### Decisiones del esquema

- `numeroIdentificacion` es `String` (los documentos pueden tener ceros a la izquierda y no deben tratarse como números).
- `promedio` es `Float` y se valida entre 0 y 5; `activo` es `Boolean`.
- Las fechas se usan como `String` en formato ISO `YYYY-MM-DD` (GraphQL no trae un escalar `Date` nativo).
- `nombreCompleto` es un campo calculado por un resolver.
- El PDF se devuelve en base64 para que el frontend lo convierta en un `Blob` y lo descargue, manteniendo **toda** la comunicación por GraphQL.

## Ejemplos de operaciones

### 1. Consulta general

```graphql
query {
  estudiantes {
    numeroIdentificacion
    nombreCompleto
    grado
    seccion
    promedio
    activo
  }
}
```

### 2. Consulta por identificación

```graphql
query ($numero: String!) {
  estudiante(numeroIdentificacion: $numero) {
    numeroIdentificacion
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
```

Variables: `{ "numero": "1002345680" }`. Si no existe, devuelve `estudiante: null`.

### 3. Mutación para ingresar un estudiante

```graphql
mutation ($input: CrearEstudianteInput!) {
  crearEstudiante(input: $input) {
    id
    numeroIdentificacion
    nombreCompleto
    activo
  }
}
```

```json
{
  "input": {
    "numeroIdentificacion": "1002345690",
    "nombres": "Laura Sofía",
    "apellidos": "Torres Medina",
    "fechaNacimiento": "2011-02-18",
    "genero": "F",
    "grado": "9°",
    "seccion": "A",
    "correo": "laura.torres@colegio.edu.co",
    "telefono": "3001234575",
    "direccion": "Calle 10 # 20-30",
    "promedio": 4.5,
    "activo": true,
    "fechaIngreso": "2026-02-01"
  }
}
```

Validaciones implementadas: campos obligatorios, identificación única, correo con formato válido, promedio entre 0 y 5 y fechas `YYYY-MM-DD`. Los errores se devuelven con códigos `BAD_USER_INPUT` o `CONFLICT`.

### 4. Reporte PDF

```graphql
query {
  reporteEstudiantesPdf(activosSolo: false) {
    nombreArchivo
    contentType
    tamanoBytes
    totalEstudiantes
    base64
  }
}
```

El PDF incluye encabezado, fecha de generación, resumen (total, activos y promedio general) y una tabla paginada con los estudiantes.

### Llamadas con `curl` (PowerShell)

```powershell
curl.exe -X POST http://localhost:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ estudiantes { numeroIdentificacion nombreCompleto grado } }"}'

curl.exe -X POST http://localhost:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ estudiante(numeroIdentificacion: \"1002345680\") { nombreCompleto promedio } }"}'
```

## Frontend integrado

En `public/` hay una interfaz de una sola página:

- **Consultar estudiante:** buscador por identificación con tarjeta de detalle.
- **Nuevo estudiante:** formulario completo que envía la mutación `crearEstudiante`; al guardar actualiza la tabla y muestra el registro creado.
- **Listado:** tabla con todos los estudiantes y botón de actualización.
- **Descargar PDF:** ejecuta `reporteEstudiantesPdf` y guarda el archivo; opción de incluir solo activos.
- Mensajes de éxito/error, estados de carga y diseño responsive.

Todo se sirve desde el mismo servidor Express, así que no hay problemas de CORS.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia frontend + API GraphQL |
| `npm run dev` | Inicia con recarga automática |
| `npm run demo` | Prueba las 4 funcionalidades por HTTP |
| `npm run reset-db` | Borra la base de datos para volver a sembrar los datos iniciales |

## Estructura

```
.
├── package.json
├── public/
│   ├── index.html        # Frontend
│   ├── app.js            # Consultas, mutaciones y descarga de PDF
│   └── styles.css
├── src/
│   ├── db.js             # SQLite: tabla, datos iniciales, consultas y mutaciones
│   ├── schema.js         # typeDefs y resolvers
│   ├── pdf.js            # Generación del reporte con PDFKit
│   └── server.js         # Express + Apollo Server
├── scripts/
│   ├── demo.js
│   └── reset-db.js
└── data/                 # colegio.db se genera en el primer arranque
```
