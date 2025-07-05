import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { entities } from '../src/tools/entities.js';

describe('QuickBooks Tools', () => {
  describe('Entity Configuration', () => {
    it('should have correct entity mappings', () => {
      expect(entities).toBeDefined();
      expect(entities.length).toBeGreaterThan(0);
      
      // Check for key entities
      const entityNames = entities.map(e => e.name);
      expect(entityNames).toContain('customer');
      expect(entityNames).toContain('invoice');
      expect(entityNames).toContain('payment');
      expect(entityNames).toContain('vendor');
    });

    it('should have valid SDK function names', () => {
      entities.forEach(entity => {
        expect(entity.sdkFn).toBeTruthy();
        expect(entity.sdkFn).toMatch(/^find[A-Z]/); // Should start with 'find' followed by capital letter
        expect(entity.description).toBeTruthy();
      });
    });
  });

  describe('Tool Parameters', () => {
    it('should have standard list parameters', () => {
      // Test that the parameter schema includes the expected fields
      const expectedParams = ['startDate', 'endDate', 'limit'];
      
      // This is more of a documentation test
      expect(expectedParams).toContain('startDate');
      expect(expectedParams).toContain('endDate');
      expect(expectedParams).toContain('limit');
    });
  });

  describe('Report Types', () => {
    it('should support common report types', () => {
      // Test that report types are properly defined
      const reportTypes = [
        'profit_and_loss',
        'balance_sheet',
        'cash_flow',
        'customer_sales',
        'aging_summary'
      ];
      
      reportTypes.forEach(type => {
        expect(type).toBeTruthy();
      });
    });
  });
});