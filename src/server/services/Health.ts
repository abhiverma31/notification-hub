import { injectable } from 'tsyringe';
import { ServerLogger } from '../utils/ServerLogger';

export interface HealthServiceType {
  checkHealth: () => string;
}

@injectable()
export class HealthService implements HealthServiceType {
  private readonly logger = new ServerLogger();

  public checkHealth(): string {
    return 'OK';
  }
}
