export const getThresholds = {
  http_req_duration: ['med<100', 'p(95)<500', 'p(90)<1000'],
  checks: ['rate>=1'],
  http_req_failed: ['rate<0.01'],
};

export const postThresholds = {
  http_req_duration: ['med<500', 'p(95)<1000', 'p(90)<2000'],
  checks: ['rate>=1'],
  http_req_failed: ['rate<0.01'],
};
