const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../middleware/upload');

// Generates the asset acknowledgement PDF, embedding the employee's digital
// signature (base64 PNG captured on the frontend signature pad).
function generateAckPdf({ assignment, asset, employee, actor }) {
  return new Promise((resolve, reject) => {
    const filename = `ack-${assignment.id}-${Date.now()}.pdf`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text('Nationwide Paper Ltd', { align: 'center' });
    doc.fontSize(14).text('IT Asset Acknowledgement Form', { align: 'center' });
    doc.moveDown(1.5);

    const rows = [
      ['Acknowledgement No.', `ACK-${String(assignment.id).padStart(5, '0')}`],
      ['Action', assignment.action],
      ['Date', new Date(assignment.createdAt).toLocaleString()],
      ['Employee', `${employee.name} (${employee.email})`],
      ['Asset Tag', asset.assetTag],
      ['Category', asset.category?.name || ''],
      ['Model', `${asset.manufacturer} ${asset.model}`],
      ['Serial Number', asset.serialNumber],
      ['Processed By', actor.name],
      ['Notes', assignment.notes || '-'],
    ];
    doc.fontSize(11);
    rows.forEach(([k, v]) => {
      doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(String(v));
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    doc.fontSize(10).text(
      'I acknowledge receipt of the above company asset and agree to use it for business purposes, ' +
      'keep it in good condition, report loss or damage immediately to the IT department, and return ' +
      'it upon request or termination of employment.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    if (assignment.signature) {
      try {
        const b64 = assignment.signature.replace(/^data:image\/png;base64,/, '');
        doc.image(Buffer.from(b64, 'base64'), { fit: [200, 80] });
      } catch { /* invalid signature image - leave blank line */ }
    }
    doc.moveDown(0.5);
    doc.text('_______________________________');
    doc.text(`Employee Signature: ${employee.name}`);

    doc.end();
    stream.on('finish', () => resolve(filename));
    stream.on('error', reject);
  });
}

module.exports = { generateAckPdf };
