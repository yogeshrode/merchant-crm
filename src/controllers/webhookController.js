const webhookService = require('../services/webhookService');

// Register a new webhook subscription
const registerWebhook = async (req, res, next) => {
  try {
    const { url, events, description } = req.body;

    const subscription = await webhookService.registerWebhook(url, events, description);

    res.status(201).json({
      success: true,
      message: 'Webhook registered successfully',
      data: { subscription }
    });
  } catch (error) {
    next(error);
  }
};

// Get delivery history
const getDeliveryHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const result = await webhookService.getDeliveryHistory({ page, limit, status });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerWebhook, getDeliveryHistory };
