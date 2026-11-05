import { injectable } from 'tsyringe';
import { ServerLogger } from '../utils/ServerLogger';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface HealthServiceType {
  checkHealth: () => HealthResponse;
}

@injectable()
export class HealthService implements HealthServiceType {
  private readonly logger = new ServerLogger();

  public checkHealth(): HealthResponse {
    return { status: 'OK', service: 'notification-hub' };
  }
}
