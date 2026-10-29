import { inject, injectable } from 'tsyringe';
import { AnalyticsRepository } from '../../shared-library/repositories/Analytics';
import {
  OverviewResult,
  VolumeTrendEntry,
  ChannelBreakdownEntry,
  LatencyEntry,
  HourlyEntry,
  DayEntry,
  FailureEntry,
} from '../types/response/AnalyticsResponse';

@injectable()
export class AnalyticsService {
  constructor(@inject(AnalyticsRepository) private repo: AnalyticsRepository) {}

  async getOverview(orgId: string, startDate: Date, endDate: Date): Promise<OverviewResult> {
    const raw = await this.repo.getOverview(orgId, startDate, endDate);
    const successRate = raw.total > 0 ? parseFloat(((raw.sent / raw.total) * 100).toFixed(2)) : 0;
    const failureRate = raw.total > 0 ? parseFloat(((raw.errored / raw.total) * 100).toFixed(2)) : 0;

    return { total: raw.total, sent: raw.sent, errored: raw.errored, successRate, failureRate };
  }

  async getVolumeTrend(
    orgId: string,
    startDate: Date,
    endDate: Date,
    granularity: string,
    timezone: string,
  ): Promise<VolumeTrendEntry[]> {
    return this.repo.getVolumeTrend(orgId, startDate, endDate, granularity, timezone);
  }

  async getChannelBreakdown(orgId: string, startDate: Date, endDate: Date): Promise<ChannelBreakdownEntry[]> {
    return this.repo.getChannelBreakdown(orgId, startDate, endDate);
  }

  async getDeliverySpeed(orgId: string, startDate: Date, endDate: Date): Promise<LatencyEntry[]> {
    const rawDelays = await this.repo.getDeliverySpeedDelays(orgId, startDate, endDate);

    return rawDelays.map((ch) => ({
      channel: ch.channel,
      ...this.computePercentiles(ch.delays, 10000),
    }));
  }

  async getTimeToSee(orgId: string, startDate: Date, endDate: Date): Promise<LatencyEntry[]> {
    const rawDelays = await this.repo.getTimeToSeeDelays(orgId, startDate, endDate);

    return rawDelays.map((ch) => ({
      channel: ch.channel,
      ...this.computePercentiles(ch.delays, 300000),
    }));
  }

  async getSeenByHour(orgId: string, startDate: Date, endDate: Date, timezone: string): Promise<HourlyEntry[]> {
    return this.repo.getSeenByHour(orgId, startDate, endDate, timezone);
  }

  async getBestDay(orgId: string, startDate: Date, endDate: Date, timezone: string): Promise<DayEntry[]> {
    const [sentData, seenData] = await Promise.all([
      this.repo.getBestDaySent(orgId, startDate, endDate, timezone),
      this.repo.getBestDaySeen(orgId, startDate, endDate, timezone),
    ]);

    const totalSeen = seenData.reduce((sum, d) => sum + d.seen, 0);
    const sentMap = new Map(sentData.map((d) => [d.day, d.sent]));

    return seenData.map((d) => ({
      day: d.day,
      sent: sentMap.get(d.day) || 0,
      seen: d.seen,
      seenRate: totalSeen > 0 ? parseFloat(((d.seen / totalSeen) * 100).toFixed(2)) : 0,
    }));
  }

  async getFailures(orgId: string, startDate: Date, endDate: Date, limit: number): Promise<FailureEntry[]> {
    return this.repo.getFailures(orgId, startDate, endDate, limit);
  }

  private computePercentiles(delays: number[], thresholdMs: number) {
    if (delays.length === 0) {
      return { avgMs: 0, medianMs: 0, p90Ms: 0, thresholdPct: 100 };
    }
    const sorted = [...delays].sort((a, b) => a - b);
    const avgMs = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const medianMs = sorted[Math.floor(sorted.length / 2)];
    const p90Ms = sorted[Math.floor(sorted.length * 0.9)];
    const belowThreshold = sorted.filter((d) => d <= thresholdMs).length;
    const thresholdPct = parseFloat(((belowThreshold / sorted.length) * 100).toFixed(2));

    return { avgMs: parseFloat(avgMs.toFixed(2)), medianMs, p90Ms, thresholdPct };
  }
}
