import { inject, injectable } from 'tsyringe';
import { ChannelService } from './base/ChannelService';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { SlackTemplateDetails } from '../../../shared-library/models/Template';
import { logger } from '../../utils/ConsumerLogger';
import axios from 'axios';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { SlackSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { OrganisationService } from '../Organisation';
import { WebClient } from '@slack/web-api';
import { BadRequest } from '../../../server/utils/errors/BadRequest';
import { SlackPayload } from '../../../shared-library/types/Interfaces/SlackPayload';

@injectable()
export class SlackService extends ChannelService {
  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {
    super();
  }
  public async send(
    template: SlackTemplateDetails,
    organisationId: string,
    _recipient?: Recipient,
    _transactionId?: string,
  ): Promise<void> {
    logger.traceStart({ template, organisationId }, 'Sending slack Notification');
    const slackSettings: SlackSettings = (await this.organisationService.getProviderSettings(
      organisationId as string,
      ChannelType.SLACK,
    )) as SlackSettings;

    if (!slackSettings) {
      throw new BadRequest('Slack settings are not provided!');
    }

    const payload: SlackPayload = {
      text: template.text!,
      channel: slackSettings.slack_channel!,
      username: slackSettings.bot_name!,
      icon_url: slackSettings.icon_url!,
      icon_emoji: slackSettings.icon_emoji!,
      always_online: slackSettings.always_online!,
    };

    const presence =
      slackSettings.always_online !== undefined ? (slackSettings.always_online ? 'auto' : 'away') : 'auto';

    let response;
    try {
      if (slackSettings.oAuthToken!) {
        const slackClient = new WebClient(slackSettings.oAuthToken!);
        response = await slackClient.chat.postMessage(payload);
        logger.info('Message sent to Slack through token:', response.ok);

        await slackClient.users.setPresence({ presence });
        logger.info('Slack Bot presence set to :', presence);
      } else {
        response = await axios.post(slackSettings.webhook!, payload);
        logger.info('Message sent to Slack through webhook url:', response.data);
      }
    } catch (error) {
      throw new Error('Error sending message to Slack' + error);
    }
    logger.traceEnd({ template, organisationId }, 'Sending slack Notification');

    return Promise.resolve();
  }
}
