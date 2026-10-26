const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const env = require('../config/env');

/**
 * Converts a number into Indian Rupee words (e.g. 120000 -> One Lakh Twenty Thousand)
 */
function numberToWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'Zero';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertBelowThousand(val) {
    let str = '';
    if (val >= 100) {
      str += units[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += units[val] + ' ';
    }
    return str.trim();
  }

  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundred = rem;

  let words = '';
  if (crore > 0) words += convertBelowThousand(crore) + ' Crore ';
  if (lakh > 0) words += convertBelowThousand(lakh) + ' Lakh ';
  if (thousand > 0) words += convertBelowThousand(thousand) + ' Thousand ';
  if (hundred > 0) words += convertBelowThousand(hundred) + ' ';

  return words.trim();
}

/**
 * Generates certificate statement paragraph specific to certificate type
 */
function getStatementParagraph(certCode, { citizen, application, issuingPanchayat, parties = [] }) {
  const fatherParty = parties.find(p => p.party_type === 'FATHER');
  const motherParty = parties.find(p => p.party_type === 'MOTHER');
  const parentName = fatherParty?.full_name || motherParty?.full_name || 'the guardian';

  const code = String(certCode || '').toUpperCase();
  const incomeStr = Number(application.declared_family_income || 0).toLocaleString('en-IN');
  const incomeWords = numberToWords(application.declared_family_income || 0);

  switch (code) {
    case 'EWS':
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, residing at ${citizen.address}, belongs to the Economically Weaker Section (EWS) in accordance with the Government of Kerala guidelines. The declared annual family income is Rs. ${incomeStr} (Rupees ${incomeWords} only), total land holding is ${application.land_holding_cents || 0} cents, and residential house area is ${application.house_area_sqft || 0} sq.ft. It is verified that the applicant's family does not own or possess assets exceeding the limits specified under applicable EWS criteria.`;

    case 'INCOME':
      return `This is to certify that the annual family income of Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, residing at ${citizen.address}, from all sources including salary, agriculture, business, profession, and other vocations has been verified from local registers to be Rs. ${incomeStr} (Rupees ${incomeWords} only) for the current financial year.`;

    case 'CASTE':
    case 'COMMUNITY':
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, residing at ${citizen.address}, belongs to the community recognized under the relevant state schedule, in the State of Kerala, as verified from local Panchayat family registers and vital records.`;

    case 'NON_CREAMY_LAYER':
    case 'NCL':
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, residing at ${citizen.address}, belongs to the Socially and Educationally Backward Class (SEBC) recognized by the Government of Kerala, and does not belong to the persons/sections (Creamy Layer) mentioned in the schedule to the government orders.`;

    case 'RESIDENCE':
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, has been continuously residing at ${citizen.address} within the territorial jurisdiction of ${issuingPanchayat.panchayat_name} Grama Panchayat, ${issuingPanchayat.district} District, Kerala.`;

    case 'NATIVITY':
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, residing at ${citizen.address}, is a native of the State of Kerala by birth and parentage within the jurisdiction of ${issuingPanchayat.panchayat_name} Grama Panchayat.`;

    default:
      return `This is to certify that Shri/Smt/Kum. ${citizen.full_name}, son/daughter of ${parentName}, residing at ${citizen.address}, has declared facts in their application for ${code} which have been verified and confirmed by ${issuingPanchayat.panchayat_name} Grama Panchayat records.`;
  }
}

/**
 * Generates the official Certificate PDF and saves it to storage/certificates/<cert_no>.pdf
 * Computes SHA-256 of the saved file and returns metadata.
 */
async function generateCertificatePdf({
  certificateNo,
  verificationCode,
  issueDate,
  validUntil,
  application,
  citizen,
  certificateType,
  issuingPanchayat,
  issuingOfficer,
  verifiedRequests = []
}) {
  const storageDir = path.join(__dirname, '../../storage/certificates');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const filePath = path.join(storageDir, `${certificateNo}.pdf`);
  const relativePath = `storage/certificates/${certificateNo}.pdf`;

  // Generate QR Code Buffer
  const qrUrl = `${env.FRONTEND_URL}/verify/${verificationCode}?src=qr`;
  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF'
    }
  });

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 32, bottom: 32, left: 36, right: 36 },
        info: {
          Title: `${certificateType.certificate_name} - ${certificateNo}`,
          Author: 'Connected Panchayat Local Self Government Kerala',
          Subject: certificateType.certificate_name,
          Keywords: `Connected Panchayat, Certificate, ${certificateNo}, Kerala`
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const pageWidth = 595.28;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // ~523 pt

      // 1. TOP HEADER BAND (Blue)
      doc.rect(margin, 32, contentWidth, 54).fill('#1E3A8A');
      doc.fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('CONNECTED PANCHAYAT', margin, 42, { width: contentWidth, align: 'center' });

      doc.fillColor('#DBEAFE')
        .font('Helvetica')
        .fontSize(8.5)
        .text('Government of Kerala • Local Self Government Department • Digital Inter-Panchayat Verification System', margin, 62, { width: contentWidth, align: 'center' });

      let currentY = 96;

      // 2. CERTIFICATE TITLE & ISSUING PANCHAYAT
      doc.fillColor('#1E3A8A')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(certificateType.certificate_name.toUpperCase(), margin, currentY, { width: contentWidth, align: 'center' });

      currentY += 18;

      doc.fillColor('#475569')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Issued by: ${issuingPanchayat.panchayat_name} Grama Panchayat, ${issuingPanchayat.district} District`, margin, currentY, { width: contentWidth, align: 'center' });

      currentY += 16;

      // Decorative divider
      doc.strokeColor('#CBD5E1').lineWidth(0.8).moveTo(margin, currentY).lineTo(margin + contentWidth, currentY).stroke();
      currentY += 10;

      // 3. METADATA SUMMARY BAR (3 columns: Cert No, Issue Date, Valid Until)
      const colW = contentWidth / 3;
      doc.rect(margin, currentY, contentWidth, 28).fillAndStroke('#F8FAFC', '#E2E8F0');

      // Col 1: Cert No
      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('CERTIFICATE NUMBER', margin + 8, currentY + 4);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(certificateNo, margin + 8, currentY + 14);

      // Col 2: Issue Date
      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('DATE OF ISSUE', margin + colW + 8, currentY + 4);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(new Date(issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), margin + colW + 8, currentY + 14);

      // Col 3: Valid Until
      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('VALID UNTIL', margin + colW * 2 + 8, currentY + 4);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(new Date(validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), margin + colW * 2 + 8, currentY + 14);

      currentY += 36;

      // 4. APPLICANT PARTICULARS BOX
      doc.rect(margin, currentY, contentWidth, 68).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.rect(margin, currentY, contentWidth, 16).fill('#F1F5F9');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(8).text('APPLICANT PARTICULARS', margin + 8, currentY + 4);

      const appY = currentY + 22;
      const maskedAadhaar = citizen.aadhaar_no
        ? `XXXX XXXX ${citizen.aadhaar_no.slice(-4)}`
        : 'XXXX XXXX 1234';

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Full Name:', margin + 8, appY);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(citizen.full_name, margin + 65, appY);

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Aadhaar No:', margin + colW * 2, appY);
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(maskedAadhaar, margin + colW * 2 + 55, appY);

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Date of Birth:', margin + 8, appY + 14);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(8).text(citizen.date_of_birth ? new Date(citizen.date_of_birth).toLocaleDateString('en-IN') : 'N/A', margin + 65, appY + 14);

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Gender:', margin + colW * 2, appY + 14);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(8).text(citizen.gender || 'N/A', margin + colW * 2 + 55, appY + 14);

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Address:', margin + 8, appY + 28);
      doc.fillColor('#0F172A').font('Helvetica').fontSize(8).text(citizen.address, margin + 65, appY + 28, { width: contentWidth - 75 });

      currentY += 76;

      // 5. CERTIFICATION STATEMENT PARAGRAPH
      doc.rect(margin, currentY, contentWidth, 80).fillAndStroke('#F8FAFC', '#CBD5E1');
      doc.rect(margin, currentY, contentWidth, 16).fill('#E2E8F0');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(8).text('OFFICIAL CERTIFICATION STATEMENT', margin + 8, currentY + 4);

      const statementText = getStatementParagraph(certificateType.certificate_code, {
        citizen,
        application,
        issuingPanchayat,
        parties: application.parties || []
      });

      doc.fillColor('#0F172A')
        .font('Helvetica')
        .fontSize(8.2)
        .text(statementText, margin + 8, currentY + 22, {
          width: contentWidth - 16,
          align: 'justify',
          lineGap: 2.2
        });

      currentY += 88;

      // 6. VERIFICATION SUMMARY TABLE (Inter-Panchayat provenance)
      const approvedRequests = (verifiedRequests || []).filter(r => r.status === 'APPROVED');
      const tableHeight = approvedRequests.length > 0 ? 30 + approvedRequests.length * 18 : 38;

      doc.rect(margin, currentY, contentWidth, tableHeight).fillAndStroke('#FFFFFF', '#CBD5E1');
      doc.rect(margin, currentY, contentWidth, 16).fill('#F1F5F9');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(8).text('INTER-PANCHAYAT VERIFICATION PROVENANCE & DIGITAL SIGNATURES', margin + 8, currentY + 4);

      if (approvedRequests.length === 0) {
        doc.fillColor('#64748B')
          .font('Helvetica-Oblique')
          .fontSize(8)
          .text('No external verification required (all records and declarations verified internally by issuing panchayat).', margin + 8, currentY + 22);
      } else {
        // Table Columns
        const tY = currentY + 18;
        doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(7.2);
        doc.text('PARTY', margin + 8, tY);
        doc.text('PANCHAYAT', margin + 60, tY);
        doc.text('OFFICER / SIGNER', margin + 175, tY);
        doc.text('DECISION', margin + 300, tY);
        doc.text('SIGNED AT', margin + 355, tY);
        doc.text('KEY FINGERPRINT', margin + 430, tY);

        doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(margin, tY + 9).lineTo(margin + contentWidth, tY + 9).stroke();

        let rowY = tY + 12;
        for (const req of approvedRequests) {
          const fp = req.signer_key_fingerprint ? req.signer_key_fingerprint.slice(0, 16) + '...' : 'RSA-2048';
          const signer = req.signer_name || 'Secretary';
          const panchayat = req.verifying_panchayat_name || 'Verifying GP';
          const signDate = req.signed_at ? new Date(req.signed_at).toLocaleDateString('en-IN') : 'Verified';

          doc.fillColor('#0F172A').font('Helvetica').fontSize(7.5);
          doc.text(req.subject_party || 'PARTY', margin + 8, rowY);
          doc.text(panchayat.slice(0, 22), margin + 60, rowY);
          doc.text(signer.slice(0, 22), margin + 175, rowY);
          doc.fillColor('#059669').font('Helvetica-Bold').text('APPROVED', margin + 300, rowY);
          doc.fillColor('#0F172A').font('Helvetica').text(signDate, margin + 355, rowY);
          doc.fillColor('#475569').font('Courier').fontSize(7).text(fp, margin + 430, rowY);

          rowY += 16;
        }
      }

      currentY += tableHeight + 12;

      // 7. QR CODE & ISSUING OFFICER ENDORSEMENT
      const bottomHeight = 94;
      doc.rect(margin, currentY, contentWidth, bottomHeight).fillAndStroke('#FFFFFF', '#CBD5E1');

      // Left Column: QR Code + Verification instructions
      doc.image(qrBuffer, margin + 10, currentY + 8, { width: 78, height: 78 });

      const qrTextX = margin + 96;
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(8.5).text('AUTHENTICITY VERIFICATION', qrTextX, currentY + 12);
      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Scan QR code with smartphone or verify online at:', qrTextX, currentY + 25);
      doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(7.8).text(`${env.FRONTEND_URL}/verify`, qrTextX, currentY + 36);

      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text('Security Verification Code:', qrTextX, currentY + 50);
      doc.fillColor('#0F172A').font('Courier-Bold').fontSize(9.5).text(verificationCode, qrTextX, currentY + 62);

      // Vertical line separator
      const midX = margin + 270;
      doc.strokeColor('#E2E8F0').lineWidth(0.8).moveTo(midX, currentY + 8).lineTo(midX, currentY + bottomHeight - 8).stroke();

      // Right Column: Digital Sign-off Block
      const offX = midX + 16;
      doc.fillColor('#059669').font('Helvetica-Bold').fontSize(8.5).text('✓ DIGITALLY SIGNED & ISSUED', offX, currentY + 12);

      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9).text(issuingOfficer.full_name, offX, currentY + 28);
      doc.fillColor('#475569').font('Helvetica').fontSize(7.8).text(issuingOfficer.designation || 'Panchayat Secretary', offX, currentY + 41);
      doc.fillColor('#475569').font('Helvetica').fontSize(7.8).text(`${issuingPanchayat.panchayat_name} Grama Panchayat`, offX, currentY + 53);
      doc.fillColor('#64748B').font('Helvetica-Oblique').fontSize(7).text('Connected Panchayat LSGD Framework • Kerala', offX, currentY + 67);

      // 8. FOOTER
      const footerY = 808;
      doc.strokeColor('#CBD5E1').lineWidth(0.5).moveTo(margin, footerY).lineTo(margin + contentWidth, footerY).stroke();

      doc.fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(7)
        .text('System generated certificate - Academic MCA project demo. Verify at: ' + `${env.FRONTEND_URL}/verify/${verificationCode}`, margin, footerY + 5, {
          width: contentWidth,
          align: 'center'
        });

      doc.end();

      writeStream.on('finish', () => {
        try {
          const fileBytes = fs.readFileSync(filePath);
          const fileHash = crypto.createHash('sha256').update(fileBytes).digest('hex');

          resolve({
            file_path: relativePath,
            absolute_path: filePath,
            certificate_hash: fileHash,
            certificate_no: certificateNo,
            verification_code: verificationCode
          });
        } catch (err) {
          reject(err);
        }
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateCertificatePdf,
  numberToWords,
  getStatementParagraph
};
