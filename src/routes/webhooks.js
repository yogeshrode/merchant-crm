const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { validateBody, validateQuery } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { webhookSubscriptionSchema, searchSchema } = require('../utils/validation');

// All routes require admin access
router.use(authenticate);
router.use(requireAdmin);

// Webhook routes
router.post('/', validateBody(webhookSubscriptionSchema), webhookController.registerWebhook);
router.get('/deliveries', validateQuery(searchSchema), webhookController.getDeliveryHistory);

module.exports = router;
