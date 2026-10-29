import { inject, injectable } from 'tsyringe';
import { ChannelType } from '../../shared-library/types/Enum/ChannelType';
import { HttpStatusCode } from '../types/Enum/HttpStatusCode';
import { TemplateService } from '../services/Template';
import { Body, Post, Request, Response, Route, Security, SuccessResponse } from 'tsoa';
import { Controller, Get, Path, Query, Tags } from '@tsoa/runtime';
import { CreateTemplateResponseInterface } from '../types/response/CreateTemplate';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';
import { ServerLogger } from '../utils/ServerLogger';
import { validateTemplateDetails } from '../utils/CreateTemplateChannelValidation';
import { CreateTemplateRequest } from '../types/request/CreateTemplateRequest';
import { UpdateTemplateRequest } from '../types/request/UpdateTemplateRequest';
import {
  AIEmailTemplateDto,
  AIOnDeckTemplateDto,
  AIPushTemplateDto,
  AISlackTemplateDto,
} from '../../shared-library/types/Dto/AITemplateDtos';
import { BadRequest } from '../utils/errors/BadRequest';
import {
  AITemplateResponse,
  EmailTemplateResponse,
  OnDeckTemplateResponse,
  PushTemplateResponse,
  SlackTemplateResponse,
} from '../types/response/AITemplateResponse';

@injectable()
@Security(AuthSchemes.orgOwner)
@Security(AuthSchemes.frontendToken)
@Route('api/template')
export class TemplateController extends Controller {
  private readonly logger = new ServerLogger();

  constructor(@inject(TemplateService) private templateService: TemplateService) {
    super();
  }

  /**
   * Create template for an organisation to send a notification later on.
   * @summary Create Email/onDeck/Push/Slack Template
   * @param {CreateTemplateRequest} body - The request body containing Template details.
   */
  @Post()
  @Response('409', 'Template Exists')
  @SuccessResponse<CreateTemplateResponseInterface>('201', 'Created')
  @Tags('Create Templates')
  public async createTemplate(
    @Request() request: NHRequest,
    @Body() body: CreateTemplateRequest,
  ): Promise<CreateTemplateResponseInterface | undefined> {
    validateTemplateDetails(body.channelType, body.templateDetails);

    const response = await this.templateService.createTemplate(
      { ...body, channelType: body.channelType },
      request.user.organisation!._id!,
    );
    if (response) {
      this.setStatus(HttpStatusCode.CREATED);

      return response;
    } else {
      this.setStatus(HttpStatusCode.CONFLICT);

      return;
    }
  }

  /**
   * Update template for an organisation to send a notification later on.
   * @summary Update Template for Email / Push / onDeck / Slack Channels
   * @param {string} templateId - The id of the template to be updated.
   * @param {UpdateTemplateRequest} body - The request body containing Template details of each channel.
   */
  @Post('{templateId}/update')
  @SuccessResponse('200', 'OK')
  @Tags('Update Templates')
  public async updateTemplate(
    @Request() request: NHRequest,
    @Path() templateId: string,
    @Body() body: UpdateTemplateRequest,
  ): Promise<void> {
    validateTemplateDetails(body.channelType, body.templateDetails);
    await this.templateService.updateTemplate(templateId, body, request.user.organisation!._id!);
  }

  /**
   * Displays the list of all the templates that have been created by org owner for all the channels. this Api is called from UI.
   * This also SupportsPagination, Filter the list based on ChannelType, Search the list using template name and sort the templates based on update on field.
   * @summary Fetch Templates List
   * @param page - current page number
   * @param itemsPerPage - number of templates per page
   * @param channel - channel type on which filter should be applied
   * @param name - template name that is used to search the template list.
   * @param sortBy - field to sort by (default: updated_at)
   * @param sortOrder - sort order, either 'asc' or 'desc' (default: 'desc')
   */
  @Get()
  @SuccessResponse('200', 'OK')
  @Tags('List Templates')
  public async getTemplates(
    @Request() request: NHRequest,
    @Query() page?: number,
    @Query() itemsPerPage?: number,
    @Query() channel?: ChannelType,
    @Query() name?: string,
    @Query() sortBy?: string,
    @Query() sortOrder?: 'asc' | 'desc',
  ) {
    // Default sortBy: 'updated_at', sortOrder: 'desc'
    const sortByParam = sortBy ?? 'updated_at';
    const sortOrderParam = sortOrder ?? 'desc';

    return await this.templateService.getTemplates(
      request.user.organisation!._id!,
      page!,
      itemsPerPage!,
      channel!,
      name!,
      sortByParam,
      sortOrderParam,
    );
  }

  /**
   * Receive AI Email Template data from the frontend and generate content.
   * @summary Receive AI Email Template Data
   * @param {AIEmailTemplateDto} body - The email template data from the frontend.
   */
  @Post('ai-email-template')
  @Response('400', 'Bad Request')
  @SuccessResponse('200', 'OK')
  @Tags('AI Templates')
  public async receiveAIEmailTemplate(
    @Request() request: NHRequest,
    @Body() body: AIEmailTemplateDto,
  ): Promise<AITemplateResponse<EmailTemplateResponse>> {
    if (!body.templateName || !body.purpose) {
      throw new BadRequest('Template name and purpose are required.');
    }
    const response = await this.templateService.handleAIEmailTemplate(body);

    return response;
  }

  /**
   * Receive AI OnDeck Template data from the frontend and generate content.
   * @summary Receive AI OnDeck Template Data
   * @param {AIOnDeckTemplateDto} body - The OnDeck template data from the frontend.
   */
  @Post('ai-onDeck-template')
  @Response('400', 'Bad Request')
  @SuccessResponse('200', 'OK')
  @Tags('AI Templates')
  public async receiveAIOnDeckTemplate(
    @Request() request: NHRequest,
    @Body() body: AIOnDeckTemplateDto,
  ): Promise<AITemplateResponse<OnDeckTemplateResponse>> {
    if (!body.templateName || !body.purpose) {
      throw new BadRequest('Template name and purpose are required.');
    }
    const response = await this.templateService.handleAIOnDeckTemplate(body);

    return response;
  }

  /**
   * Receive AI Push Template data from the frontend and generate content.
   * @summary Receive AI Push Template Data
   * @param {AIPushTemplateDto} body - The Push template data from the frontend.
   */
  @Post('ai-push-template')
  @Response('400', 'Bad Request')
  @SuccessResponse('200', 'OK')
  @Tags('AI Templates')
  public async receiveAIPushTemplate(
    @Request() request: NHRequest,
    @Body() body: AIPushTemplateDto,
  ): Promise<AITemplateResponse<PushTemplateResponse>> {
    if (!body.templateName || !body.purpose) {
      throw new BadRequest('Template name and purpose are required.');
    }
    const response = await this.templateService.handleAIPushTemplate(body);

    return response;
  }

  /**
   * Receive Slack Template data from the frontend and generate content.
   * @summary Receive Slack Template Data
   * @param {AISlackTemplateDto} body - The Slack template data from the frontend.
   */
  @Post('ai-slack-template')
  @Response('400', 'Bad Request')
  @SuccessResponse('200', 'OK')
  @Tags('AI Templates')
  public async receiveAISlackTemplate(
    @Request() request: NHRequest,
    @Body() body: AISlackTemplateDto,
  ): Promise<AITemplateResponse<SlackTemplateResponse>> {
    if (!body.templateName || !body.purpose) {
      throw new BadRequest('Template name and purpose are required.');
    }
    const response = await this.templateService.handleAISlackTemplate(body);

    return response;
  }
}
