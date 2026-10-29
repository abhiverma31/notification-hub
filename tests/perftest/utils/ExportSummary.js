import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

export function summaryExporter(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'perf-report.json': JSON.stringify(data),
    'perf-report.html': htmlReport(data),
  };
}
