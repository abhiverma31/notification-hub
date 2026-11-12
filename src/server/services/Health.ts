import { injectable } from 'tsyringe';

export interface HealthResponse {
  status: 'OK';
  service: 'notification-hub';
  timestamp: string;
}

export interface HealthServiceType {
  checkHealth: () => HealthResponse;
}

@injectable()
export class HealthService implements HealthServiceType {
  public checkHealth(): HealthResponse {
    return {
      status: 'OK',
      service: 'notification-hub',
      timestamp: new Date().toISOString(),
    };
  }
}
