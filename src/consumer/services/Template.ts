import { inject, injectable } from 'tsyringe';
import { TemplateRepository } from '../../shared-library/repositories/Template';
import { ConsumerLogger } from '../utils/ConsumerLogger';

@injectable()
export class TemplateService {
  private readonly logger = new ConsumerLogger();

  constructor(@inject(TemplateRepository) private templateRepository: TemplateRepository) {}

  public async getTemplate(templateId: string, organisationId: string) {
    this.logger.trace('> Consumer:TemplateService:getTemplate', templateId, organisationId);

    const template = await this.templateRepository.findTemplateById(templateId, organisationId.toString());

    if (!template) {
      throw new Error('No Matching Template Found');
    }

    return template;
  }
}
