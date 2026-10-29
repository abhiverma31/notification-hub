import { HealthController } from '../../../../src/server/controllers/Health';
import { HealthService, HealthServiceType } from '../../../../src/server/services/Health';

describe('Health controller', () => {
  let healthController: HealthController;
  let healthService: HealthServiceType;

  beforeEach(() => {
    healthService = new HealthService();
    healthController = new HealthController(healthService);
  });

  it('should return "OK" when calling healthAPI', async () => {
    healthController.setStatus = jest.fn();

    const expectedResponse = healthController.get();

    expect(healthController.setStatus).toHaveBeenCalledWith(200);
    expect(expectedResponse).toBe('OK');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
