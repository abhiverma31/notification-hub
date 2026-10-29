import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import Pusher from 'pusher';
import { TemplateDetails } from '../../../shared-library/models/Template';
import { PusherSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../../utils/ConsumerLogger';
import { decryptData } from '../../../server/utils/KeyTools';

@injectable()
export class PusherService {
  private readonly logger = new ConsumerLogger();

  constructor() {}

  public async send(
    template: TemplateDetails,
    organisationId: string,
    recipient: Recipient,
    settings: PusherSettings,
  ): Promise<void> {
    this.logger.traceStart({ recipient, organisationId }, 'Sending Pusher Notification');

    const secret = decryptData(settings.secret);

    const pusher = new Pusher({
      appId: settings.appId,
      key: settings.key,
      secret,
      cluster: settings.cluster,
      useTLS: true,
    });

    if (!recipient.pusherChannel?.length) {
      throw new Error('pusherChannel is required for Pusher notifications.');
    }

    const payload = { title: template.title, body: template.body };
    const event = recipient.pusherEvent ?? 'notification';
    await Promise.all(recipient.pusherChannel.map((ch) => pusher.trigger(ch, event, payload)));

    this.logger.traceEnd({ recipient, organisationId }, 'Sending Pusher Notification');
  }
}
