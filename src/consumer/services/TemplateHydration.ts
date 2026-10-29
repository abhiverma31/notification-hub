import { injectable } from 'tsyringe';
import { replacePlaceholders } from '../helper/ReplacePlaceholders';
import { Data, TemplateDetailsInterface } from '../types/Interfaces/Template';
import { Recipient } from '../../shared-library/types/Dto/Recipient';
import { ConsumerLogger } from '../utils/ConsumerLogger';
import {
  EmailTemplateDetails,
  onDeckTemplateDetails,
  PushTemplateDetails,
  TemplateInterface,
} from '../../shared-library/models/Template';

@injectable()
export class TemplateHydrationService {
  private readonly logger = new ConsumerLogger();

  public hydrate = async (
    template: TemplateInterface,
    recipient: Recipient,
    data: Data,
  ): Promise<EmailTemplateDetails | PushTemplateDetails | onDeckTemplateDetails> => {
    this.logger.trace('> Consumer:TemplateHydrationService:hydrate', template, recipient, data);

    const templateDetails = template.templateDetails;

    const hydratedTemplate: TemplateDetailsInterface = {};

    for (const key in templateDetails) {
      if (Object.prototype.hasOwnProperty.call(templateDetails, key)) {
        if (key === 'json' && typeof templateDetails[key] === 'string') {
          hydratedTemplate[key] = templateDetails[key];
          continue;
        }
        const content = templateDetails[key] as string;
        hydratedTemplate[key] = replacePlaceholders(content, recipient as any, data);
      }
    }

    return hydratedTemplate as EmailTemplateDetails | PushTemplateDetails | onDeckTemplateDetails;
  };
}
