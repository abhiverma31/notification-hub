import http from 'k6/http';
import { check } from 'k6';
import { adminKey, apiBaseUrl } from './constants/StageEnvironmentConfig.js';
import { summaryExporter } from './utils/ExportSummary.js';
import { checkResponse } from './utils/CheckResponseStatus.js';

export const handleSummary = summaryExporter;

const smokeLoad = {
  vus: 1,
  duration: '1s',
};

export const options = smokeLoad;

export default function () {
  const headers = {
    'x-admin-key': adminKey,
  };

  const response = http.get(`${apiBaseUrl}/health`, { headers });

  check(response, {
    'Status is 200': (r) => checkResponse(r, 200),
  });
}
