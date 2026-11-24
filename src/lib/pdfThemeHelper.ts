/**
 * ParkEase Standard PDF Export & Print Theme Helper
 * 
 * Generates authoritative, branded PDF/Print views following the exact visual theme
 * established in the Customer Module (BookingConfirmationDialog.tsx):
 * - Primary Navy Header (#1e3a8a) with official document logo
 * - Metadata Summary Cards
 * - Clean tabular & grid layouts with monospace references and badge pills
 * - Official footer banner (/brand/document-footer.png) with compliance & support notices
 * - Print-safe CSS rules ensuring crisp multi-page or single-sheet outputs
 */

export interface PdfMetaCard {
  label: string;
  value: string;
  subtext?: string;
}

export interface ParkEasePdfDocumentOptions {
  docTitle: string;
  docSubtitle?: string;
  statusPill?: {
    text: string;
    variant?: 'green' | 'blue' | 'amber' | 'red';
  };
  documentId?: string;
  metaCards?: PdfMetaCard[];
  bodyHtml: string;
  footerNotes?: string[];
  maxWidth?: string;
}

export function generateParkEasePdfHtml(options: ParkEasePdfDocumentOptions): string {
  const origin = window.location.origin;
  const documentLogoUrl = `${origin}/brand/document-logo.png`;
  const documentFooterUrl = `${origin}/brand/document-footer.png`;

  const maxWidth = options.maxWidth || '960px';

  let pillClass = 'status-pill-blue';
  if (options.statusPill?.variant === 'green') pillClass = 'status-pill-green';
  if (options.statusPill?.variant === 'amber') pillClass = 'status-pill-amber';
  if (options.statusPill?.variant === 'red') pillClass = 'status-pill-red';

  const metaCardsHtml =
    options.metaCards && options.metaCards.length > 0
      ? `<div class="meta-cards" style="grid-template-columns: repeat(${Math.min(options.metaCards.length, 4)}, 1fr);">
          ${options.metaCards
            .map(
              (card) => `
            <div class="meta-card">
              <div class="meta-label">${card.label}</div>
              <div class="meta-val">${card.value}</div>
              ${card.subtext ? `<div class="meta-sub">${card.subtext}</div>` : ''}
            </div>
          `,
            )
            .join('')}
        </div>`
      : '';

  const footerNotesHtml = options.footerNotes && options.footerNotes.length > 0
    ? options.footerNotes.map((note) => `<p>${note}</p>`).join('')
    : `
      <p style="font-weight:700;color:#0f172a;">ParkEase Smart Parking Management &amp; Reservation System</p>
      <p>Support: support@parkease.com &nbsp;|&nbsp; Web Portal: www.parkease.com</p>
      <p>This is a system-generated authentic platform document. Stored electronically under audit compliance.</p>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${options.docTitle}${options.documentId ? ` — ${options.documentId}` : ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .report-sheet {
      max-width: ${maxWidth};
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .report-header {
      background: #ffffff;
      padding: 20px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 4px solid #1e3a8a;
    }
    .brand-logo-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
    .brand-logo-img {
      height: 56px;
      width: auto;
      object-fit: contain;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .report-title-box {
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .status-pill-green {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .status-pill-blue {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
    }
    .status-pill-amber {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .status-pill-red {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }
    .report-title {
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .report-id {
      font-family: monospace;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .report-body {
      padding: 22px 28px;
    }
    .meta-cards {
      display: grid;
      gap: 12px;
      margin-bottom: 20px;
    }
    .meta-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .meta-val {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .section-block {
      margin-bottom: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .section-header {
      background: #f8fafc;
      padding: 7px 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
    }
    .grid-table td {
      padding: 7px 14px;
      font-size: 12.5px;
      border-bottom: 1px solid #f1f5f9;
    }
    .grid-table tr:last-child td {
      border-bottom: none;
    }
    .grid-table td.label {
      color: #64748b;
      width: 38%;
    }
    .grid-table td.val {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .manifest-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .manifest-table thead tr {
      background: #1e3a8a;
      color: #ffffff;
    }
    .manifest-table th {
      padding: 8px 10px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-right: 1px solid rgba(255, 255, 255, 0.15);
    }
    .manifest-table th:last-child {
      border-right: none;
    }
    .manifest-table td {
      padding: 8px 10px;
      font-size: 11px;
      border-bottom: 1px solid #e2e8f0;
    }
    .total-row td {
      background: #f0fdf4 !important;
      font-size: 13.5px !important;
      font-weight: 800 !important;
      color: #065f46 !important;
      border-top: 1px solid #bbf7d0 !important;
    }
    .report-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 11.5px;
      color: #475569;
    }
    .report-footer-text {
      padding: 14px 28px 10px 28px;
    }
    .report-footer-text p + p {
      margin-top: 3px;
    }
    .footer-banner-img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
    }
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .report-sheet { box-shadow: none !important; border: 1px solid #cbd5e1 !important; max-width: 100% !important; }
      .manifest-table th { background: #1e3a8a !important; color: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .total-row td { background: #f0fdf4 !important; color: #065f46 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page {
        margin: 10mm;
        size: auto;
      }
    }
  </style>
</head>
<body>
  <div class="report-sheet">
    <!-- Header -->
    <div class="report-header">
      <div class="brand-logo-wrap">
        <img src="${documentLogoUrl}" alt="ParkEase — Smart Parking Made Simple" class="brand-logo-img" />
        <div class="brand-sub">${options.docSubtitle || 'Smart Parking Management &amp; Reservation System'}</div>
      </div>
      <div class="report-title-box">
        ${options.statusPill ? `<span class="status-pill ${pillClass}">${options.statusPill.text}</span>` : ''}
        <div class="report-title">${options.docTitle}</div>
        ${options.documentId ? `<div class="report-id">${options.documentId}</div>` : ''}
      </div>
    </div>

    <!-- Body -->
    <div class="report-body">
      ${metaCardsHtml}
      ${options.bodyHtml}
    </div>

    <!-- Footer -->
    <div class="report-footer">
      <div class="report-footer-text">
        ${footerNotesHtml}
      </div>
      <img src="${documentFooterUrl}" alt="ParkEase Official Document Footer" class="footer-banner-img" />
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;
}

export function openParkEasePdfPrintWindow(options: ParkEasePdfDocumentOptions): void {
  const printWindow = window.open('', '_blank', 'width=1020,height=920');
  if (!printWindow) {
    alert('Please allow pop-ups in your browser to download or print the PDF.');
    return;
  }
  const html = generateParkEasePdfHtml(options);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function createPdfSectionBlock(
  title: string,
  rows: Array<{ label: string; value: string | number; isMono?: boolean; isTotal?: boolean }>
): string {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr class="${r.isTotal ? 'total-row' : ''}">
      <td class="label">${r.label}</td>
      <td class="val" ${r.isMono ? 'style="font-family:monospace;"' : ''}>${r.value}</td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="section-block">
      <div class="section-header">${title}</div>
      <table class="grid-table">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

export function createPdfManifestTable(
  columns: Array<{ header: string; align?: 'left' | 'center' | 'right'; width?: string }>,
  rows: Array<Array<{ content: string; align?: 'left' | 'center' | 'right'; isMono?: boolean }>>
): string {
  const theadHtml = `<tr>
    ${columns
      .map(
        (c) =>
          `<th style="${c.align ? `text-align:${c.align};` : ''}${c.width ? `width:${c.width};` : ''}">${c.header}</th>`
      )
      .join('')}
  </tr>`;

  const tbodyHtml = rows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `<tr style="background:${bg};">
      ${row
        .map((cell, colIdx) => {
          const align = cell.align || columns[colIdx]?.align || 'left';
          return `<td style="text-align:${align};${cell.isMono ? 'font-family:monospace;' : ''}">${cell.content}</td>`;
        })
        .join('')}
    </tr>`;
    })
    .join('');

  return `
    <div style="overflow-x:auto;">
      <table class="manifest-table">
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml}</tbody>
      </table>
    </div>
  `;
}

