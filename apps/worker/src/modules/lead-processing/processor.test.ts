import { describe, expect, it } from 'vitest';
import { processLeadJob } from './processor';

describe('processLeadJob', () => {
  it('normalizes tenant and returns processed status', async () => {
    const result = await processLeadJob({
      tenantId: 'Empresa-X',
      leadId: 'lead-123',
      payload: { source: 'whatsapp' },
    });

    expect(result.tenantId).toBe('empresa-x');
    expect(result.leadId).toBe('lead-123');
    expect(result.status).toBe('processed');
    expect(result.processedAt).toBeTypeOf('string');
  });
});
