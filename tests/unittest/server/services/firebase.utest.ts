import * as admin from 'firebase-admin';
import { FirebaseService } from '../../../../src/server/services/FireBase';
import { randomUUID } from 'crypto';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
}));

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;

  beforeEach(() => {
    firebaseService = new FirebaseService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifySettings', () => {
    it('should return true when Firebase settings are valid', async () => {
      // Mock the input data
      const firebaseSettings = {
        projectId: 'test-project-id',
        privateKey: 'test-private-key',
        firebaseClientEmail: 'test-client-email',
      };

      // Mock the admin.initializeApp method to resolve without errors
      (admin.initializeApp as jest.Mock).mockReturnValueOnce(undefined);

      // Call the method under test
      const result = await firebaseService.verifySettings(firebaseSettings);
      
      // Assertions
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: admin.credential.cert({
          type: 'service_account',
          project_id: firebaseSettings.projectId,
          private_key: firebaseSettings.privateKey,
          client_email: firebaseSettings.firebaseClientEmail,
        }),
        projectId: firebaseSettings.projectId,
      },expect.any(String));
      expect(result).toBe(true);
    });

    it('should return false and log error when Firebase settings verification fails', async () => {
      // Mock the input data
      const firebaseSettings = {
        projectId: 'test-project-id',
        privateKey: 'test-private-key',
        firebaseClientEmail: 'test-client-email',
      };

      // Mock the admin.initializeApp method to throw an error
      (admin.initializeApp as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Firebase initialization error');
      });

      // Call the method under test
      const result = await firebaseService.verifySettings(firebaseSettings);
      
      // Assertions
      expect(admin.initializeApp).toHaveBeenCalledWith({
        credential: admin.credential.cert({
          type: 'service_account',
          project_id: firebaseSettings.projectId,
          private_key: firebaseSettings.privateKey,
          client_email: firebaseSettings.firebaseClientEmail,
        }),
        projectId: firebaseSettings.projectId,
      },expect.any(String));
      expect(result).toBe(false);
    });
  });
});
