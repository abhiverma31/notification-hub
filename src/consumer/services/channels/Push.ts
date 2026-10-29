import { injectable, inject } from 'tsyringe';
import * as admin from 'firebase-admin';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { PushNotificationTargetInfo, dataOption } from '../../types/Interfaces/PushQueueMessage';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { FirebaseIntegration } from '../integrations/Firebase';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { ChannelService } from './base/ChannelService';
import { decryptData } from '../../../server/utils/KeyTools';
import { OrganisationService } from '../Organisation';
import {
  FirebaseSettings,
  PusherSettings,
  PusherBeamsSettings,
} from '../../../shared-library/models/submodels/OrganisationSettings';
import { PushProviders } from '../../../server/types/Enum/PushProviders';
import { randomUUID } from 'crypto';
import UserRepository from '../../../shared-library/repositories/User';
import { WebpushNotification } from 'firebase-admin/lib/messaging/messaging-api';
import { PusherService } from './Pusher';
import { PusherBeamsService } from './PusherBeams';
import { ApnsService } from './Apns';

@injectable()
export class PushService extends ChannelService {
  private readonly logger = new ConsumerLogger();

  constructor(
    @inject(FirebaseIntegration) private firebaseIntegration: FirebaseIntegration,
    @inject(ApnsService) private apnsService: ApnsService,
    @inject(OrganisationService) private organisationService: OrganisationService,
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(PusherService) private pusherService: PusherService,
    @inject(PusherBeamsService) private pusherBeamsService: PusherBeamsService,
  ) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async send(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    transactionId?: string,
  ) {
    this.logger.traceStart({ recipient, hydratedTemplate, organisationId }, 'Sending Push Notification');

    const allEnabled = await this.organisationService.getAllEnabledPushProviders(organisationId);
    const requested = recipient.pushProviders;

    const toSend = requested?.length ? allEnabled.filter((p) => requested.includes(p.provider)) : allEnabled;

    if (toSend.length === 0) {
      throw new Error(`No enabled push provider found for organisation "${organisationId}"`);
    }

    await Promise.all(
      toSend.map((p) => {
        if (p.provider === PushProviders.APNS) {
          return this.apnsService.send(hydratedTemplate, organisationId, recipient, transactionId);
        }
        if (p.provider === PushProviders.PUSHER) {
          return this.pusherService.send(hydratedTemplate, organisationId, recipient, p.settings as PusherSettings);
        }
        if (p.provider === PushProviders.PUSHER_BEAMS) {
          return this.pusherBeamsService.send(
            hydratedTemplate,
            organisationId,
            recipient,
            p.settings as PusherBeamsSettings,
          );
        }

        return this.sendViaFirebase(hydratedTemplate, organisationId, recipient, p.settings as FirebaseSettings);
      }),
    );

    this.logger.traceEnd({ recipient, hydratedTemplate, organisationId }, 'Sending Push Notification');
  }

  private async sendViaFirebase(
    hydratedTemplate: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    firebaseSettings: FirebaseSettings,
  ) {
    const fcmTokens = await ChannelService.getFcmTokensByRecipientAndOrg(recipient, organisationId, this.userRepository);

    const notificationTargetInfo: PushNotificationTargetInfo = { token: fcmTokens };
    const getDefault = (value: string | undefined, defaultValue: string): string => value ?? defaultValue;

    const notificationContent: WebpushNotification = {
      title: hydratedTemplate.title,
      body: hydratedTemplate.body,
      icon: getDefault(
        hydratedTemplate.icon,
        'https://res.cloudinary.com/dqhzj9nig/image/upload/v1715930967/push_notification_icon_diifqk.png',
      ),
      click_action: getDefault(hydratedTemplate.offerUrl, 'FLUTTER_NOTIFICATION_CLICK'),
    };

    const notificationData: dataOption = {
      url: getDefault(hydratedTemplate.offerUrl, ' '),
      sound: getDefault(hydratedTemplate.sound, 'default'),
      tag: getDefault(hydratedTemplate.tag, 'push_for_android'),
      channelId: getDefault(hydratedTemplate.channelId, 'push_for_android'),
      importance: getDefault(hydratedTemplate.importance, 'high'),
      ttl: getDefault(hydratedTemplate.ttl, '200'),
    };

    const apnsData = { apnsPriority: getDefault(hydratedTemplate.apnsPriority, '5') };

    const decryptPrivateKey = decryptData(firebaseSettings.privateKey).replace(/\\n/g, '\n');
    const uniqueAppInstance = randomUUID();

    const firebaseApp = admin.initializeApp(
      {
        credential: admin.credential.cert({
          clientEmail: firebaseSettings.firebaseClientEmail,
          privateKey: decryptPrivateKey,
          projectId: firebaseSettings.projectId,
        }),
      },
      uniqueAppInstance,
    );

    const result = await this.firebaseIntegration.sendPushNotificationsViaFirebase(
      firebaseApp,
      notificationTargetInfo,
      notificationContent,
      notificationData,
      apnsData,
    );

    if (result.failureCount > 0) {
      throw new Error(`Failed to send push notification to ${recipient.email} error: ${JSON.stringify(result)}`);
    }
  }

}
