import { injectable } from 'tsyringe';
import { DeliveryReportInterface, DeliveryReportModel } from '../models/DeliveryReportModel';
import { UserId, UserModel } from '../models/User';
import { DeliveryReportStatus } from '../types/DeliveryReportStatus';

@injectable()
export class DeliveryReportRepository {
  static readonly SCHEMA_VERSION = 3;

  public async save(deliveryReport: DeliveryReportInterface) {
    return await DeliveryReportModel.create(this.upgrade(deliveryReport));
  }

  public async getReport(id: string): Promise<DeliveryReportInterface | null> {
    return await this.upgradeAndSave(await DeliveryReportModel.findOne({ transactionId: id }));
  }

  public async updateStatus(
    transactionId: string,
    status: string,
    error?: object,
  ): Promise<DeliveryReportInterface | null> {
    return await DeliveryReportModel.findOneAndUpdate(
      { transactionId },
      { status, ...(error && { error }) },
      { new: true },
    );
  }

  public async updateUserId(transactionId: string, userId: string): Promise<void> {
    await DeliveryReportModel.updateOne({ transactionId }, { user_id: userId });
  }

  public async getReportsByUserId(
    userId: string,
    offset: number,
    limit: number,
    sortBy: string,
    sortOrder: string,
  ): Promise<DeliveryReportInterface[]> {
    return DeliveryReportModel.find({ user_id: userId })
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(offset)
      .limit(limit);
  }

  public async getTotalReportsCountByUserId(userId: string): Promise<number> {
    return DeliveryReportModel.countDocuments({ user_id: userId });
  }

  private setLatestSchemaVersion(deliveryReport: DeliveryReportInterface): DeliveryReportInterface {
    deliveryReport.schema_version = DeliveryReportRepository.SCHEMA_VERSION;

    return deliveryReport;
  }

  private upgrade(deliveryReport: DeliveryReportInterface): DeliveryReportInterface {
    // add upgrade logic

    return this.setLatestSchemaVersion(deliveryReport);
  }

  private async upgradeAndSave(dbObject: any): Promise<DeliveryReportInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== DeliveryReportRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return DeliveryReportModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  async findForArchival(cutoffDate: Date, lastId: string | null, limit: number): Promise<DeliveryReportInterface[]> {
    const filter: Record<string, unknown> = { createdAt: { $lt: cutoffDate } };
    if (lastId) filter._id = { $gt: lastId };
    return DeliveryReportModel.find(filter).sort({ _id: 1 }).limit(limit).lean();
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await DeliveryReportModel.deleteMany({ _id: { $in: ids } });
  }

  public async migrate() {
    const limit = 1000;
    let modifiedCount = 0;
    let lastId: string | null = null;

    const userOrgMap = new Map<string, string>();
    const allUsers = await UserModel.find({}, { _id: 1, user_id: 1 }).lean();
    for (const user of allUsers) {
      userOrgMap.set(user.user_id, UserId.extractOrganisationId(user._id));
    }

    do {
      const cursorFilter: Record<string, unknown> = lastId ? { _id: { $gt: lastId } } : {};

      const batch: DeliveryReportInterface[] = await DeliveryReportModel.find(cursorFilter).sort({ _id: 1 }).limit(limit).lean();

      if (batch.length === 0) break;

      lastId = batch[batch.length - 1]._id!.toString();

      const toUpdate = batch.filter(
        (report) =>
          report.schema_version !== DeliveryReportRepository.SCHEMA_VERSION || !report.organisation_id,
      );

      if (toUpdate.length > 0) {
        const bulkOperations = toUpdate.map((report) => ({
          updateOne: {
            filter: { _id: report._id },
            update: {
              $set: {
                organisation_id: userOrgMap.get(report.user_id!) || null,
                schema_version: DeliveryReportRepository.SCHEMA_VERSION,
              },
            },
          },
        }));

        await DeliveryReportModel.bulkWrite(bulkOperations);
        modifiedCount += toUpdate.length;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (true);

    return modifiedCount;
  }
}
