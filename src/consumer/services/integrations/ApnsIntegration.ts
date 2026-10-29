import { injectable } from 'tsyringe';
import { ApnsClient, Notification } from 'apns2';
import { ApnsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { ConsumerLogger } from '../../utils/ConsumerLogger';

export interface ApnsNotificationPayload {
  alert: {
    title: string;
    body: string;
  };
  sound?: string;
  badge?: number;
  data?: Record<string, any>;
}

@injectable()
export class ApnsIntegration {
  private readonly logger = new ConsumerLogger();

  async sendPushNotification(
    apnsSettings: ApnsSettings,
    deviceTokens: string[],
    payload: ApnsNotificationPayload,
  ): Promise<{ successCount: number; failureCount: number; responses: any[] }> {
    this.logger.traceStart(
      { apnsSettings: { ...apnsSettings, privateKey: '[REDACTED]' }, deviceTokens, payload },
      'Sending APNs Push Notification',
    );

    const client = new ApnsClient({
      team: apnsSettings.teamId,
      keyId: apnsSettings.keyId,
      signingKey: apnsSettings.privateKey,
      defaultTopic: apnsSettings.bundleId,
      host: apnsSettings.environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com',
    });

    const responses: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const token of deviceTokens) {
      try {
        const notification = new Notification(token, {
          alert: payload.alert,
          sound: payload.sound || 'default',
          badge: payload.data?.badge,
          topic: apnsSettings.bundleId,
          data: payload.data || {},
        });

        const response = await client.send(notification);
        responses.push({ token, response });
        successCount++;
      } catch (error) {
        failureCount++;
        this.logger.error('APNs send error', { token, error });
        responses.push({ token, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    this.logger.traceEnd({ successCount, failureCount }, 'Sending APNs Push Notification');

    return { successCount, failureCount, responses };
  }
}
