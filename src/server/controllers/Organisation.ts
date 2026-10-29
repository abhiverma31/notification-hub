import { inject, injectable } from 'tsyringe';
import { OrganisationService } from '../services/Organisation';
import { HttpStatusCode } from '../types/Enum/HttpStatusCode';
import { Body, Post, Route, SuccessResponse, Response, Security, Path, Get, Request } from 'tsoa';
import { Controller, Tags } from '@tsoa/runtime';
import { CreateOrganisationResponse } from '../types/response/CreateOrganisation';
import { CreateOrganisationRequest, CreateProviderSettingRequest } from '../types/request/CreateOrganisation';
import multer from 'multer';
import {
  EmailProvider,
  OrganisationSettingsInterface,
  PushProvider,
  SlackProvider,
  SmsProvider,
  TeamsProvider,
  TelegramProvider,
  WhatsappProvider,
} from '../../shared-library/models/submodels/OrganisationSettings';
import { NHRequest } from '../types/internal/NHRequest';
import { AuthSchemes } from '../middlewares/Authentication';
import { logger } from '../utils/ServerLogger';
import { BadRequest } from '../utils/errors/BadRequest';
import { GetOrganisationResponse } from '../types/response/GetOrganisation';
import { SmsAndWhatsappSettingsDto } from '../../shared-library/types/Dto/SmsAndWhatsappSettingsDto';
import { NotificationService } from '../services/Notification';
import { EmailTestService } from '../services/EmailTestService';
import { ApnsTestService } from '../services/ApnsTestService';
const storage = multer.memoryStorage();
const upload = multer({ storage });

@injectable()
@Security(AuthSchemes.admin)
@Security(AuthSchemes.frontendToken)
@Route('api/organisation')
export class OrganisationController extends Controller {
  constructor(
    @inject(OrganisationService)
    private organisationService: OrganisationService,
    @inject(NotificationService)
    private notificationService: NotificationService,
    @inject(EmailTestService)
    private emailTestService: EmailTestService,
    @inject(ApnsTestService)
    private apnsTestService: ApnsTestService,
  ) {
    super();
  }

  /**
   * Register Organisation in the system using the name of the organisation.
   * @summary Register Organisation
   * @param {SendNotificationRequest} body - The request body containing Organisation Name.
   */
  @Post()
  @Response('409', 'Organisation Exists')
  @SuccessResponse<CreateOrganisationResponse>('201', 'Created')
  @Tags('Organisation')
  public async create(
    @Body() createRequest: CreateOrganisationRequest,
    @Request() request?: NHRequest,
  ): Promise<CreateOrganisationResponse | undefined> {
    const createOrganisationResponse = await this.organisationService.createOrganisation(
      createRequest,
      request!.user.member!,
    );

    if (createOrganisationResponse) {
      this.setStatus(HttpStatusCode.CREATED);

      return createOrganisationResponse;
    } else {
      this.setStatus(HttpStatusCode.CONFLICT);

      return;
    }
  }

  /**
   * Get Organisation Details.this is used to internally call the org and get detailes to diplay it in the UI.
   * @summary Get Organisation Details.
   */
  @Get('details')
  @Response<GetOrganisationResponse>('200', 'OK')
  @Tags('Organisation')
  public async getOrganisation(@Request() request: NHRequest) {
    return await this.organisationService.getOrganisationDetailsById(request.user.organisation!);
  }

  /**
   * Get Organisation Settings that has been Created/Updated by the org owner during organisation creation.
   * @summary Get Organisation settings.
   * @param {string} id - The id of the organisation.
   */
  @Get('{id}/settings')
  @Response<OrganisationSettingsInterface>('200', 'OK')
  @Tags('Integrate channel settings')
  public async getSettings(@Path() id: string): Promise<OrganisationSettingsInterface> {
    return await this.organisationService.getSettings(id);
  }

  /**
   * Admin can update Email settings for organisation if they need new settings.
   * @summary Update Email settings for organisation.
   * @param {string} id - The id of the organisation.
   * @param {EmailProvider} settings - The request body containing new Email Provider Settings that need to be updated.
   */
  @Post('{id}/settings/email')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async updateEmailSettings(
    @Path() id: string,
    @Body() settings: EmailProvider[],
  ): Promise<{ webhookRegistration?: { status: string; reason?: string } }> {
    const webhookResult = await this.organisationService.updateEmailSettings(id, settings);

    return { webhookRegistration: webhookResult ?? undefined };
  }

  /**
   * Retry automatic SendGrid webhook registration for an organisation.
   * @summary Retry SendGrid webhook registration
   * @param {string} id - The id of the organisation.
   */
  @Post('{id}/settings/email/retry-webhook')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async retryWebhookRegistration(
    @Path() id: string,
  ): Promise<{ webhookRegistration: { status: string; reason?: string } }> {
    const result = await this.organisationService.retryWebhookRegistration(id);

    return { webhookRegistration: result };
  }

  /**
   * Admin can update Push settings for organisation if they need new settings.
   * @summary Update Push settings for organisation.
   * @param {string} id - The id of the organisation.
   * @param {PushProvider} settings - The request body containing new Push Provider Settings that need to be updated.
   */
  @Post('{id}/settings/push')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async updatePushSettings(@Path() id: string, @Body() settings: PushProvider[]): Promise<void> {
    await this.organisationService.updatePushSettings(id, settings);
  }

  /**
   * Admin can update SMS and WhatsApp provider settings for the organisation.
   * @summary Update SMS and WhatsApp provider settings for the organisation.
   * @param {string} id - The id of the organisation.
   * @param {SmsAndWhatsappSettingsDto} providerConfigurationDto - The request body containing new SMS and WhatsApp provider settings.
   */
  @Post('{id}/settings/sms-whatsapp')
  @SuccessResponse('200', 'Settings Updated Successfully')
  @Tags('Integrate channel settings')
  public async updateSmsAndWhatsappConfiguration(
    @Path() id: string,
    @Body() body: { sms: SmsProvider[]; whatsapp: WhatsappProvider[] },
  ): Promise<void> {
    const providerConfigurationDto = new SmsAndWhatsappSettingsDto(body.sms, body.whatsapp);

    providerConfigurationDto.validate();

    await this.organisationService.updateSmsProviderSettings(id, providerConfigurationDto.sms);

    await this.organisationService.updateWhatsappProviderSettings(id, providerConfigurationDto.whatsapp);
  }

  /**
   * Admin can update SMS provider settings for the organisation.
   * @summary Update SMS provider settings for the organisation.
   * @param {string} id - The id of the organisation.
   * @param {SmsProvider} settings - The request body containing new SMS Provider Settings that need to be updated.
   */
  @Post('{id}/settings/sms')
  @SuccessResponse('200', 'SMS Settings Updated Successfully')
  @Tags('Integrate channel settings')
  public async updateSmsProviderConfiguration(@Path() id: string, @Body() settings: SmsProvider[]): Promise<void> {
    await this.organisationService.updateSmsProviderSettings(id, settings);
  }

  /**
   * Admin can update WhatsApp provider settings for the organisation.
   * @summary Update WhatsApp provider settings for the organisation.
   * @param {string} id - The id of the organisation.
   * @param {WhatsappProvider} settings - The request body containing new WhatsApp Provider Settings that need to be updated.
   */
  @Post('{id}/settings/whatsapp')
  @SuccessResponse('200', 'WhatsApp Settings Updated Successfully')
  @Tags('Integrate channel settings')
  public async updateWhatsappProviderConfiguration(
    @Path() id: string,
    @Body() settings: WhatsappProvider[],
  ): Promise<void> {
    await this.organisationService.updateWhatsappProviderSettings(id, settings);
  }

  /**
   * Admin can update Slack settings for organisation if they need any customisation or extra settings needed for slack.
   * @summary Update Slack settings for organisation.
   * @param {string} id - The id of the organisation.
   * @param {SlackProvider} settings - The request body containing new Slack Provider Settings that need to be updated.
   */
  @Post('{id}/settings/slack')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async updateSlackSettings(@Path() id: string, @Body() settings: SlackProvider[]): Promise<void> {
    await this.organisationService.updateSlackSettings(id, settings);
  }

  /**
   * Admin can update Teams settings for organisation if they need any customisation or extra settings needed for teams.
   * @summary Update Teams settings for organisation.
   * @param {string} id - The id of the organisation.
   * @param {TeamsProvider} settings - The request body containing new Teams Provider Settings that need to be updated.
   */
  @Post('{id}/settings/teams')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async updateTeamsSettings(@Path() id: string, @Body() settings: TeamsProvider[]): Promise<void> {
    await this.organisationService.updateTeamsSettings(id, settings);
  }

  /**
   * Admin can update Telegram settings for organisation.
   * @summary Update Telegram settings for organisation.
   * @param {string} id - The id of the organisation.
   * @param {TelegramProvider} settings - The request body containing new Telegram Provider Settings.
   */
  @Post('{id}/settings/telegram')
  @SuccessResponse('200', 'OK')
  @Tags('Integrate channel settings')
  public async updateTelegramSettings(@Path() id: string, @Body() settings: TelegramProvider[]): Promise<void> {
    await this.organisationService.updateTelegramSettings(id, settings);
  }

  /**
   * Organisation Owner can regenerate Api keys for existing organisation in case if the previously generated keys are lost or for security issues.
   * @summary Generate new Api keys for existing organisation.
   * @param {CreateOrganisationRequest} regenerateRequest - The request body containing Organisation Name for which the keys need to be regenerated.
   */
  @Post('regenerate-keys')
  @Response('400', 'Organisation doesnt exist')
  @SuccessResponse<CreateOrganisationResponse>('200', 'OK')
  @Tags('Organisation')
  public async regenerateKeys(
    @Body() regenerateRequest: CreateOrganisationRequest,
  ): Promise<CreateOrganisationResponse | undefined> {
    return await this.organisationService.regenerateKeys(regenerateRequest);
  }

  /**
   * Organisation Owner can create settings for each channels such as Email, Push and Slack in ordeer to send Notification through the Organisation that has been registered.
   * @summary Create Provider Settings.
   * @param {CreateOrganisationRequest} createProviderSettingRequest - The request body containing Organisation settings that need to be added. for reference , example value only contain email settings, for other channels please refer the update settings api examples.
   */
  @Post('settings')
  @Security('org-owner')
  @Security('frontend-token')
  @Response('400', 'Organisation does not exist')
  @SuccessResponse('201', 'Created')
  @Tags('Integrate channel settings')
  public async createProviderSetting(
    @Request() request: NHRequest,
    @Body() createProviderSettingRequest: CreateProviderSettingRequest,
  ): Promise<void> {
    return await this.organisationService.createProviderSetting(
      request.user.organisation!._id!,
      createProviderSettingRequest,
    );
  }

  /**
   * Upload Firebase Configuration File. this Api is used for frontend to upload firebase config file.
   * @summary Upload Firebase Configuration File.
   */
  @Post('upload-firebase-config')
  @Security('org-owner')
  @Security('frontend-token')
  @SuccessResponse('201', 'Firebase configuration uploaded successfully')
  @Tags('Integrate channel settings')
  public async uploadFirebaseConfig(@Request() req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      upload.single('file')(req, {} as any, async (err: any) => {
        if (err) {
          this.setStatus(400);

          return reject(new BadRequest('Failed to upload file'));
        }

        try {
          const fileData = req.file.buffer.toString('utf-8');
          const json = JSON.parse(fileData);
          logger.info('Received JSON :', json);
          const { project_id, private_key, client_email } = json;

          if (!project_id || !private_key || !client_email) {
            this.setStatus(400);

            return reject(new BadRequest('Missing required fields in the Firebase config file'));
          }

          await this.organisationService.createProviderSetting(req.user.organisation._id, {
            channelType: 'push',
            provider: 'firebase',
            enabled: true,
            settings: {
              firebaseClientEmail: client_email,
              privateKey: private_key,
              projectId: project_id,
            },
          } as CreateProviderSettingRequest);

          this.setStatus(201);
          resolve();
        } catch (error) {
          logger.error('Failed to parse and save the Firebase Configuration', error);
          this.setStatus(500);
          reject(new Error('Failed to parse and save the Firebase Configuration'));
        }
      });
    });
  }

  /**
   * Send test email
   * @summary Send Test Email
   */
  @Post('{orgId}/test-email')
  @Security('org-owner')
  @Security('frontend-token')
  @SuccessResponse('200', 'Test email sent')
  @Response('400', 'Bad Request')
  @Tags('Organisation')
  public async testEmail(
    @Path() orgId: string,
    @Body() body: { email: string; provider?: string },
  ): Promise<{ message: string }> {
    return await this.emailTestService.sendTestEmail(orgId, body.email);
  }

  /**
   * Send a test APNs notification to verify configuration.
   * @summary Test APNs Notification
   * @param {string} id - The id of the organisation.
   * @param {object} body - The request body containing device token and optional test message.
   */
  @Post('{id}/test/push-apns')
  @Security('org-owner')
  @Security('frontend-token')
  @SuccessResponse('200', 'Test notification sent')
  @Response('400', 'Configuration error or invalid request')
  @Tags('Integrate channel settings')
  public async testApnsNotification(
    @Path() id: string,
    @Body() body: { deviceToken: string; testMessage?: string },
  ): Promise<{ success: boolean; message: string; details?: any }> {
    return await this.apnsTestService.testApnsNotification(id, body.deviceToken, body.testMessage);
  }
}
