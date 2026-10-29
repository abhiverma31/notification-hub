import 'dotenv/config';
import request from 'supertest';

describe('Health Check API', () => {
  const adminKey = process.env.ADMIN_KEY || 'test';

  it('should handle GET /api/health', async () => {
    await request('http://localhost:4000').get('/api/health').set('X-ADMIN-KEY', adminKey).expect(200).expect('"OK"');
  });

  it('should throw 403 Forbidden on sending invalid Api Key', async () => {
    await request('http://localhost:4000')
      .get('/api/health')
      .set('X-ADMIN-KEY', 'invalidApiKey')
      .expect(403)
      .expect({ message: 'Forbidden' });
  });
});
