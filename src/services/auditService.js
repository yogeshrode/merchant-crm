const { query } = require('../db');

// Log an action to the audit log
const logAction = async (merchantId, operatorId, action, details = {}) => {
  try {
    const result = await query(
      `INSERT INTO audit_logs (merchant_id, operator_id, action, field_name, old_value, new_value, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        merchantId,
        operatorId,
        action,
        details.field_name || null,
        details.old_value || null,
        details.new_value || null,
        details.extra || null
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

// Log merchant creation
const logMerchantCreated = async (merchantId, operatorId, merchantData) => {
  return logAction(merchantId, operatorId, 'MERCHANT_CREATED', {
    extra: { merchantData }
  });
};

// Log merchant update
const logMerchantUpdated = async (merchantId, operatorId, oldData, newData) => {
  const changes = [];
  
  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes.push({
        field: key,
        old: oldData[key],
        new: newData[key]
      });
    }
  }
  
  return logAction(merchantId, operatorId, 'MERCHANT_UPDATED', {
    extra: { changes }
  });
};

// Log status change
const logStatusChange = async (merchantId, operatorId, oldStatus, newStatus, reason) => {
  return logAction(merchantId, operatorId, 'STATUS_CHANGED', {
    field_name: 'status',
    old_value: oldStatus,
    new_value: newStatus,
    extra: { reason }
  });
};

// Log document upload
const logDocumentUploaded = async (merchantId, operatorId, documentType, fileName) => {
  return logAction(merchantId, operatorId, 'DOCUMENT_UPLOADED', {
    field_name: 'document',
    new_value: documentType,
    extra: { fileName }
  });
};

// Log document verification
const logDocumentVerified = async (merchantId, operatorId, documentType, verified) => {
  return logAction(merchantId, operatorId, verified ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED', {
    field_name: 'document',
    new_value: documentType,
    extra: { verified }
  });
};

// Log merchant deletion
const logMerchantDeleted = async (merchantId, operatorId, merchantData) => {
  return logAction(merchantId, operatorId, 'MERCHANT_DELETED', {
    extra: { deletedData: merchantData }
  });
};

// Get audit history for a merchant
const getMerchantHistory = async (merchantId, options = {}) => {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const [countResult, logsResult] = await Promise.all([
    query('SELECT COUNT(*) FROM audit_logs WHERE merchant_id = $1', [merchantId]),
    query(
      `SELECT al.*, 
              o.first_name || ' ' || o.last_name as operator_name,
              o.email as operator_email
       FROM audit_logs al
       LEFT JOIN operators o ON al.operator_id = o.id
       WHERE al.merchant_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [merchantId, limit, offset]
    )
  ]);

  const totalCount = parseInt(countResult.rows[0].count);

  return {
    logs: logsResult.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

module.exports = {
  logAction,
  logMerchantCreated,
  logMerchantUpdated,
  logStatusChange,
  logDocumentUploaded,
  logDocumentVerified,
  logMerchantDeleted,
  getMerchantHistory
};
