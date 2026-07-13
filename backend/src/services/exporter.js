const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// columns: [{ header, key, width? }], rows: array of objects
async function toExcel(res, { title, columns, rows }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 20 }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

function toPdf(res, { title, columns, rows }) {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);
  doc.fontSize(16).text(`Nationwide Paper Ltd — ${title}`, { align: 'center' });
  doc.fontSize(9).text(`Generated ${new Date().toLocaleString()}`, { align: 'center' }).moveDown();

  const pageWidth = doc.page.width - 72;
  const colWidth = pageWidth / columns.length;
  const drawRow = (values, bold = false) => {
    const y = doc.y;
    if (y > doc.page.height - 60) { doc.addPage(); }
    const rowY = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
    values.forEach((v, i) => {
      doc.text(String(v ?? ''), 36 + i * colWidth, rowY, { width: colWidth - 4, lineBreak: false, ellipsis: true });
    });
    doc.moveDown(0.8);
  };
  drawRow(columns.map((c) => c.header), true);
  rows.forEach((r) => drawRow(columns.map((c) => r[c.key])));
  doc.end();
}

module.exports = { toExcel, toPdf };
