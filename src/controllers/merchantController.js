const { query } = require('../db');
const kybService = require('../services/kybService');
const auditService = require('../services/auditService');
const webhookService = require('../services/webhookService');

// Create a new merchant
const createMerchant = async (req, res, next) => {
  try {
    const {
      business_name,
      business_category,
      registration_number,
      tax_id,
      city,
      address,
      contact_email,
      contact_phone,
      pricing_tier
    } = req.body;

    const result = await query(
      `INSERT INTO merchants (business_name, business_category, registration_number, tax_id, city, address, contact_email, contact_phone, pricing_tier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [business_name, business_category, registration_number, tax_id, city, address, contact_email, contact_phone, pricing_tier]
    );

    const merchant = result.rows[0];

    // Log the creation
    await auditService.logMerchantCreated(merchant.id, req.operator.id, req.body);

    // Trigger webhook
    webhookService.triggerEvent('merchant.created', {
      merchantId: merchant.id,
      businessName: merchant.business_name,
      status: merchant.status,
      createdAt: merchant.created_at
    });

    res.status(201).json({
      success: true,
      message: 'Merchant created successfully',
      data: { merchant }
    });
  } catch (error) {
    next(error);
  }
};

// Get all merchants with search and filter
const getMerchants = async (req, res, next) => {
  try {
    const { status, city, category, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (city) {
      whereConditions.push(`city ILIKE $${paramIndex++}`);
      params.push(`%${city}%`);
    }

    if (category) {
      whereConditions.push(`business_category ILIKE $${paramIndex++}`);
      params.push(`%${category}%`);
    }

    if (search) {
      whereConditions.push(`(business_name ILIKE $${paramIndex} OR contact_email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [countResult, merchantsResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM merchants ${whereClause}`, params),
      query(
        `SELECT * FROM merchants ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      )
    ]);

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        merchants: merchantsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single merchant by ID
const getMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM merchants WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Get documents
    const docsResult = await query(
      'SELECT id, document_type, file_url, file_name, is_verified, verified_at FROM documents WHERE merchant_id = $1',
      [id]
    );

    // Get KYB status
    const kybStatus = await kybService.getKybStatus(id);

    res.json({
      success: true,
      data: {
        merchant: result.rows[0],
        documents: docsResult.rows,
        kybStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update merchant
const updateMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if merchant exists
    const existingResult = await query('SELECT * FROM merchants WHERE id = $1', [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const existing = existingResult.rows[0];

    // Only admin can change pricing tier
    if (req.body.pricing_tier && req.operator.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change pricing tier'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = ['business_name', 'business_category', 'registration_number', 'tax_id', 'city', 'address', 'contact_email', 'contact_phone', 'pricing_tier'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE merchants SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updated = result.rows[0];

    // Log the update
    await auditService.logMerchantUpdated(id, req.operator.id, existing, updated);

    res.json({
      success: true,
      message: 'Merchant updated successfully',
      data: { merchant: updated }
    });
  } catch (error) {
    next(error);
  }
};

// Delete merchant (admin only)
const deleteMerchant = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if merchant exists
    const existingResult = await query('SELECT * FROM merchants WHERE id = $1', [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    // Log deletion before deleting
    await auditService.logMerchantDeleted(id, req.operator.id, existingResult.rows[0]);

    // Delete merchant (cascade will handle related records)
    await query('DELETE FROM merchants WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Merchant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Change merchant status
const changeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Check if merchant exists
    const existingResult = await query('SELECT * FROM merchants WHERE id = $1', [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    const merchant = existingResult.rows[0];
    const currentStatus = merchant.status;

    // Validate status transition
    const validation = await kybService.validateStatusChange(id, status, currentStatus);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Update status
    const updateFields = ['status = $1'];
    const values = [status];

    // If activating, set kyb_verified_at
    if (status === 'active' && currentStatus === 'pending_kyb') {
      updateFields.push('kyb_verified_at = CURRENT_TIMESTAMP');
    }

    values.push(id);

    const result = await query(
      `UPDATE merchants SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values
    );

    const updated = result.rows[0];

    // Log status change
    await auditService.logStatusChange(id, req.operator.id, currentStatus, status, reason);

    // Trigger webhook
    const eventType = status === 'active' ? 'merchant.approved' : 'merchant.suspended';
    webhookService.triggerEvent(eventType, {
      merchantId: id,
      businessName: merchant.business_name,
      oldStatus: currentStatus,
      newStatus: status,
      changedBy: req.operator.id,
      reason: reason || null,
      changedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Merchant status changed to ${status}`,
      data: { merchant: updated }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMerchant,
  getMerchants,
  getMerchant,
  updateMerchant,
  deleteMerchant,
  changeStatus
};
