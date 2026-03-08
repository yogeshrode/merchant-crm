const { query } = require('../db');

// Define valid status transitions
// Key: current status, Value: array of allowed next statuses
const VALID_TRANSITIONS = {
  pending_kyb: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'] // Cannot go back to pending_kyb
};

// Check if a status transition is valid
const isValidTransition = (currentStatus, newStatus) => {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  return allowedTransitions && allowedTransitions.includes(newStatus);
};

// Get human-readable transition error message
const getTransitionErrorMessage = (currentStatus, newStatus) => {
  const validNext = VALID_TRANSITIONS[currentStatus];
  return `Cannot transition from "${currentStatus}" to "${newStatus}". ` +
         `Valid transitions from "${currentStatus}" are: ${validNext.join(', ')}`;
};

// Check if merchant has all required documents verified
const hasAllDocumentsVerified = async (merchantId) => {
  const result = await query(
    `SELECT document_type, is_verified 
     FROM documents 
     WHERE merchant_id = $1 
     AND document_type IN ('business_registration', 'owner_identity', 'bank_account_proof')`,
    [merchantId]
  );

  const requiredDocs = ['business_registration', 'owner_identity', 'bank_account_proof'];
  const verifiedDocs = result.rows.filter(d => d.is_verified).map(d => d.document_type);
  
  const missingDocs = requiredDocs.filter(doc => !verifiedDocs.includes(doc));
  
  return {
    isComplete: missingDocs.length === 0,
    missingDocs,
    verifiedDocs
  };
};

// Validate status change with business rules
const validateStatusChange = async (merchantId, newStatus, currentStatus) => {
  // Check if transition is valid
  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      valid: false,
      message: getTransitionErrorMessage(currentStatus, newStatus)
    };
  }

  // If activating, check all documents are verified
  if (newStatus === 'active' && currentStatus === 'pending_kyb') {
    const docStatus = await hasAllDocumentsVerified(merchantId);
    
    if (!docStatus.isComplete) {
      return {
        valid: false,
        message: `Cannot activate merchant. Missing or unverified documents: ${docStatus.missingDocs.join(', ')}`
      };
    }
  }

  return { valid: true };
};

// Get KYB status summary for a merchant
const getKybStatus = async (merchantId) => {
  const [merchantResult, documentsResult] = await Promise.all([
    query('SELECT status, kyb_verified_at FROM merchants WHERE id = $1', [merchantId]),
    query(
      `SELECT document_type, is_verified, verified_at 
       FROM documents 
       WHERE merchant_id = $1`,
      [merchantId]
    )
  ]);

  if (merchantResult.rows.length === 0) {
    return null;
  }

  const merchant = merchantResult.rows[0];
  const documents = documentsResult.rows;

  const requiredDocs = ['business_registration', 'owner_identity', 'bank_account_proof'];
  const docStatus = {};
  
  for (const docType of requiredDocs) {
    const doc = documents.find(d => d.document_type === docType);
    docStatus[docType] = {
      uploaded: !!doc,
      verified: doc ? doc.is_verified : false,
      verified_at: doc ? doc.verified_at : null
    };
  }

  return {
    merchant_status: merchant.status,
    kyb_verified_at: merchant.kyb_verified_at,
    documents: docStatus,
    can_activate: merchant.status === 'pending_kyb' && 
                  requiredDocs.every(type => docStatus[type].verified)
  };
};

module.exports = {
  isValidTransition,
  validateStatusChange,
  hasAllDocumentsVerified,
  getKybStatus,
  VALID_TRANSITIONS
};
