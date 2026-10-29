import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { ChannelService } from './base/ChannelService';
import { Recipient } from '../../../shared-library/types/Dto/Recipient';
import { TeamsTemplateDetails } from '../../../shared-library/models/Template';
import { logger } from '../../utils/ConsumerLogger';
import axios from 'axios';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { TeamsSettings } from '../../../shared-library/models/submodels/OrganisationSettings';
import { OrganisationService } from '../Organisation';
import { BadRequest } from '../../../server/utils/errors/BadRequest';

@injectable()
export class TeamsService extends ChannelService {
  constructor(@inject(OrganisationService) private organisationService: OrganisationService) {
    super();
  }

  public async send(
    template: TeamsTemplateDetails,
    organisationId: string,
    _recipient?: Recipient,
    _transactionId?: string,
  ): Promise<void> {
    logger.traceStart({ template, organisationId }, 'Sending Teams Notification');
    const teamsSettings: TeamsSettings = (await this.organisationService.getProviderSettings(
      organisationId as string,
      ChannelType.TEAMS,
    )) as TeamsSettings;
    if (!teamsSettings) {
      throw new BadRequest('Teams settings are not provided!');
    }
    if (!teamsSettings.webhook) {
      throw new BadRequest('Teams webhook url is not provided!');
    }
    const payload = {
      ...template,
    };
    try {
      await axios.post(teamsSettings.webhook, payload);
      logger.info('Message sent to Teams through webhook url.');
    } catch (error) {
      throw new Error('Error sending message to Teams: ' + error);
    }
    logger.traceEnd({ template, organisationId }, 'Sending Teams Notification');

    return Promise.resolve();
  }
}
