import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { TemplateRepository } from '../../shared-library/repositories/Template';
import { BadRequest, Conflict } from '../utils/errors/BadRequest';
import { TemplateInterface, TemplateQuery } from '../../shared-library/models/Template';
import { CreateTemplateResponseInterface } from '../types/response/CreateTemplate';
import { ServerLogger } from '../utils/ServerLogger';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { TemplateViewModel } from '../types/view/TemplateResponse';
import { UpdateTemplateRequest } from '../types/request/UpdateTemplateRequest';
import {
  AIEmailTemplateDto,
  AIOnDeckTemplateDto,
  AIPushTemplateDto,
  AISlackTemplateDto,
  AITeamsTemplateDto,
} from '../../shared-library/types/Dto/AITemplateDtos';
import { OpenAIService } from './OpenAI';
import { PromptBuilder } from '../utils/PromptBuilder';
import {
  AITemplateResponse,
  EmailTemplateResponse,
  OnDeckTemplateResponse,
  PushTemplateResponse,
  SlackTemplateResponse,
  TeamsTemplateResponse,
} from '../types/response/AITemplateResponse';

@injectable()
export class TemplateService {
  private readonly logger = new ServerLogger();

  constructor(
    @inject(TemplateRepository) private templateRepository: TemplateRepository,
    @inject(OpenAIService) private openAIService: OpenAIService,
  ) {}

  public async createTemplate(
    templateReq: Omit<TemplateInterface, 'organisationId'>,
    organisationId: string,
  ): Promise<CreateTemplateResponseInterface | undefined> {
    if (!(await this.isUniqueTemplateName(templateReq.name, templateReq.channelType, organisationId))) {
      throw new Conflict(`Template name '${templateReq.name}' already exists`);
    }

    const insertedTemplate = await this.templateRepository.insertTemplate({ ...templateReq, organisationId });
    this.logger.trace('new template created ', insertedTemplate._id);

    return {
      id: insertedTemplate._id as string,
    };
  }

  public async getTemplate(templateId: string, organisationId: string) {
    const template = await this.templateRepository.findTemplateById(templateId, organisationId.toString());

    if (!template) {
      throw new BadRequest('No Matching Template Found');
    }
    this.logger.trace('fetched template ', template._id);

    return template;
  }

  private async isUniqueTemplateName(
    templateName: string,
    channelType: ChannelType,
    organisationId: string,
  ): Promise<boolean> {
    const existingTemplate = await this.templateRepository.getTemplateCount(templateName, channelType, organisationId);

    return !existingTemplate;
  }

  public async getTemplates(
    organisationId: string,
    page?: number,
    itemsPerPage?: number,
    channel?: ChannelType,
    name?: string,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<TemplateViewModel | undefined> {
    this.logger.traceStart(
      { organisationId, page, itemsPerPage, channel, name, sortBy, sortOrder },
      'server > getTemplates Getting Templates',
    );

    const query: TemplateQuery = { organisationId };
    if (channel) {
      query.channelType = channel;
    }
    if (name) {
      query.name = new RegExp(name, 'i');
    }
    try {
      const [templates, totalItems] = await Promise.all([
        this.templateRepository.getTemplates(query, page! * itemsPerPage!, itemsPerPage, sortBy, sortOrder),
        this.templateRepository.getTemplatesCount(query),
      ]);

      const totalPages = Math.ceil(totalItems / itemsPerPage!);
      this.logger.trace('fetched templates ', templates);

      return {
        templates: templates,
        pagination: {
          currentPage: page!,
          itemsPerPage: itemsPerPage!,
          totalItems: totalItems,
          totalPages: totalPages,
        },
      };
    } catch (error) {
      this.logger.error({ error }, 'server > getTemplates < error in getting Templates');
    } finally {
      this.logger.traceEnd(
        { organisationId, page, itemsPerPage, channel, name, sortBy, sortOrder },
        'server > getTemplates Getting Templates',
      );
    }
  }

  public async updateTemplate(
    templateId: string,
    updateTemplate: UpdateTemplateRequest,
    organisationId: string,
  ): Promise<void> {
    const template = await this.templateRepository.findTemplateById(templateId, organisationId);

    if (!template) {
      throw new BadRequest('Template does not exist');
    }

    await this.templateRepository.updateTemplate(
      templateId,
      updateTemplate.templateDetails,
      organisationId,
      updateTemplate.channelType,
    );
    this.logger.trace(`Updated ${updateTemplate.channelType} template `, templateId);
  }

  public async handleAIEmailTemplate(
    templateData: AIEmailTemplateDto,
  ): Promise<AITemplateResponse<EmailTemplateResponse>> {
    return this.handleAITemplate(
      templateData,
      PromptBuilder.emailPrompt,
      (template: EmailTemplateResponse, index: number) => {
        if (!template.templateName || !template.subject || !template.content) {
          throw new Error(`Email Template ${index + 1} is missing required fields.`);
        }
      },
      'Email templates generated successfully.',
    );
  }

  public async handleAIOnDeckTemplate(
    templateData: AIOnDeckTemplateDto,
  ): Promise<AITemplateResponse<OnDeckTemplateResponse>> {
    return this.handleAITemplate(
      templateData,
      PromptBuilder.onDeckPrompt,
      (template: OnDeckTemplateResponse, index: number) => {
        if (!template.templateName || !template.title || !template.composedMessage) {
          throw new Error(`OnDeck Template ${index + 1} is missing required fields.`);
        }
      },
      'OnDeck templates generated successfully.',
    );
  }

  public async handleAIPushTemplate(
    templateData: AIPushTemplateDto,
  ): Promise<AITemplateResponse<PushTemplateResponse>> {
    return this.handleAITemplate(
      templateData,
      PromptBuilder.pushPrompt,
      (template: PushTemplateResponse, index: number) => {
        if (!template.templateName || !template.title || !template.composedMessage) {
          throw new Error(`Push Template ${index + 1} is missing required fields.`);
        }
      },
      'Push templates generated successfully.',
    );
  }

  public async handleAISlackTemplate(
    templateData: AISlackTemplateDto,
  ): Promise<AITemplateResponse<SlackTemplateResponse>> {
    return this.handleAITemplate(
      templateData,
      PromptBuilder.slackPrompt,
      (template: SlackTemplateResponse, index: number) => {
        if (!template.templateName || !template.composedMessage) {
          throw new Error(`Slack Template ${index + 1} is missing required fields.`);
        }
      },
      'Slack templates generated successfully.',
    );
  }

  public async handleAITeamsTemplate(
    templateData: AITeamsTemplateDto,
  ): Promise<AITemplateResponse<TeamsTemplateResponse>> {
    return this.handleAITemplate(
      templateData,
      PromptBuilder.teamsPrompt,
      (template: TeamsTemplateResponse, index: number) => {
        if (!template.templateName || !template.text) {
          throw new Error(`Teams Template ${index + 1} is missing required fields.`);
        }
      },
      'Teams templates generated successfully.',
    );
  }

  private async handleAITemplate<TemplateResponse, TemplateDto>(
    templateData: TemplateDto,
    promptBuilder: (data: TemplateDto) => string,
    validateTemplate: (template: TemplateResponse, index: number) => void,
    successMessage: string,
  ): Promise<AITemplateResponse<TemplateResponse>> {
    const prompt = promptBuilder(templateData);
    let generatedContent: string;

    try {
      generatedContent = await this.openAIService.generateCompletion(prompt);
    } catch (error) {
      this.logger.error('Error generating AI content', error);
      throw new BadRequest('Error generating AI content.');
    }

    let templates: TemplateResponse[];

    try {
      templates = JSON.parse(generatedContent);

      if (!Array.isArray(templates) || templates.length !== 3) {
        throw new Error('AI did not return an array of three templates.');
      }

      templates.forEach((template, index) => {
        validateTemplate(template, index);
      });
    } catch (error) {
      this.logger.error('Failed to parse AI generated content', error);
      throw new BadRequest('Failed to parse AI generated content.');
    }

    return {
      message: successMessage,
      templates,
    };
  }
}
