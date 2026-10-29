import { inject, injectable } from 'tsyringe';
import { DeliveryReportService } from '../../consumer/services/DeliveryReport';
import { Response, Request, Get, Query, Route } from 'tsoa';
import { Controller, Path, Security, Tags } from '@tsoa/runtime';
import { NHRequest } from '../types/internal/NHRequest';
import { DeliveryReportInterface } from '../../shared-library/models/DeliveryReportModel';
import { AuthSchemes } from '../middlewares/Authentication';

@injectable()
@Route('api/notification/deliveryReport')
@Security(AuthSchemes.orgOwner)
@Security(AuthSchemes.frontendToken)
@Tags('View Delivery Reports')
export class DeliveryReportController extends Controller {
  constructor(@inject(DeliveryReportService) private deliveryReportService: DeliveryReportService) {
    super();
  }

  /**
   * Provides Delivery Report for the Notifications sent by using transaction Id.the report contains sent or errored status
   * which will be stored wether notification sent or not respectively.
   * @summary Get Delivery Report for the Notifications sent.
   * @param request
   * @param transactionId - generated id got from the response of send notification Api.
   */
  @Get()
  @Response<DeliveryReportInterface>('200', 'Get Delivery Report for Transaction Id')
  public async getDeliveryReport(@Request() request: NHRequest, @Query() transactionId: string) {
    return this.deliveryReportService.getDeliveryReport(transactionId);
  }

  /**
   * Fetches delivery reports for a particular user
   * @param request
   * @param userId - uuid generated for each user when sending notification
   * @param page
   * @param itemsPerPage
   * @param sortBy
   * @param sortOrder
   */

  @Get('/{userId}')
  @Response<DeliveryReportInterface>('200', 'Get Delivery Reports for User Id')
  public async getDeliveryReportsForUser(
    @Request() request: NHRequest,
    @Path() userId: string,
    @Query() page: number,
    @Query() itemsPerPage: number,
    @Query() sortBy?: string,
    @Query() sortOrder?: 'asc' | 'desc',
  ) {
    const sortByParam = sortBy ?? 'createdAt';
    const sortOrderParam = sortOrder ?? 'asc';

    return this.deliveryReportService.getDeliveryReportsByUserId(
      userId,
      page,
      itemsPerPage,
      sortByParam,
      sortOrderParam,
    );
  }
}
