const fs = require('fs');
const path = require('path');
const { query } = require('../config/db');
const { error } = require('../utils/apiResponse');

/**
 * Streams an uploaded document file
 * GET /api/documents/:id/file
 *
 * Permission rules (Section 4 & Section 9):
 * - Citizen: must be the owner citizen of the application.
 * - Officer: home panchayat officer of the application OR
 *            verifying officer ONLY IF doc.related_to equals subject_party of a request
 *            addressed to their panchayat for that application.
 * - Admin: NOT allowed (returns 404).
 * - Anyone else: 404.
 */
async function streamDocumentFile(req, res) {
  try {
    const docId = Number(req.params.id);
    if (!docId) {
      return error(res, 'Document not found', {}, 404);
    }

    const docRows = await query(
      'SELECT * FROM application_documents WHERE document_id = ?',
      [docId]
    );
    const doc = Array.isArray(docRows) ? docRows[0] : docRows;
    if (!doc) {
      return error(res, 'Document not found', {}, 404);
    }

    const appRows = await query(
      'SELECT application_id, citizen_id, home_panchayat_id FROM applications WHERE application_id = ?',
      [doc.application_id]
    );
    const app = Array.isArray(appRows) ? appRows[0] : appRows;
    if (!app) {
      return error(res, 'Document not found', {}, 404);
    }

    const userRole = req.user.role;
    let allowed = false;

    if (userRole === 'CITIZEN') {
      const citRows = await query(
        'SELECT citizen_id FROM citizens WHERE user_id = ?',
        [req.user.user_id]
      );
      const citizen = Array.isArray(citRows) ? citRows[0] : citRows;
      if (citizen && citizen.citizen_id === app.citizen_id) {
        allowed = true;
      }
    } else if (userRole === 'OFFICER') {
      const officerPanchayatId = req.user.panchayat_id;
      // Home officer check
      if (Number(officerPanchayatId) === Number(app.home_panchayat_id)) {
        allowed = true;
      } else {
        // Verifying officer check: request addressed to officer's panchayat for this application matching related_to
        const vrRows = await query(
          `SELECT verification_id FROM verification_requests
           WHERE application_id = ? AND verifying_panchayat_id = ? AND subject_party = ?
           LIMIT 1`,
          [app.application_id, officerPanchayatId, doc.related_to]
        );
        const vr = Array.isArray(vrRows) ? vrRows[0] : vrRows;
        if (vr) {
          allowed = true;
        }
      }
    } else if (userRole === 'ADMIN') {
      // ADMIN is explicitly not allowed to view/open documents
      allowed = false;
    }

    if (!allowed) {
      return error(res, 'Document not found', {}, 404);
    }

    const filePath = path.isAbsolute(doc.file_path)
      ? doc.file_path
      : path.join(__dirname, '../../', doc.file_path);

    if (!fs.existsSync(filePath)) {
      return error(res, 'File not found on storage', {}, 404);
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_file_name)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error streaming document:', err);
    return error(res, 'Failed to fetch document', {}, 500);
  }
}

module.exports = {
  streamDocumentFile
};
