import { injectable } from 'tsyringe';
import { DeliveryReportModel } from '../models/DeliveryReportModel';
import { DeliveryReportHistoryModel } from '../models/DeliveryReportHistoryModel';
import { ChannelBreakdownEntry, FailureEntry, HourlyEntry } from '../../server/types/response/AnalyticsResponse';

const EXCLUDED_STATUSES = ['initiated', 'ingested'];
const DELIVERED_CHANNELS = ['whatsApp', 'sms', 'email'];
const SEEN_CHANNELS = ['whatsApp', 'email', 'onDeck'];

@injectable()
export class AnalyticsRepository {
  async getOverview(orgId: string, startDate: Date, endDate: Date) {
    const result = await DeliveryReportModel.aggregate([
      { $match: this.baseMatch(orgId, startDate, endDate) },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sent: { $sum: { $cond: [{ $ne: ['$status', 'errored'] }, 1, 0] } },
          errored: { $sum: { $cond: [{ $eq: ['$status', 'errored'] }, 1, 0] } },
        },
      },
    ]);

    return result[0] || { total: 0, sent: 0, errored: 0 };
  }

  async getVolumeTrend(orgId: string, startDate: Date, endDate: Date, granularity: string, timezone: string) {
    return DeliveryReportModel.aggregate([
      { $match: this.baseMatch(orgId, startDate, endDate) },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit: granularity, timezone } },
          sent: { $sum: { $cond: [{ $ne: ['$status', 'errored'] }, 1, 0] } },
          errored: { $sum: { $cond: [{ $eq: ['$status', 'errored'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, timestamp: '$_id', sent: 1, errored: 1 } },
    ]);
  }

  async getChannelBreakdown(orgId: string, startDate: Date, endDate: Date): Promise<ChannelBreakdownEntry[]> {
    return DeliveryReportModel.aggregate([
      { $match: this.baseMatch(orgId, startDate, endDate) },
      {
        $group: {
          _id: '$channel',
          sent: { $sum: { $cond: [{ $ne: ['$status', 'errored'] }, 1, 0] } },
          errored: { $sum: { $cond: [{ $eq: ['$status', 'errored'] }, 1, 0] } },
        },
      },
      { $sort: { sent: -1 } },
      { $project: { _id: 0, channel: '$_id', sent: 1, errored: 1 } },
    ]);
  }

  async getDeliverySpeedDelays(orgId: string, startDate: Date, endDate: Date) {
    return DeliveryReportHistoryModel.aggregate([
      {
        $match: this.historyMatch(orgId, startDate, endDate, {
          channel: { $in: DELIVERED_CHANNELS },
          status: { $in: ['sent', 'delivered'] },
        }),
      },
      {
        $group: {
          _id: { transactionId: '$transactionId', channel: '$channel' },
          sentAt: { $min: { $cond: [{ $eq: ['$status', 'sent'] }, '$createdAt', null] } },
          deliveredAt: { $min: { $cond: [{ $eq: ['$status', 'delivered'] }, '$createdAt', null] } },
        },
      },
      { $match: { sentAt: { $ne: null }, deliveredAt: { $ne: null } } },
      { $addFields: { delayMs: { $subtract: ['$deliveredAt', '$sentAt'] } } },
      {
        $group: {
          _id: '$_id.channel',
          delays: { $push: '$delayMs' },
        },
      },
      { $project: { _id: 0, channel: '$_id', delays: 1 } },
    ]);
  }

  async getTimeToSeeDelays(orgId: string, startDate: Date, endDate: Date) {
    return DeliveryReportHistoryModel.aggregate([
      {
        $match: this.historyMatch(orgId, startDate, endDate, {
          channel: { $in: SEEN_CHANNELS },
          status: { $in: ['delivered', 'seen'] },
        }),
      },
      {
        $group: {
          _id: { transactionId: '$transactionId', channel: '$channel' },
          deliveredAt: { $min: { $cond: [{ $eq: ['$status', 'delivered'] }, '$createdAt', null] } },
          seenAt: { $min: { $cond: [{ $eq: ['$status', 'seen'] }, '$createdAt', null] } },
        },
      },
      { $match: { deliveredAt: { $ne: null }, seenAt: { $ne: null } } },
      { $addFields: { delayMs: { $subtract: ['$seenAt', '$deliveredAt'] } } },
      {
        $group: {
          _id: '$_id.channel',
          delays: { $push: '$delayMs' },
        },
      },
      { $project: { _id: 0, channel: '$_id', delays: 1 } },
    ]);
  }

  async getSeenByHour(orgId: string, startDate: Date, endDate: Date, timezone: string): Promise<HourlyEntry[]> {
    return DeliveryReportHistoryModel.aggregate([
      {
        $match: this.historyMatch(orgId, startDate, endDate, { status: 'seen' }),
      },
      { $group: { _id: { $hour: { date: '$createdAt', timezone } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, hour: '$_id', count: 1 } },
    ]);
  }

  async getBestDaySent(orgId: string, startDate: Date, endDate: Date, timezone: string) {
    return DeliveryReportModel.aggregate([
      {
        $match: {
          ...this.baseMatch(orgId, startDate, endDate),
          status: { $nin: [...EXCLUDED_STATUSES, 'errored'] },
        },
      },
      { $group: { _id: { $dayOfWeek: { date: '$createdAt', timezone } }, sent: { $sum: 1 } } },
      { $project: { _id: 0, day: '$_id', sent: 1 } },
    ]);
  }

  async getBestDaySeen(orgId: string, startDate: Date, endDate: Date, timezone: string) {
    return DeliveryReportHistoryModel.aggregate([
      {
        $match: this.historyMatch(orgId, startDate, endDate, { status: 'seen' }),
      },
      { $group: { _id: { $dayOfWeek: { date: '$createdAt', timezone } }, seen: { $sum: 1 } } },
      { $project: { _id: 0, day: '$_id', seen: 1 } },
    ]);
  }

  async getFailures(orgId: string, startDate: Date, endDate: Date, limit: number): Promise<FailureEntry[]> {
    return DeliveryReportModel.aggregate([
      {
        $match: {
          organisation_id: orgId,
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'errored',
        },
      },
      {
        $addFields: { errorMsg: { $ifNull: ['$error.message', 'Unknown error'] } },
      },
      {
        $group: {
          _id: { channel: '$channel', errorMessage: '$errorMsg' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          channel: '$_id.channel',
          errorMessage: { $ifNull: ['$_id.errorMessage', 'Unknown error'] },
          count: 1,
        },
      },
    ]);
  }

  private baseMatch(orgId: string, startDate: Date, endDate: Date) {
    return {
      organisation_id: orgId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: EXCLUDED_STATUSES },
    };
  }

  private historyMatch(orgId: string, startDate: Date, endDate: Date, extra: object = {}) {
    return {
      organisation_id: orgId,
      createdAt: { $gte: startDate, $lte: endDate },
      ...extra,
    };
  }
}
