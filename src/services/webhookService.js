const { query } = require('../db');
const { generateWebhookSignature } = require('../utils/webhook');

// Register a new webhook subscription
const registerWebhook = async (url, events, description) => {
  const secret = require('crypto').randomBytes(32).toString('hex');
  
  const result = await query(
    `INSERT INTO webhook_subscriptions (url, secret, events, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, url, events, is_active, description, created_at`,
    [url, secret, events || ['merchant.approved', 'merchant.suspended'], description]
  );
  
  return result.rows[0];
};

// Get all active webhook subscriptions
const getActiveSubscriptions = async (eventType) => {
  const result = await query(
    `SELECT id, url, secret, events 
     FROM webhook_subscriptions 
     WHERE is_active = true 
     AND ($1 = ANY(events) OR 'all' = ANY(events))`,
    [eventType]
  );
  return result.rows;
};

// Create a delivery record
const createDelivery = async (subscriptionId, eventType, payload) => {
  const { signature } = generateWebhookSignature(payload, process.env.WEBHOOK_SECRET);
  
  const result = await query(
    `INSERT INTO webhook_deliveries (subscription_id, event_type, payload, signature)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [subscriptionId, eventType, JSON.stringify(payload), signature]
  );
  
  return result.rows[0];
};

// Update delivery status
const updateDeliveryStatus = async (deliveryId, status, responseStatus, responseBody) => {
  await query(
    `UPDATE webhook_deliveries 
     SET status = $2, 
         response_status = $3, 
         response_body = $4,
         attempt_count = attempt_count + 1,
         last_attempt_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN $2 IN ('delivered', 'failed') THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = $1`,
    [deliveryId, status, responseStatus, responseBody]
  );
};

// Send webhook notification (with retry logic)
const sendWebhook = async (subscription, eventType, payload, deliveryId) => {
  const maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3;
  const retryDelay = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS) || 5000;
  
  const { signature, timestamp } = generateWebhookSignature(payload, subscription.secret);
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Webhook-Event': eventType,
    'User-Agent': 'YQN-Pay-Webhook/1.0'
  };
  
  let attempt = 0;
  let lastError = null;
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const responseBody = await response.text();
      
      if (response.ok) {
        await updateDeliveryStatus(deliveryId, 'delivered', response.status, responseBody);
        console.log(`Webhook delivered: ${subscription.url} (${eventType})`);
        return { success: true, deliveryId };
      } else {
        lastError = `HTTP ${response.status}: ${responseBody}`;
        console.warn(`Webhook attempt ${attempt} failed: ${subscription.url} - ${lastError}`);
      }
    } catch (error) {
      lastError = error.message;
      console.warn(`Webhook attempt ${attempt} error: ${subscription.url} - ${lastError}`);
    }
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  // All retries exhausted
  await updateDeliveryStatus(deliveryId, 'failed', null, lastError);
  console.error(`Webhook failed after ${maxRetries} attempts: ${subscription.url}`);
  return { success: false, deliveryId, error: lastError };
};

// Trigger webhook event (runs in background)
const triggerEvent = async (eventType, payload) => {
  try {
    const subscriptions = await getActiveSubscriptions(eventType);
    
    if (subscriptions.length === 0) {
      console.log(`No active subscriptions for event: ${eventType}`);
      return;
    }
    
    console.log(`Triggering ${eventType} to ${subscriptions.length} subscribers`);
    
    // Create delivery records and send webhooks (don't await - run in background)
    for (const subscription of subscriptions) {
      const delivery = await createDelivery(subscription.id, eventType, payload);
      
      // Fire and forget - don't block the main request
      sendWebhook(subscription, eventType, payload, delivery.id).catch(err => {
        console.error('Webhook send error:', err);
      });
    }
  } catch (error) {
    console.error('Failed to trigger webhook event:', error);
    // Don't throw - webhook failures shouldn't break the main flow
  }
};

// Get delivery history
const getDeliveryHistory = async (options = {}) => {
  const { page = 1, limit = 20, status } = options;
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  const params = [limit, offset];
  
  if (status) {
    whereClause = 'WHERE wd.status = $3';
    params.push(status);
  }
  
  const [countResult, deliveriesResult] = await Promise.all([
    query(`SELECT COUNT(*) FROM webhook_deliveries wd ${whereClause}`, status ? [status] : []),
    query(
      `SELECT wd.*, ws.url as webhook_url
       FROM webhook_deliveries wd
       JOIN webhook_subscriptions ws ON wd.subscription_id = ws.id
       ${whereClause}
       ORDER BY wd.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    )
  ]);
  
  const totalCount = parseInt(countResult.rows[0].count);
  
  return {
    deliveries: deliveriesResult.rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

module.exports = {
  registerWebhook,
  getActiveSubscriptions,
  triggerEvent,
  getDeliveryHistory,
  sendWebhook
};
