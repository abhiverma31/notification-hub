import { inject, injectable } from 'tsyringe';
import { Get, Query, Request, Route } from 'tsoa';
import { Controller, Security, Tags } from '@tsoa/runtime';
import { AnalyticsService } from '../services/Analytics';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';
import { BadRequest } from '../utils/errors/BadRequest';

@injectable()
@Route('api/notification/analytics')
@Security(AuthSchemes.orgOwner)
@Security(AuthSchemes.frontendToken)
@Tags('Analytics')
export class AnalyticsController extends Controller {
  constructor(@inject(AnalyticsService) private analyticsService: AnalyticsService) {
    super();
  }

  @Get('overview')
  async getOverview(@Request() request: NHRequest, @Query() startDate: string, @Query() endDate: string) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getOverview(orgId, start, end);
  }

  @Get('volume-trend')
  async getVolumeTrend(
    @Request() request: NHRequest,
    @Query() startDate: string,
    @Query() endDate: string,
    @Query() granularity?: string,
    @Query() timezone?: string,
  ) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);
    const allowed = ['hour', 'day', 'week', 'month'];
    const safeGranularity = allowed.includes(granularity || '') ? granularity! : 'day';

    return this.analyticsService.getVolumeTrend(orgId, start, end, safeGranularity, this.validatedTimezone(timezone));
  }

  @Get('channel-breakdown')
  async getChannelBreakdown(@Request() request: NHRequest, @Query() startDate: string, @Query() endDate: string) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getChannelBreakdown(orgId, start, end);
  }

  @Get('delivery-speed')
  async getDeliverySpeed(@Request() request: NHRequest, @Query() startDate: string, @Query() endDate: string) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getDeliverySpeed(orgId, start, end);
  }

  @Get('time-to-see')
  async getTimeToSee(@Request() request: NHRequest, @Query() startDate: string, @Query() endDate: string) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getTimeToSee(orgId, start, end);
  }

  @Get('seen-by-hour')
  async getSeenByHour(
    @Request() request: NHRequest,
    @Query() startDate: string,
    @Query() endDate: string,
    @Query() timezone?: string,
  ) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getSeenByHour(orgId, start, end, this.validatedTimezone(timezone));
  }

  @Get('best-day')
  async getBestDay(
    @Request() request: NHRequest,
    @Query() startDate: string,
    @Query() endDate: string,
    @Query() timezone?: string,
  ) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getBestDay(orgId, start, end, this.validatedTimezone(timezone));
  }

  @Get('failures')
  async getFailures(
    @Request() request: NHRequest,
    @Query() startDate: string,
    @Query() endDate: string,
    @Query() limit?: number,
  ) {
    const { orgId, start, end } = this.parseParams(request, startDate, endDate);

    return this.analyticsService.getFailures(orgId, start, end, limit || 10);
  }

  private validatedTimezone(timezone?: string): string {
    const tz = timezone || 'UTC';
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      throw new BadRequest(`Invalid timezone: ${tz}`);
    }

    return tz;
  }

  private parseParams(request: NHRequest, startDate: string, endDate: string) {
    if (!startDate || !endDate) {
      throw new BadRequest('startDate and endDate are required');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequest('startDate and endDate must be valid ISO date strings');
    }
    if (!request.user?.organisation?._id) {
      throw new BadRequest('Organisation context is required');
    }
    const orgId = request.user.organisation._id.toString();

    return { orgId, start, end };
  }
}
