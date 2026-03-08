const auditService = require('../services/auditService');

// Get audit history for a merchant
const getMerchantHistory = async (req, res, next) => {
  try {
    const { id: merchantId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await auditService.getMerchantHistory(merchantId, { page, limit });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMerchantHistory };
