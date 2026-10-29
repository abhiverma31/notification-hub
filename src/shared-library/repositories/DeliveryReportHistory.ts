import { injectable } from 'tsyringe';
import { DeliveryReportHistoryInterface, DeliveryReportHistoryModel } from '../models/DeliveryReportHistoryModel';
import { DeliveryReportStatus } from '../types/DeliveryReportStatus';

@injectable()
export class DeliveryReportHistoryRepository {
  public async append(event: DeliveryReportHistoryInterface): Promise<DeliveryReportHistoryInterface> {
    return await DeliveryReportHistoryModel.create(event);
  }

  public async exists(transactionId: string, status: DeliveryReportStatus): Promise<boolean> {
    const count = await DeliveryReportHistoryModel.countDocuments({ transactionId, status });

    return count > 0;
  }

  public async getHistoryByTransactionId(transactionId: string): Promise<DeliveryReportHistoryInterface[]> {
    return DeliveryReportHistoryModel.find({ transactionId }).sort({ createdAt: 1 });
  }

  public async getHistoryByUserId(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<DeliveryReportHistoryInterface[]> {
    return DeliveryReportHistoryModel.find({ user_id: userId }).sort({ createdAt: -1 }).skip(offset).limit(limit);
  }

  async findForArchival(cutoffDate: Date, lastId: string | null, limit: number, lastCreatedAt?: Date): Promise<DeliveryReportHistoryInterface[]> {
    const filter: Record<string, unknown> = { createdAt: { $lt: cutoffDate } };
    
    // Compound cursor pagination: handle both createdAt and _id for correct ordering
    if (lastId && lastCreatedAt) {
      filter.$or = [
        { createdAt: { $gt: lastCreatedAt, $lt: cutoffDate } },
        { createdAt: lastCreatedAt, _id: { $gt: lastId } }
      ];
      delete filter.createdAt; // Remove the simple filter, use $or instead
    }
    
    // Sort by createdAt first to ensure we process dates in order, then by _id for cursor stability
    return DeliveryReportHistoryModel.find(filter).sort({ createdAt: 1, _id: 1 }).limit(limit).lean();
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await DeliveryReportHistoryModel.deleteMany({ _id: { $in: ids } });
  }
}
