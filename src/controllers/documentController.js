const { query } = require('../db');
const auditService = require('../services/auditService');

// Upload a document for a merchant
const uploadDocument = async (req, res, next) => {
  try {
    const { id: merchantId } = req.params;
    const { document_type, file_url, file_name } = req.body;

    // Check if merchant exists
    const merchantResult = await query('SELECT id FROM merchants WHERE id = $1', [merchantId]);

    if (merchantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Upsert document (insert or update if exists)
    const result = await query(
      `INSERT INTO documents (merchant_id, document_type, file_url, file_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (merchant_id, document_type)
       DO UPDATE SET 
         file_url = EXCLUDED.file_url,
         file_name = EXCLUDED.file_name,
         is_verified = false,
         verified_by = NULL,
         verified_at = NULL
       RETURNING *`,
      [merchantId, document_type, file_url, file_name]
    );

    const document = result.rows[0];

    // Log the upload
    await auditService.logDocumentUploaded(merchantId, req.operator.id, document_type, file_name);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document }
    });
  } catch (error) {
    next(error);
  }
};

// Get all documents for a merchant
const getDocuments = async (req, res, next) => {
  try {
    const { id: merchantId } = req.params;

    const result = await query(
      `SELECT d.*, 
              o.first_name || ' ' || o.last_name as verified_by_name
       FROM documents d
       LEFT JOIN operators o ON d.verified_by = o.id
       WHERE d.merchant_id = $1
       ORDER BY d.uploaded_at DESC`,
      [merchantId]
    );

    res.json({
      success: true,
      data: { documents: result.rows }
    });
  } catch (error) {
    next(error);
  }
};

// Verify or reject a document
const verifyDocument = async (req, res, next) => {
  try {
    const { merchantId, documentId } = req.params;
    const { verified, notes } = req.body;

    // Check if document exists
    const docResult = await query(
      'SELECT * FROM documents WHERE id = $1 AND merchant_id = $2',
      [documentId, merchantId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const document = docResult.rows[0];

    // Update verification status
    const result = await query(
      `UPDATE documents 
       SET is_verified = $1, 
           verified_by = $2, 
           verified_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           notes = $3
       WHERE id = $4
       RETURNING *`,
      [verified, req.operator.id, notes, documentId]
    );

    const updated = result.rows[0];

    // Log the verification
    await auditService.logDocumentVerified(merchantId, req.operator.id, document.document_type, verified);

    res.json({
      success: true,
      message: verified ? 'Document verified successfully' : 'Document rejected',
      data: { document: updated }
    });
  } catch (error) {
    next(error);
  }
};

// Delete a document
const deleteDocument = async (req, res, next) => {
  try {
    const { merchantId, documentId } = req.params;

    // Check if document exists
    const docResult = await query(
      'SELECT * FROM documents WHERE id = $1 AND merchant_id = $2',
      [documentId, merchantId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Delete the document
    await query('DELETE FROM documents WHERE id = $1', [documentId]);

    // Log the deletion
    await auditService.logAction(merchantId, req.operator.id, 'DOCUMENT_DELETED', {
      field_name: 'document',
      old_value: docResult.rows[0].document_type,
      extra: { fileName: docResult.rows[0].file_name }
    });

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  verifyDocument,
  deleteDocument
};
