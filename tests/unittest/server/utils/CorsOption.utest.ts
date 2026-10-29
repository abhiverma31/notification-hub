import request from 'supertest';
import { server } from '../../../../src/server/Server';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';


jest.mock('../../../../src/shared-library/connectors/DatabaseConnector', () => {
    return {
      DatabaseConnector: jest.fn().mockImplementation(() => {
        return {
          connect: jest.fn().mockResolvedValue(true),
          disconnect: jest.fn().mockResolvedValue(true),
        };
      }),
    };
  });

describe('CORS Headers', () => {
    let dbConnectorInstance: DatabaseConnector;
    beforeAll(() => {
        dbConnectorInstance = new DatabaseConnector(); 
      });
    afterAll(async () => {
        server.close();
        await dbConnectorInstance.disconnect('Server');
      });
    
  it('should allow requests from allowed origins', async () => {
    const allowedOrigin = 'https://staging.stellarworldschool.com';

    const response = await request(server.app)
      .get('/test')
      .set('Origin', allowedOrigin);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
  });
});
