import { Controller, Get, Hidden, Route, Security, SuccessResponse } from 'tsoa';
import { inject, injectable } from 'tsyringe';
import { HttpStatusCode } from '../types/Enum/HttpStatusCode';
import { HealthService } from '../services/Health';
import { AuthSchemes } from '../middlewares/Authentication';

@injectable()
@Route('api/health')
@Security(AuthSchemes.admin)
export class HealthController extends Controller {
  constructor(
    @inject(HealthService)
    private healthService: HealthService,
  ) {
    super();
  }

  /**
   * Health check
   * @summary Health check
   */
  @Security(AuthSchemes.admin)
  @Get()
  @SuccessResponse('200', 'OK')
  @Hidden()
  public get(): string {
    const healthStatus = this.healthService.checkHealth();
    this.setStatus(HttpStatusCode.OK);

    return healthStatus;
  }
}
