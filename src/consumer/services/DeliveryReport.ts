import { inject, injectable } from 'tsyringe';
import { DeliveryReportRepository } from '../../shared-library/repositories/DeliveryReport';
import { DeliveryReportInterface } from '../../shared-library/models/DeliveryReportModel';
import { DeliveryReportHistoryRepository } from '../../shared-library/repositories/DeliveryReportHistory';
import { BadRequest } from '../../server/utils/errors/BadRequest';
import { ConsumerLogger } from '../utils/ConsumerLogger';
import { DeliveryReportStatus } from '../../shared-library/types/DeliveryReportStatus';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { DeliveryReportViewModel } from '../../server/types/response/DeliveryReportResponse';

@injectable()
export class DeliveryReportService {
  private readonly logger = new ConsumerLogger();

  constructor(
    @inject(DeliveryReportRepository) private deliveryReportRepository: DeliveryReportRepository,
    @inject(DeliveryReportHistoryRepository) private deliveryReportHistoryRepository: DeliveryReportHistoryRepository,
  ) {}

  public async saveReport(
    messageId: string,
    userId: string | null,
    channel: ChannelType,
    status: DeliveryReportStatus,
    error?: object,
    organisationId?: string,
  ) {
    const deliveryReport = {
      transactionId: messageId,
      user_id: userId,
      organisation_id: organisationId || null,
      status,
      channel,
      error,
    };

    const result = await this.deliveryReportRepository.save(deliveryReport);

    await this.appendToHistory(messageId, userId, channel, status, organisationId, error);

    return result;
  }

  public async updateUserId(transactionId: string, userId: string): Promise<void> {
    await this.deliveryReportRepository.updateUserId(transactionId, userId);
  }

  public async getDeliveryReport(transactionId: string): Promise<DeliveryReportInterface> {
    const deliveryReport = await this.deliveryReportRepository.getReport(transactionId);
    if (deliveryReport == null) throw new BadRequest('Invalid transaction id');

    return deliveryReport;
  }

  public async updateReportStatus(
    transactionId: string,
    status: DeliveryReportStatus,
    error?: object,
    source?: string,
  ): Promise<DeliveryReportInterface | null> {
    const updated = await this.deliveryReportRepository.updateStatus(transactionId, status, error);

    if (updated) {
      await this.appendToHistory(
        transactionId,
        updated.user_id,
        updated.channel,
        status,
        updated.organisation_id || undefined,
        error,
        source,
      );
    }

    return updated;
  }

  public async getDeliveryReportsByUserId(
    userId: string,
    page: number,
    itemsPerPage: number,
    sortBy = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<DeliveryReportViewModel | undefined> {
    this.logger.traceStart(
      {
        userId,
        page,
        itemsPerPage,
        sortBy,
        sortOrder,
      },
      'service > getDeliveryReportsByUserId getting delivery reports',
    );
    const totalDeliveryReports = await this.deliveryReportRepository.getTotalReportsCountByUserId(userId);
    const deliveryReports = await this.deliveryReportRepository.getReportsByUserId(
      userId,
      page! * itemsPerPage!,
      itemsPerPage,
      sortBy,
      sortOrder,
    );
    this.logger.trace('Fetched delivery reports: ', deliveryReports);
    if (deliveryReports.length === 0) throw new BadRequest('No delivery reports found for user');
    const totalPages = Math.ceil(totalDeliveryReports / itemsPerPage);

    return {
      deliveryReportsList: deliveryReports,
      pagination: {
        currentPage: page,
        itemsPerPage: itemsPerPage,
        totalItems: totalDeliveryReports,
        totalPages: totalPages,
      },
    };
  }

  private async appendToHistory(
    transactionId: string,
    userId: string | null,
    channel: ChannelType,
    status: DeliveryReportStatus,
    organisationId?: string,
    error?: object,
    source?: string,
  ) {
    try {
      await this.deliveryReportHistoryRepository.append({
        transactionId,
        user_id: userId,
        organisation_id: organisationId || null,
        status,
        channel,
        error,
        source,
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error('Failed to append to delivery report history', {
        transactionId,
        errorType: 'HISTORY_APPEND_FAILURE',
        error: err,
      });
    }
  }
}
