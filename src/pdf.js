import PDFDocument from 'pdfkit';

const AZUL = '#1e3a5f';
const GRIS = '#263238';

function cabecera(doc, ancho) {
  doc.rect(0, 0, doc.page.width, 92).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20);
  doc.text('Reporte de Estudiantes', 40, 28, { width: ancho });
  doc.font('Helvetica').fontSize(10);
  doc.text('Colegio — Sistema de gestión académica', 40, 56, { width: ancho });
  doc.text(
    `Generado el ${new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}`,
    40,
    72,
    { width: ancho, align: 'right' },
  );
}

function resumen(doc, estudiantes, y, ancho) {
  const activos = estudiantes.filter((e) => e.activo).length;
  const promedios = estudiantes
    .map((e) => e.promedio)
    .filter((p) => typeof p === 'number');
  const promedioGeneral = promedios.length
    ? (promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(2)
    : 'N/A';

  doc.roundedRect(40, y, ancho, 52, 4).fill('#eef3f8');
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(11);
  const celda = ancho / 3;
  const datos = [
    ['Total de estudiantes', String(estudiantes.length)],
    ['Estudiantes activos', String(activos)],
    ['Promedio general', promedioGeneral],
  ];
  datos.forEach(([etiqueta, valor], i) => {
    const x = 40 + i * celda;
    doc.fontSize(8).font('Helvetica').fillColor('#5a6b7b').text(etiqueta, x + 12, y + 10, { width: celda - 20 });
    doc.fontSize(16).font('Helvetica-Bold').fillColor(AZUL).text(valor, x + 12, y + 25, { width: celda - 20 });
  });
  return y + 52;
}

function encabezadoTabla(doc, columnas, x, y) {
  const ancho = columnas.reduce((suma, col) => suma + col.ancho, 0);
  doc.rect(x, y, ancho, 23).fill(AZUL);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);
  let cx = x;
  for (const columna of columnas) {
    doc.text(columna.titulo, cx + 5, y + 7, { width: columna.ancho - 10, ellipsis: true });
    cx += columna.ancho;
  }
  return y + 23;
}

/** Genera el reporte PDF básico de estudiantes y devuelve su contenido en bytes. */
export function generarReporteEstudiantesPdf(estudiantes) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: 'Reporte de estudiantes',
        Author: 'API GraphQL - Colegio',
        Subject: 'Listado general de estudiantes',
      },
    });

    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnas = [
      { titulo: 'IDENTIFICACIÓN', ancho: 100 },
      { titulo: 'ESTUDIANTE', ancho: 205 },
      { titulo: 'GRADO', ancho: 50 },
      { titulo: 'SEC.', ancho: 40 },
      { titulo: 'PROMEDIO', ancho: 60 },
      { titulo: 'ESTADO', ancho: 60 },
    ];
    const anchoTabla = columnas.reduce((suma, col) => suma + col.ancho, 0);
    const x = 40;

    cabecera(doc, ancho);
    let y = resumen(doc, estudiantes, 112, ancho) + 22;
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12);
    doc.text('Listado de estudiantes', x, y, { width: ancho });
    y = encabezadoTabla(doc, columnas, x, y + 22);

    doc.font('Helvetica').fontSize(8.5).fillColor(GRIS);

    estudiantes.forEach((estudiante, indice) => {
      if (y + 21 > doc.page.height - 55) {
        doc.addPage();
        y = encabezadoTabla(doc, columnas, x, 45);
        doc.font('Helvetica').fontSize(8.5).fillColor(GRIS);
      }

      if (indice % 2 === 1) {
        doc.rect(x, y, anchoTabla, 21).fill('#f5f8fb');
        doc.fillColor(GRIS);
      }

      const valores = [
        estudiante.numeroIdentificacion,
        `${estudiante.nombres} ${estudiante.apellidos}`,
        estudiante.grado,
        estudiante.seccion || '-',
        estudiante.promedio === null || estudiante.promedio === undefined
          ? '-'
          : Number(estudiante.promedio).toFixed(1),
        estudiante.activo ? 'Activo' : 'Inactivo',
      ];

      let cx = x;
      valores.forEach((valor, i) => {
        doc.text(String(valor), cx + 5, y + 6, {
          width: columnas[i].ancho - 10,
          ellipsis: true,
        });
        cx += columnas[i].ancho;
      });

      doc.moveTo(x, y + 21).lineTo(x + anchoTabla, y + 21).strokeColor('#dde3ea').stroke();
      doc.fillColor(GRIS);
      y += 21;
    });

    if (estudiantes.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#78909c');
      doc.text('No hay estudiantes registrados.', x, y + 14, { width: ancho });
    }

    const rangos = doc.bufferedPageRange();
    for (let pagina = rangos.start; pagina < rangos.start + rangos.count; pagina += 1) {
      doc.switchToPage(pagina);
      doc.font('Helvetica').fontSize(8).fillColor('#78909c');
      doc.text(
        `Página ${pagina - rangos.start + 1} de ${rangos.count}  ·  Reporte generado automáticamente`,
        40,
        doc.page.height - 32,
        { width: ancho, align: 'center' },
      );
    }

    doc.end();
  });
}
