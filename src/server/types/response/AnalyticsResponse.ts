export interface OverviewResult {
  total: number;
  sent: number;
  errored: number;
  successRate: number;
  failureRate: number;
}

export interface VolumeTrendEntry {
  timestamp: Date;
  sent: number;
  errored: number;
}

export interface ChannelBreakdownEntry {
  channel: string;
  sent: number;
  errored: number;
}

export interface LatencyEntry {
  channel: string;
  avgMs: number;
  medianMs: number;
  p90Ms: number;
  thresholdPct: number;
}

export interface HourlyEntry {
  hour: number;
  count: number;
}

export interface DayEntry {
  day: number;
  sent: number;
  seen: number;
  seenRate: number;
}

export interface FailureEntry {
  channel: string;
  errorMessage: string;
  count: number;
}
