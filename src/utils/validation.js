const Joi = require('joi');

// Login validation
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

// Register validation
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().min(2).max(100).required(),
  lastName: Joi.string().min(2).max(100).required(),
  role: Joi.string().valid('admin', 'operator').optional()
});

// Refresh token validation
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// Merchant creation validation
const createMerchantSchema = Joi.object({
  business_name: Joi.string().min(2).max(255).required(),
  business_category: Joi.string().min(2).max(100).required(),
  registration_number: Joi.string().max(100).optional(),
  tax_id: Joi.string().max(100).optional(),
  city: Joi.string().min(2).max(100).required(),
  address: Joi.string().optional(),
  contact_email: Joi.string().email().required(),
  contact_phone: Joi.string().max(50).optional(),
  pricing_tier: Joi.string().valid('basic', 'standard', 'premium').default('standard')
});

// Merchant update validation
const updateMerchantSchema = Joi.object({
  business_name: Joi.string().min(2).max(255).optional(),
  business_category: Joi.string().min(2).max(100).optional(),
  registration_number: Joi.string().max(100).optional(),
  tax_id: Joi.string().max(100).optional(),
  city: Joi.string().min(2).max(100).optional(),
  address: Joi.string().optional(),
  contact_email: Joi.string().email().optional(),
  contact_phone: Joi.string().max(50).optional(),
  pricing_tier: Joi.string().valid('basic', 'standard', 'premium').optional()
});

// Status change validation
const statusChangeSchema = Joi.object({
  status: Joi.string().valid('pending_kyb', 'active', 'suspended').required(),
  reason: Joi.string().min(5).optional()
});

// Document upload validation
const documentSchema = Joi.object({
  document_type: Joi.string().valid('business_registration', 'owner_identity', 'bank_account_proof').required(),
  file_url: Joi.string().uri().required(),
  file_name: Joi.string().optional()
});

// Document verification validation
const verifyDocumentSchema = Joi.object({
  verified: Joi.boolean().required(),
  notes: Joi.string().optional()
});

// Webhook subscription validation
const webhookSubscriptionSchema = Joi.object({
  url: Joi.string().uri().required(),
  events: Joi.array().items(
    Joi.string().valid('merchant.approved', 'merchant.suspended', 'merchant.created')
  ).optional(),
  description: Joi.string().optional()
});

// Search/filter validation
const searchSchema = Joi.object({
  status: Joi.string().valid('pending_kyb', 'active', 'suspended').optional(),
  city: Joi.string().optional(),
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

module.exports = {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  createMerchantSchema,
  updateMerchantSchema,
  statusChangeSchema,
  documentSchema,
  verifyDocumentSchema,
  webhookSubscriptionSchema,
  searchSchema
};
