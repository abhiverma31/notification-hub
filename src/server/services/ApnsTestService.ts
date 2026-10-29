import { injectable, inject } from 'tsyringe';
import { OrganisationService } from './Organisation';
import { decryptData } from '../utils/KeyTools';
import { BadRequest } from '../utils/errors/BadRequest';
import { ServerLogger } from '../utils/ServerLogger';
import { ApnsSettings } from '../../shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../types/Enum/PushProviders';

@injectable()
export class ApnsTestService {
  private readonly logger = new ServerLogger();

  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {}

  public async testApnsNotification(
    orgId: string,
    deviceToken: string,
    testMessage?: string,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    this.logger.debug('Testing APNs notification', { orgId });

    const organisation = await this.organisationService.getOrganisationById(orgId);
    if (!organisation || !organisation.settings?.push) {
      throw new BadRequest('Organisation or push settings not found');
    }

    const apnsProvider = organisation.settings.push.find((p) => p.provider === PushProviders.APNS && p.enabled);
    if (!apnsProvider) {
      throw new BadRequest('APNs provider is not configured or not enabled');
    }

    const apnsSettings = apnsProvider.settings as ApnsSettings;

    const decryptedSettings = { ...apnsSettings, privateKey: decryptData(apnsSettings.privateKey) };

    try {
      const { ApnsClient, Notification } = await import('apns2');
      const client = new ApnsClient({
        team: decryptedSettings.teamId,
        keyId: decryptedSettings.keyId,
        signingKey: decryptedSettings.privateKey,
        defaultTopic: decryptedSettings.bundleId,
        host: decryptedSettings.environment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com',
      });

      const notification = new Notification(deviceToken, {
        alert: {
          title: 'Test Notification',
          body: testMessage || 'This is a test notification from Easy Notify',
        },
        sound: 'default',
        topic: apnsSettings.bundleId,
      });

      const response = await client.send(notification);

      return {
        success: true,
        message: 'APNs test notification sent successfully',
        details: response,
      };
    } catch (error) {
      this.logger.error('APNs test notification error', error);

      return {
        success: false,
        message: 'APNs test notification failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
