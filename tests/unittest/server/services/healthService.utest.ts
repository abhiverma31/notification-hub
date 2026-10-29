import 'reflect-metadata';
import { HealthService } from '../../../../src/server/services/Health';

describe('HealthService', () => {
  it('should return OK', () => {
    const healthService = new HealthService();
    expect(healthService.checkHealth()).toBe('OK');
  });
});
