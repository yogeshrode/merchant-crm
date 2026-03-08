const kybService = require('../src/services/kybService');
const { query } = require('../src/db');

describe('KYB Service', () => {
  describe('isValidTransition', () => {
    it('should allow pending_kyb to active', () => {
      expect(kybService.isValidTransition('pending_kyb', 'active')).toBe(true);
    });

    it('should allow pending_kyb to suspended', () => {
      expect(kybService.isValidTransition('pending_kyb', 'suspended')).toBe(true);
    });

    it('should allow active to suspended', () => {
      expect(kybService.isValidTransition('active', 'suspended')).toBe(true);
    });

    it('should allow suspended to active', () => {
      expect(kybService.isValidTransition('suspended', 'active')).toBe(true);
    });

    it('should NOT allow suspended to pending_kyb', () => {
      expect(kybService.isValidTransition('suspended', 'pending_kyb')).toBe(false);
    });

    it('should NOT allow active to pending_kyb', () => {
      expect(kybService.isValidTransition('active', 'pending_kyb')).toBe(false);
    });
  });

  describe('getTransitionErrorMessage', () => {
    it('should return helpful error message', () => {
      const message = kybService.getTransitionErrorMessage('suspended', 'pending_kyb');
      expect(message).toContain('Cannot transition');
      expect(message).toContain('suspended');
      expect(message).toContain('pending_kyb');
    });
  });

  describe('hasAllDocumentsVerified', () => {
    let testMerchantId;

    beforeAll(async () => {
      // Create test merchant
      const result = await query(
        `INSERT INTO merchants (business_name, business_category, city, contact_email, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['KYB Test', 'Retail', 'Casablanca', 'kyb@test.com', 'pending_kyb']
      );
      testMerchantId = result.rows[0].id;
    });

    afterAll(async () => {
      // Cleanup
      await query('DELETE FROM documents WHERE merchant_id = $1', [testMerchantId]);
      await query('DELETE FROM merchants WHERE id = $1', [testMerchantId]);
    });

    it('should return missing documents when none exist', async () => {
      const result = await kybService.hasAllDocumentsVerified(testMerchantId);
      
      expect(result.isComplete).toBe(false);
      expect(result.missingDocs).toContain('business_registration');
      expect(result.missingDocs).toContain('owner_identity');
      expect(result.missingDocs).toContain('bank_account_proof');
    });

    it('should return complete when all documents verified', async () => {
      // Insert all required documents as verified
      const docTypes = ['business_registration', 'owner_identity', 'bank_account_proof'];
      
      for (const docType of docTypes) {
        await query(
          `INSERT INTO documents (merchant_id, document_type, file_url, is_verified)
           VALUES ($1, $2, $3, $4)`,
          [testMerchantId, docType, 'http://test.com/doc.pdf', true]
        );
      }

      const result = await kybService.hasAllDocumentsVerified(testMerchantId);
      
      expect(result.isComplete).toBe(true);
      expect(result.missingDocs).toHaveLength(0);
    });
  });

  describe('validateStatusChange', () => {
    let testMerchantId;

    beforeAll(async () => {
      const result = await query(
        `INSERT INTO merchants (business_name, business_category, city, contact_email, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        ['KYB Test 2', 'Retail', 'Casablanca', 'kyb2@test.com', 'pending_kyb']
      );
      testMerchantId = result.rows[0].id;
    });

    afterAll(async () => {
      await query('DELETE FROM documents WHERE merchant_id = $1', [testMerchantId]);
      await query('DELETE FROM merchants WHERE id = $1', [testMerchantId]);
    });

    it('should reject activation without documents', async () => {
      const result = await kybService.validateStatusChange(
        testMerchantId,
        'active',
        'pending_kyb'
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Missing or unverified documents');
    });

    it('should allow valid transition', async () => {
      // Add all verified documents
      const docTypes = ['business_registration', 'owner_identity', 'bank_account_proof'];
      
      for (const docType of docTypes) {
        await query(
          `INSERT INTO documents (merchant_id, document_type, file_url, is_verified)
           VALUES ($1, $2, $3, $4)`,
          [testMerchantId, docType, 'http://test.com/doc.pdf', true]
        );
      }

      const result = await kybService.validateStatusChange(
        testMerchantId,
        'active',
        'pending_kyb'
      );

      expect(result.valid).toBe(true);
    });
  });
});
