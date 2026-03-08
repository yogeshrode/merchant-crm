const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const documentController = require('../controllers/documentController');
const auditController = require('../controllers/auditController');
const { validateBody, validateQuery } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  createMerchantSchema,
  updateMerchantSchema,
  statusChangeSchema,
  documentSchema,
  verifyDocumentSchema,
  searchSchema
} = require('../utils/validation');

// All routes require authentication
router.use(authenticate);

// Merchant CRUD routes
router.post('/', validateBody(createMerchantSchema), merchantController.createMerchant);
router.get('/', validateQuery(searchSchema), merchantController.getMerchants);
router.get('/:id', merchantController.getMerchant);
router.patch('/:id', validateBody(updateMerchantSchema), merchantController.updateMerchant);
router.delete('/:id', requireAdmin, merchantController.deleteMerchant);

// Status change route
router.patch('/:id/status', validateBody(statusChangeSchema), merchantController.changeStatus);

// Document routes
router.post('/:id/documents', validateBody(documentSchema), documentController.uploadDocument);
router.get('/:id/documents', documentController.getDocuments);
router.patch('/:merchantId/documents/:documentId/verify', validateBody(verifyDocumentSchema), documentController.verifyDocument);
router.delete('/:id/documents/:documentId', requireAdmin, documentController.deleteDocument);

// Audit log route
router.get('/:id/history', auditController.getMerchantHistory);

module.exports = router;
