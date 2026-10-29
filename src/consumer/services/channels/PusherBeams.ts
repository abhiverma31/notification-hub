import 'reflect-metadata';
import { injectable } from 'tsyringe';
import PushNotifications from '@pusher/push-notifications-server';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { PusherBeamsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { decryptData } from '../../../server/utils/KeyTools';

@injectable()
export class PusherBeamsService {
  private readonly logger = new ConsumerLogger();

  public async send(
    template: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    settings: PusherBeamsSettings,
  ): Promise<void> {
    this.logger.traceStart({ recipient, organisationId }, 'Sending Pusher Beams Notification');

    const secretKey = decryptData(settings.secretKey);

    const beamsClient = new PushNotifications({
      instanceId: settings.instanceId,
      secretKey,
    });

    // Use provided interests or fall back to email-based interest
    const interests = recipient.beamsInterest?.length
      ? recipient.beamsInterest
      : [`user-${recipient.email.replace(/[@.]/g, '-')}`];

    await beamsClient.publishToInterests(interests, {
      web: {
        notification: {
          title: template.title as string,
          body: template.body as string,
        },
      },
      fcm: {
        notification: {
          title: template.title as string,
          body: template.body as string,
        },
      },
      apns: {
        aps: {
          alert: {
            title: template.title as string,
            body: template.body as string,
          },
        },
      },
    });

    this.logger.traceEnd({ recipient, organisationId }, 'Sending Pusher Beams Notification');
  }
}
