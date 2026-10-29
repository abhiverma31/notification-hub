import http from 'k6/http';
import { check } from 'k6';
import { apiBaseUrl, perfTestOrgKey } from './constants/StageEnvironmentConfig.js';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import exec from 'k6/execution';
import { summaryExporter } from './utils/ExportSummary.js';
import { postThresholds } from './utils/Thresholds.js';
import { checkResponse } from './utils/CheckResponseStatus.js';

export const handleSummary = summaryExporter;

const smokeLoad = {
  vus: 3,
  duration: '30s',
  thresholds: postThresholds,
};

export const options = smokeLoad;

export default function () {
  const headers = {
    'X-ORG-KEY': perfTestOrgKey,
    'Content-Type': 'application/json',
  };

  const content = `Iteration id: ${exec.vu.iterationInInstance}
Iteration in scenario: ${exec.vu.iterationInScenario}
VU ID in instance: ${exec.vu.idInInstance}`;

  const payload = JSON.stringify({
    source: 'Server',
    recipients: [
      {
        name: {
          first: 'Test',
          last: 'Now',
        },
        channels: ['onDeck'],
        email: 'satyam2saxena@gmail.com',
      },
    ],
    channels: {
      onDeck: {
        templateId: '68c8cf35271299e8d5a3649b',
      },
    },
    data: {
      title: `P-${uuidv4()}-Iter-${exec.vu.idInTest}`,
      content: content,
      actionUrl: '#',
    },
  });

  const response = http.post(`${apiBaseUrl}/notification`, payload, { headers });

  check(response, {
    'Status is 202': (r) => checkResponse(r, 202),
  });
}
