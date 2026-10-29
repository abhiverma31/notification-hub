import http from 'k6/http';
import { check } from 'k6';
import { apiBaseUrl, perfTestOrgUserKey } from './constants/StageEnvironmentConfig.js';
import { summaryExporter } from './utils/ExportSummary.js';
import { getThresholds } from './utils/Thresholds.js';
import { checkResponse } from './utils/CheckResponseStatus.js';

export const handleSummary = summaryExporter;

const smokeLoad = {
  vus: 5,
  duration: '1m',
  thresholds: getThresholds,
};

export const options = smokeLoad;

export default function () {
  const headers = {
    'X-ORG-USER-KEY': perfTestOrgUserKey,
  };

  const response = http.get(`${apiBaseUrl}/notification/on-deck?recipientEmailId=satyam2saxena@gmail.com`, { headers });

  check(response, {
    'Status is 200': (r) => checkResponse(r, 200),
  });
}
