const request = require('supertest');
const app = require('../src/index');
const { query } = require('../src/db');
const { hashPassword, generateAccessToken } = require('../src/utils/auth');

describe('Merchant Endpoints', () => {
  let accessToken;
  let adminToken;
  let testMerchantId;

  beforeAll(async () => {
    // Create test operator
    const hashedPassword = await hashPassword('TestPassword123!');
    const operatorResult = await query(
      `INSERT INTO operators (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING *`,
      ['merchant-test@example.com', hashedPassword, 'Test', 'User', 'operator', true]
    );

    // Create admin operator
    const adminResult = await query(
      `INSERT INTO operators (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING *`,
      ['admin-test@example.com', hashedPassword, 'Admin', 'User', 'admin', true]
    );

    accessToken = generateAccessToken({
      operatorId: operatorResult.rows[0].id,
      email: operatorResult.rows[0].email,
      role: operatorResult.rows[0].role
    });

    adminToken = generateAccessToken({
      operatorId: adminResult.rows[0].id,
      email: adminResult.rows[0].email,
      role: adminResult.rows[0].role
    });
  });

  describe('POST /api/merchants', () => {
    it('should create a new merchant', async () => {
      const res = await request(app)
        .post('/api/merchants')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          business_name: 'Test Business',
          business_category: 'Retail',
          city: 'Casablanca',
          contact_email: 'business@test.com',
          pricing_tier: 'standard'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant).toHaveProperty('id');
      expect(res.body.data.merchant.status).toBe('pending_kyb');
      
      testMerchantId = res.body.data.merchant.id;
    });

    it('should reject invalid data', async () => {
      const res = await request(app)
        .post('/api/merchants')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          business_name: 'A', // Too short
          city: 'Casablanca'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/merchants', () => {
    it('should get all merchants', async () => {
      const res = await request(app)
        .get('/api/merchants')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.merchants)).toBe(true);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/merchants?status=pending_kyb')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchants.every(m => m.status === 'pending_kyb')).toBe(true);
    });

    it('should search merchants', async () => {
      const res = await request(app)
        .get('/api/merchants?search=Test')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/merchants/:id', () => {
    it('should get a single merchant', async () => {
      const res = await request(app)
        .get(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant.id).toBe(testMerchantId);
    });

    it('should return 404 for non-existent merchant', async () => {
      const res = await request(app)
        .get('/api/merchants/99999')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/merchants/:id', () => {
    it('should update a merchant', async () => {
      const res = await request(app)
        .patch(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          business_name: 'Updated Business Name'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant.business_name).toBe('Updated Business Name');
    });

    it('should reject non-admin changing pricing tier', async () => {
      const res = await request(app)
        .patch(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          pricing_tier: 'premium'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow admin to change pricing tier', async () => {
      const res = await request(app)
        .patch(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pricing_tier: 'premium'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchant.pricing_tier).toBe('premium');
    });
  });

  describe('PATCH /api/merchants/:id/status', () => {
    it('should reject invalid status transition', async () => {
      const res = await request(app)
        .patch(`/api/merchants/${testMerchantId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'suspended',
          reason: 'Test suspension'
        });

      // Cannot go from pending_kyb to suspended directly
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject activation without verified documents', async () => {
      const res = await request(app)
        .patch(`/api/merchants/${testMerchantId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'active',
          reason: 'Test activation'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Missing or unverified documents');
    });
  });

  describe('DELETE /api/merchants/:id', () => {
    it('should reject non-admin deletion', async () => {
      const res = await request(app)
        .delete(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow admin to delete merchant', async () => {
      const res = await request(app)
        .delete(`/api/merchants/${testMerchantId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
