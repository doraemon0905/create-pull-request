import { validateJiraTicket } from '../utils/validation';

describe('Validation Utils', () => {
  describe('validateJiraTicket', () => {
    it('should validate correct Jira ticket format', () => {
      expect(validateJiraTicket('PROJ-123')).toBe(true);
      expect(validateJiraTicket('ABC-1')).toBe(true);
      expect(validateJiraTicket('TEST-9999')).toBe(true);
    });

    it('should reject invalid Jira ticket formats', () => {
      expect(validateJiraTicket('proj-123')).toBe(false); // lowercase
      expect(validateJiraTicket('123-PROJ')).toBe(false); // numbers first
      expect(validateJiraTicket('PROJ123')).toBe(false);  // no dash
      expect(validateJiraTicket('PROJ-')).toBe(false);    // no number
      expect(validateJiraTicket('-123')).toBe(false);     // no project
      expect(validateJiraTicket('')).toBe(false);         // empty
    });
  });
});