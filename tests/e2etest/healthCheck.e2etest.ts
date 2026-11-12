import 'dotenv/config';
import request from 'supertest';

describe('Health Check API', () => {
  const adminKey = process.env.ADMIN_KEY || 'test';

  it('should handle GET /api/health', async () => {
    const before = Date.now();
    const response = await request('http://localhost:4000')
      .get('/api/health')
      .set('X-ADMIN-KEY', adminKey)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      status: 'OK',
      service: 'notification-hub',
      timestamp: expect.any(String),
    });
    const timestamp = Date.parse(response.body.timestamp);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
    expect(new Date(timestamp).toISOString()).toBe(response.body.timestamp);
  });

  it('should throw 403 Forbidden on sending invalid Api Key', async () => {
    await request('http://localhost:4000')
      .get('/api/health')
      .set('X-ADMIN-KEY', 'invalidApiKey')
      .expect(403)
      .expect({ message: 'Forbidden' });
  });
});
