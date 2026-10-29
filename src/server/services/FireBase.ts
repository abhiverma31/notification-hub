import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { ServerLogger } from '../utils/ServerLogger';
import * as admin from 'firebase-admin';
import { CreatePushSettingsRequest } from '../types/request/PushSettings';
import { randomUUID } from 'crypto';

@injectable()
export class FirebaseService {
  private readonly logger = new ServerLogger();

  async verifySettings(firebaseSetting: CreatePushSettingsRequest) {
    const verifyFireBaseSettings = {
      type: 'service_account',
      project_id: firebaseSetting.projectId,
      private_key: firebaseSetting.privateKey,
      client_email: firebaseSetting.firebaseClientEmail,
    };
    try {
      const uniqueAppInstance = randomUUID();
      admin.initializeApp(
        {
          credential: admin.credential.cert(verifyFireBaseSettings as admin.ServiceAccount),
          projectId: firebaseSetting.projectId,
        },
        uniqueAppInstance,
      );
      this.logger.trace('> server > Firebaseservice > Firebase settings verified');

      return true;
    } catch (error) {
      this.logger.error('Error verifying Firebase settings', error);

      return false;
    }
  }
}
