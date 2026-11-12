import 'reflect-metadata';
import { HealthController } from '../../../../src/server/controllers/Health';
import { HealthService, HealthServiceType } from '../../../../src/server/services/Health';

describe('Health controller', () => {
  let healthController: HealthController;
  let healthService: HealthServiceType;

  beforeEach(() => {
    healthService = new HealthService();
    healthController = new HealthController(healthService);
  });

  it('should return the health response with HTTP 200', () => {
    healthController.setStatus = jest.fn();

    const response = {
      status: 'OK' as const,
      service: 'notification-hub' as const,
      timestamp: '2026-11-12T12:22:58.000Z',
    };
    jest.spyOn(healthService, 'checkHealth').mockReturnValue(response);

    const actualResponse = healthController.get();

    expect(healthController.setStatus).toHaveBeenCalledWith(200);
    expect(actualResponse).toEqual(response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
