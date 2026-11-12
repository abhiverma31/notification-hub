import 'reflect-metadata';
import { HealthService } from '../../../../src/server/services/Health';

describe('HealthService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return application liveness with the current server time on each call', () => {
    jest.useFakeTimers();
    const now = new Date('2026-11-12T12:22:58.000Z');
    jest.setSystemTime(now);
    const healthService = new HealthService();

    expect(healthService.checkHealth()).toEqual({
      status: 'OK',
      service: 'notification-hub',
      timestamp: now.toISOString(),
    });

    jest.setSystemTime(new Date(now.getTime() + 1000));
    expect(healthService.checkHealth().timestamp).toBe('2026-11-12T12:22:59.000Z');
  });
});
