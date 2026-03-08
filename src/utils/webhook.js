const crypto = require('crypto');

// Generate HMAC signature for webhook payload
const generateWebhookSignature = (payload, secret) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return { signature, timestamp, signedPayload };
};

// Verify webhook signature (for testing/validation)
const verifyWebhookSignature = (payload, signature, timestamp, secret) => {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

module.exports = {
  generateWebhookSignature,
  verifyWebhookSignature
};
