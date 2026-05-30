// ─── PDF Service ─────────────────────────────────────
// Generates professional quotation PDFs using PDFKit

const PDFDocument = require('pdfkit');

// Currency symbol - using "Tk." since PDFKit's default fonts don't support ৳ (Unicode)
const CUR = 'Tk.';

/**
 * Format a number as currency
 */
function formatCurrency(value) {
  const num = Number(value);
  if (isNaN(num)) return `${CUR} 0`;
  return `${CUR} ${num.toLocaleString('en-IN')}`;
}

/**
 * Generate a professional quotation PDF
 * @param {Object} quotation - Full quotation with items and customer
 * @returns {Promise<Buffer>} PDF buffer
 */
function generateQuotationPDF(quotation) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // ─── Header ──────────────────────────
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#4f46e5')
        .text('Stationery Hub', 50, 50);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('Basundhara R/A, Dhaka, Bangladesh', 50, 78)
        .text('Phone: +880 1700-000001 | Email: info@stationeryhub.com', 50, 91);

      // Quotation badge on the right
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text('QUOTATION', 350, 50, { align: 'right' });

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`#${quotation.quotationNumber}`, 350, 73, { align: 'right' });

      // Divider
      doc
        .moveTo(50, 115)
        .lineTo(545, 115)
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .stroke();

      // ─── Info Section ────────────────────
      const infoY = 130;

      // Left: Customer Info
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#94a3b8')
        .text('BILL TO', 50, infoY);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#1e293b')
        .text(quotation.customer?.contactPerson || 'Walk-in Customer', 50, infoY + 16);

      if (quotation.customer?.companyName) {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
          .text(quotation.customer.companyName, 50, infoY + 32);
      }
      if (quotation.customer?.address) {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
          .text(quotation.customer.address, 50, infoY + 46);
      }
      if (quotation.customer?.phone) {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
          .text(`Phone: ${quotation.customer.phone}`, 50, infoY + 60);
      }
      if (quotation.customer?.email) {
        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
          .text(`Email: ${quotation.customer.email}`, 50, infoY + 74);
      }

      // Right: Quotation Details
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#94a3b8')
        .text('DETAILS', 350, infoY, { align: 'right' });

      const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

      doc.fontSize(9).font('Helvetica').fillColor('#64748b');
      doc.text(`Date: ${formatDate(quotation.createdAt)}`, 350, infoY + 16, { align: 'right' });
      doc.text(`Valid Until: ${formatDate(quotation.validUntil)}`, 350, infoY + 30, { align: 'right' });
      doc.text(`Status: ${quotation.status}`, 350, infoY + 44, { align: 'right' });
      if (quotation.createdBy?.name) {
        doc.text(`Created By: ${quotation.createdBy.name}`, 350, infoY + 58, { align: 'right' });
      }

      // ─── Items Table ─────────────────────
      let tableY = infoY + 95;

      // Table header
      doc.rect(50, tableY, 495, 24).fill('#f1f5f9');
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#475569');

      doc.text('#', 58, tableY + 7, { width: 25 });
      doc.text('Product', 83, tableY + 7, { width: 200 });
      doc.text('Qty', 283, tableY + 7, { width: 40, align: 'center' });
      doc.text('Unit Price', 323, tableY + 7, { width: 70, align: 'right' });
      doc.text('Disc %', 393, tableY + 7, { width: 45, align: 'center' });
      doc.text('Total', 438, tableY + 7, { width: 100, align: 'right' });

      tableY += 24;

      // Table rows
      const items = quotation.items || [];
      items.forEach((item, idx) => {
        if (tableY > 700) {
          doc.addPage();
          tableY = 50;
        }

        // Alternate row background
        if (idx % 2 === 0) {
          doc.rect(50, tableY, 495, 22).fill('#fafbfc');
        }

        doc.fontSize(9).font('Helvetica').fillColor('#334155');
        doc.text(`${idx + 1}`, 58, tableY + 6, { width: 25 });
        doc.text(item.productName || item.product?.name || '-', 83, tableY + 6, { width: 200 });
        doc.text(`${item.quantity}`, 283, tableY + 6, { width: 40, align: 'center' });
        doc.text(formatCurrency(item.unitPrice), 323, tableY + 6, { width: 70, align: 'right' });
        doc.text(`${Number(item.discountPercent || 0)}%`, 393, tableY + 6, { width: 45, align: 'center' });
        doc.text(formatCurrency(item.lineTotal), 438, tableY + 6, { width: 100, align: 'right' });

        tableY += 22;
      });

      // Bottom border
      doc.moveTo(50, tableY).lineTo(545, tableY).strokeColor('#e2e8f0').lineWidth(1).stroke();

      // ─── Totals ──────────────────────────
      tableY += 15;

      const drawTotal = (label, value, bold = false) => {
        doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? '#1e293b' : '#64748b');
        doc.text(label, 350, tableY, { width: 88, align: 'right' });
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(bold ? '#4f46e5' : '#1e293b');
        doc.text(formatCurrency(value), 438, tableY, { width: 100, align: 'right' });
        tableY += 18;
      };

      drawTotal('Subtotal', quotation.subtotal);
      if (Number(quotation.discountAmount) > 0) {
        drawTotal('Discount', `-${quotation.discountAmount}`);
      }

      // Total with highlight box
      doc.rect(350, tableY - 2, 195, 26).fill('#f1f5f9');
      drawTotal('TOTAL', quotation.total, true);

      // ─── Notes ───────────────────────────
      if (quotation.notes) {
        tableY += 20;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#94a3b8').text('NOTES', 50, tableY);
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(quotation.notes, 50, tableY + 14, { width: 300 });
      }

      // ─── Footer ──────────────────────────
      const footerY = 760;
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('Thank you for your business!', 50, footerY + 10, { align: 'center', width: 495 });
      doc
        .fontSize(7)
        .text('This is a computer-generated document. No signature required.', 50, footerY + 24, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateQuotationPDF };
