import 'reflect-metadata';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { TemplateService } from '../../../../src/server/services/Template';
import { TemplateRepository } from '../../../../src/shared-library/repositories/Template';
import { BadRequest } from '../../../../src/server/utils/errors/BadRequest';
import { UpdateTemplateRequest } from '../../../../src/server/types/request/UpdateTemplateRequest';
import { OpenAIService } from '../../../../src/server/services/OpenAI';
import { PromptBuilder } from '../../../../src/server/utils/PromptBuilder';
import {
  AIEmailTemplateDto,
  AIOnDeckTemplateDto,
  AIPushTemplateDto,
  AISlackTemplateDto,
  AITeamsTemplateDto,
} from '../../../../src/shared-library/types/Dto/AITemplateDtos';
import { EmailLength, SalesIntensity, UrgencyLevel } from '../../../../src/shared-library/types/Enum/AITemplateEnum';
import {
  AITemplateResponse,
  EmailTemplateResponse,
  OnDeckTemplateResponse,
  PushTemplateResponse,
  SlackTemplateResponse,
  TeamsTemplateResponse,
} from '../../../../src/server/types/response/AITemplateResponse';

jest.mock('../../../../src/shared-library/repositories/Template.ts');
jest.mock('../../../../src/server/services/OpenAI.ts');
jest.mock('../../../../src/server/utils/PromptBuilder', () => ({
  __esModule: true,
  PromptBuilder: {
    emailPrompt: jest.fn(),
    onDeckPrompt: jest.fn(),
    pushPrompt: jest.fn(),
    slackPrompt: jest.fn(),
    teamsPrompt: jest.fn(),
  },
}));

const validEmailTemplate = {
  name: 'Valid Name',
  channelType: ChannelType.EMAIL,
  templateDetails: {
    subject: 'Special Offer - {{USERNAME}}',
    body: "<p><a href='{{OFFER_URL}}'>Claim Your Offer</a></p><p>Thank you for choosing us!</p>",
    json: {},
  },
  placeholders: ['USERNAME', 'OFFER_URL'],
};

describe('TemplateService', () => {
  const templateService: TemplateService = new TemplateService(new (TemplateRepository as jest.Mock)());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should be able to create template', async () => {
      const organisationId = 'organisation123';

      (TemplateRepository.prototype.insertTemplate as jest.Mock).mockResolvedValue({});
      (TemplateRepository.prototype.getTemplateCount as jest.Mock).mockResolvedValue(0);

      await templateService.createTemplate(validEmailTemplate, organisationId);

      expect(TemplateRepository.prototype.insertTemplate).toHaveBeenCalledWith({
        ...validEmailTemplate,
        organisationId,
      });
    });

    it('should throw error if template name is not unique', async () => {
      const organisationId = 'organisation123';

      (TemplateRepository.prototype.getTemplateCount as jest.Mock).mockResolvedValue(2);

      await expect(templateService.createTemplate(validEmailTemplate, organisationId)).rejects.toThrow(
        new BadRequest(`Template name 'Valid Name' already exists`),
      );

      expect(TemplateRepository.prototype.insertTemplate).not.toHaveBeenCalled();
    });
  });

  describe('Get All Template', () => {
    it('should return array of templates', async () => {
      const organisationId = 'organisation123';
      const validTemplateList = [
        {
          _id: '66698c7aa161c35ab3a57858',
          schema_version: 1,
          name: 'Promotional ondeck Template Test',
          channelType: 'onDeck',
          organisationId: '66698c7aa161c35ab3a5784e',
          templateDetails: {
            title: '{{data.title}}',
            content: '{{data.content}}',
            actionUrl: '{{data.actionUrl}}',
          },
        },
        {
          _id: '66698c7aa161c35ab3a57856',
          schema_version: 1,
          name: 'Promotional Push Template Test',
          channelType: 'push',
          organisationId: '66698c7aa161c35ab3a5784e',
          templateDetails: {
            title: 'Special Offer - {{recipient.name.first}}',
            body: "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
          },
        },
      ];
      (TemplateRepository.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);

      const result = await templateService.getTemplates(
        organisationId,
        0,
        10,
        undefined,
        undefined,
        'updated_at',
        'desc',
      );
      const query = { organisationId };
      expect(TemplateRepository.prototype.getTemplates).toHaveBeenCalledWith(query, 0, 10, 'updated_at', 'desc');
      expect(result?.templates).toEqual(validTemplateList);
      expect(result?.templates).toHaveLength(2);
    });

    it('should return empty array', async () => {
      const organisationId = 'organisation123';
      const validTemplateList = [];
      (TemplateRepository.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);

      const result = await templateService.getTemplates(
        organisationId,
        0,
        10,
        undefined,
        undefined,
        'updated_at',
        'desc',
      );
      const query = { organisationId };
      expect(TemplateRepository.prototype.getTemplates).toHaveBeenCalledWith(query, 0, 10, 'updated_at', 'desc');
      expect(result?.templates).toEqual(validTemplateList);
      expect(result?.templates).toHaveLength(0);
    });

    it('should return pagination items of templates', async () => {
      const organisationId = 'organisation123';
      const validTemplateList = [
        {
          _id: '66698c7aa161c35ab3a57858',
          schema_version: 1,
          name: 'Promotional ondeck Template Test',
          channelType: 'onDeck',
          organisationId: '66698c7aa161c35ab3a5784e',
          templateDetails: {
            title: '{{data.title}}',
            content: '{{data.content}}',
            actionUrl: '{{data.actionUrl}}',
          },
        },
        {
          _id: '66698c7aa161c35ab3a57856',
          schema_version: 1,
          name: 'Promotional Push Template Test',
          channelType: 'push',
          organisationId: '66698c7aa161c35ab3a5784e',
          templateDetails: {
            title: 'Special Offer - {{recipient.name.first}}',
            body: "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
          },
        },
      ];
      (TemplateRepository.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);
      (TemplateRepository.prototype.getTemplatesCount as jest.Mock).mockResolvedValue(2);

      const result = await templateService.getTemplates(
        organisationId,
        0,
        2,
        undefined,
        undefined,
        'updated_at',
        'desc',
      );
      const query = { organisationId };
      expect(TemplateRepository.prototype.getTemplates).toHaveBeenCalledWith(query, 0, 2, 'updated_at', 'desc');
      expect(result?.templates).toHaveLength(2);
      expect(result?.pagination?.itemsPerPage).toEqual(2);
      expect(result?.pagination?.totalItems).toEqual(2);
      expect(result?.pagination?.totalPages).toEqual(1);
    });
  });

  it('should return filtered items on channel basis', async () => {
    const organisationId = 'organisation123';
    const validTemplateList = [
      {
        _id: '66698c7aa161c35ab3a57856',
        schema_version: 1,
        name: 'Promotional Push Template Test',
        channelType: 'push',
        organisationId: '66698c7aa161c35ab3a5784e',
        templateDetails: {
          title: 'Special Offer - {{recipient.name.first}}',
          body: "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
        },
      },
    ];
    (TemplateRepository.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);
    (TemplateRepository.prototype.getTemplatesCount as jest.Mock).mockResolvedValue(2);

    const result = await templateService.getTemplates(
      organisationId,
      0,
      2,
      ChannelType.PUSH,
      undefined,
      'updated_at',
      'desc',
    );
    const query = { organisationId, channelType: ChannelType.PUSH };
    expect(TemplateRepository.prototype.getTemplates).toHaveBeenCalledWith(query, 0, 2, 'updated_at', 'desc');
    expect(result?.templates).toHaveLength(1);
    expect(result?.pagination?.itemsPerPage).toEqual(2);
    expect(result?.pagination?.totalItems).toEqual(2);
    expect(result?.pagination?.totalPages).toEqual(1);
  });

  it('should return searched items when searched by template name', async () => {
    const organisationId = 'organisation123';
    const validTemplateList: any[] = [
      {
        _id: '66698c7aa161c35ab3a57856',
        schema_version: 1,
        name: 'Promotional Push Template Test',
        channelType: 'push',
        organisationId: '66698c7aa161c35ab3a5784e',
        templateDetails: {
          title: 'Special Offer - {{recipient.name.first}}',
          body: "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
        },
      },
    ];
    (TemplateRepository.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);
    (TemplateRepository.prototype.getTemplatesCount as jest.Mock).mockResolvedValue(2);

    const result = await templateService.getTemplates(
      organisationId,
      0,
      2,
      undefined,
      'Promotional Push Template Test',
      'updated_at',
      'desc',
    );
    const name = new RegExp('Promotional Push Template Test', 'i');
    const query = { organisationId, name };
    expect(TemplateRepository.prototype.getTemplates).toHaveBeenCalledWith(query, 0, 2, 'updated_at', 'desc');
    expect(result?.templates).toHaveLength(1);
    expect(result?.pagination?.itemsPerPage).toEqual(2);
    expect(result?.pagination?.totalItems).toEqual(2);
    expect(result?.pagination?.totalPages).toEqual(1);
  });

  describe('Update Templates', () => {
    it('should update OnDeck template', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.ONDECK,
        templateDetails: {
          title: 'New Title',
          content: 'Updated Content',
          actionUrl: 'http://example.com/action',
        },
      };

      const existingTemplate = {
        _id: templateId,
        name: 'Existing Template',
        channelType: ChannelType.ONDECK,
        organisationId,
        templateDetails: {
          title: 'Old Title',
          content: 'Old Content',
          actionUrl: 'http://example.com/old-action',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(existingTemplate);
      (TemplateRepository.prototype.updateTemplate as jest.Mock).mockResolvedValue({});

      await templateService.updateTemplate(templateId, updateTemplate, organisationId);

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate.templateDetails,
        organisationId,
        ChannelType.ONDECK,
      );
    });

    it('should throw error if On Deck template does not exist', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.ONDECK,
        templateDetails: {
          title: 'New Title',
          content: 'Updated Content',
          actionUrl: 'http://example.com/action',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(null);

      await expect(templateService.updateTemplate(templateId, updateTemplate, organisationId)).rejects.toThrow(
        new BadRequest('Template does not exist'),
      );

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).not.toHaveBeenCalled();
    });

    it('should update Push template', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.PUSH,
        templateDetails: {
          title: 'New Title',
          body: 'Updated Body',
          offerUrl: 'http://example.com/offer',
        },
      };

      const existingTemplate = {
        _id: templateId,
        name: 'Existing Template',
        channelType: ChannelType.PUSH,
        organisationId,
        templateDetails: {
          title: 'Old Title',
          body: 'Old Body',
          offerUrl: 'http://example.com/old-offer',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(existingTemplate);
      (TemplateRepository.prototype.updateTemplate as jest.Mock).mockResolvedValue({});

      await templateService.updateTemplate(templateId, updateTemplate, organisationId);

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate.templateDetails,
        organisationId,
        ChannelType.PUSH,
      );
    });

    it('should throw error if Push template does not exist', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.PUSH,
        templateDetails: {
          title: 'New Title',
          body: 'Updated Body',
          offerUrl: 'http://example.com/offer',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(null);

      await expect(templateService.updateTemplate(templateId, updateTemplate, organisationId)).rejects.toThrow(
        new BadRequest('Template does not exist'),
      );

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).not.toHaveBeenCalled();
    });

    it('should update Email template', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.EMAIL,
        templateDetails: {
          subject: 'New Subject',
          body: 'Updated Body',
          json: { key: 'value' },
        },
      };

      const existingTemplate = {
        _id: templateId,
        name: 'Existing Template',
        channelType: ChannelType.EMAIL,
        organisationId,
        templateDetails: {
          subject: 'Old Subject',
          body: 'Old Body',
          json: { oldKey: 'oldValue' },
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(existingTemplate);
      (TemplateRepository.prototype.updateTemplate as jest.Mock).mockResolvedValue({});

      await templateService.updateTemplate(templateId, updateTemplate, organisationId);

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate.templateDetails,
        organisationId,
        ChannelType.EMAIL,
      );
    });

    it('should throw error if Email template does not exist', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.EMAIL,
        templateDetails: {
          subject: 'New Subject',
          body: 'Updated Body',
          json: { key: 'value' },
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(null);

      await expect(templateService.updateTemplate(templateId, updateTemplate, organisationId)).rejects.toThrow(
        new BadRequest('Template does not exist'),
      );

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).not.toHaveBeenCalled();
    });

    it('should update Slack template', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.SLACK,
        templateDetails: {
          text: 'New Markdown Content',
          html: 'Updated HTML Content',
        },
      };

      const existingTemplate = {
        _id: templateId,
        name: 'Existing Template',
        channelType: ChannelType.SLACK,
        organisationId,
        templateDetails: {
          text: 'Old Markdown Content',
          html: 'Old HTML Content',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(existingTemplate);
      (TemplateRepository.prototype.updateTemplate as jest.Mock).mockResolvedValue({});

      await templateService.updateTemplate(templateId, updateTemplate, organisationId);

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate.templateDetails,
        organisationId,
        ChannelType.SLACK,
      );
    });

    it('should throw error if Slack template does not exist', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.SLACK,
        templateDetails: {
          text: 'New Markdown Content',
          html: 'Updated HTML Content',
        },
      };

      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(null);

      await expect(templateService.updateTemplate(templateId, updateTemplate, organisationId)).rejects.toThrow(
        new BadRequest('Template does not exist'),
      );

      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith(templateId, organisationId);
      expect(TemplateRepository.prototype.updateTemplate).not.toHaveBeenCalled();
    });
  });

  describe('TemplateService - AI Template Handling', () => {
    let templateService: TemplateService;
    let openAIServiceMock: jest.Mocked<OpenAIService>;
    let templateRepositoryMock: jest.Mocked<TemplateRepository>;

    beforeEach(() => {
      jest.clearAllMocks();
      openAIServiceMock = new OpenAIService() as jest.Mocked<OpenAIService>;
      templateRepositoryMock = new TemplateRepository() as jest.Mocked<TemplateRepository>;
      templateService = new TemplateService(templateRepositoryMock, openAIServiceMock);
    });

    describe('handleAIEmailTemplate', () => {
      it('should generate email templates and return them', async () => {
        const templateData: AIEmailTemplateDto = {
          templateName: 'Welcome Email',
          purpose: 'To welcome new users to our platform',
          marketing: 'Introduce premium features',
          urgency: UrgencyLevel.Medium,
          emailLength: EmailLength.Moderate,
          salesIntensity: SalesIntensity.ModeratelySalesy,
          additionalInstructions: 'Use a friendly tone',
        };
        const prompt = 'Generated email prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Welcome Template 1',
            subject: 'Welcome, {{USERNAME}}!',
            content: 'Hello {{USERNAME}}, welcome to our platform!',
          },
          {
            templateName: 'Welcome Template 2',
            subject: 'Greetings, {{USERNAME}}!',
            content: 'Hi {{USERNAME}}, glad to have you with us!',
          },
          {
            templateName: 'Welcome Template 3',
            subject: 'Hey {{USERNAME}}, Welcome!',
            content: 'Dear {{USERNAME}}, welcome aboard!',
          },
        ]);

        (PromptBuilder.emailPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        const expectedResponse: AITemplateResponse<EmailTemplateResponse> = {
          message: 'Email templates generated successfully.',
          templates: [
            {
              templateName: 'Welcome Template 1',
              subject: 'Welcome, {{USERNAME}}!',
              content: 'Hello {{USERNAME}}, welcome to our platform!',
            },
            {
              templateName: 'Welcome Template 2',
              subject: 'Greetings, {{USERNAME}}!',
              content: 'Hi {{USERNAME}}, glad to have you with us!',
            },
            {
              templateName: 'Welcome Template 3',
              subject: 'Hey {{USERNAME}}, Welcome!',
              content: 'Dear {{USERNAME}}, welcome aboard!',
            },
          ],
        };

        const result = await templateService.handleAIEmailTemplate(templateData);

        expect(PromptBuilder.emailPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
        expect(result).toEqual(expectedResponse);
      });

      it('should throw BadRequest if OpenAIService fails', async () => {
        const templateData: AIEmailTemplateDto = {
          templateName: 'Welcome Email',
          purpose: 'To welcome new users to our platform',
          marketing: 'Introduce premium features',
          urgency: UrgencyLevel.Medium,
          emailLength: EmailLength.Moderate,
          salesIntensity: SalesIntensity.ModeratelySalesy,
          additionalInstructions: 'Use a friendly tone',
        };
        const prompt = 'Generated email prompt based on the template data';
        const errorMessage = 'OpenAI error';

        (PromptBuilder.emailPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockRejectedValue(new Error(errorMessage));

        await expect(templateService.handleAIEmailTemplate(templateData)).rejects.toThrow(
          'Error generating AI content.',
        );

        expect(PromptBuilder.emailPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });

      it('should throw BadRequest if AI did not return an array of three templates', async () => {
        const templateData: AIEmailTemplateDto = {
          templateName: 'Welcome Email',
          purpose: 'To welcome new users to our platform',
          marketing: 'Introduce premium features',
          urgency: UrgencyLevel.Medium,
          emailLength: EmailLength.Moderate,
          salesIntensity: SalesIntensity.ModeratelySalesy,
          additionalInstructions: 'Use a friendly tone',
        };
        const prompt = 'Generated email prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Welcome Template 1',
            subject: 'Welcome, {{USERNAME}}!',
          },
        ]);

        (PromptBuilder.emailPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        await expect(templateService.handleAIEmailTemplate(templateData)).rejects.toThrow(
          'Failed to parse AI generated content.',
        );

        expect(PromptBuilder.emailPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });
    });

    describe('handleAIOnDeckTemplate', () => {
      it('should generate OnDeck templates and return them', async () => {
        const templateData: AIOnDeckTemplateDto = {
          templateName: 'Event Reminder',
          purpose: 'To remind users about upcoming events',
          actionUrl: 'http://example.com/event',
          additionalInstructions: 'Highlight the benefits of attending',
        };
        const prompt = 'Generated OnDeck prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Event Reminder 1',
            title: "Don't Miss Our Event!",
            composedMessage: 'Join us for an exciting event at {{ACTION_URL}}.',
            actionUrl: 'http://example.com/event1',
          },
          {
            templateName: 'Event Reminder 2',
            title: 'Upcoming Event Alert!',
            composedMessage: "We're thrilled to invite you to our event at {{ACTION_URL}}.",
            actionUrl: 'http://example.com/event2',
          },
          {
            templateName: 'Event Reminder 3',
            title: 'Join Our Event!',
            composedMessage: 'Mark your calendar for our event at {{ACTION_URL}}.',
            actionUrl: 'http://example.com/event3',
          },
        ]);

        (PromptBuilder.onDeckPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        const expectedResponse: AITemplateResponse<OnDeckTemplateResponse> = {
          message: 'OnDeck templates generated successfully.',
          templates: [
            {
              templateName: 'Event Reminder 1',
              title: "Don't Miss Our Event!",
              composedMessage: 'Join us for an exciting event at {{ACTION_URL}}.',
              actionUrl: 'http://example.com/event1',
            },
            {
              templateName: 'Event Reminder 2',
              title: 'Upcoming Event Alert!',
              composedMessage: "We're thrilled to invite you to our event at {{ACTION_URL}}.",
              actionUrl: 'http://example.com/event2',
            },
            {
              templateName: 'Event Reminder 3',
              title: 'Join Our Event!',
              composedMessage: 'Mark your calendar for our event at {{ACTION_URL}}.',
              actionUrl: 'http://example.com/event3',
            },
          ],
        };

        const result = await templateService.handleAIOnDeckTemplate(templateData);

        expect(PromptBuilder.onDeckPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
        expect(result).toEqual(expectedResponse);
      });

      it('should throw BadRequest if OpenAIService fails', async () => {
        const templateData: AIOnDeckTemplateDto = {
          templateName: 'Event Reminder',
          purpose: 'To remind users about upcoming events',
          actionUrl: 'http://example.com/event',
          additionalInstructions: 'Highlight the benefits of attending',
        };
        const prompt = 'Generated OnDeck prompt based on the template data';
        const errorMessage = 'OpenAI error';

        (PromptBuilder.onDeckPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockRejectedValue(new Error(errorMessage));

        await expect(templateService.handleAIOnDeckTemplate(templateData)).rejects.toThrow(
          'Error generating AI content.',
        );

        expect(PromptBuilder.onDeckPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });

      it('should throw BadRequest if AI did not return an array of three templates', async () => {
        const templateData: AIOnDeckTemplateDto = {
          templateName: 'Event Reminder',
          purpose: 'To remind users about upcoming events',
          actionUrl: 'http://example.com/event',
          additionalInstructions: 'Highlight the benefits of attending',
        };
        const prompt = 'Generated OnDeck prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Event Reminder 1',
            title: "Don't Miss Our Event!",
          },
        ]);

        (PromptBuilder.onDeckPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        await expect(templateService.handleAIOnDeckTemplate(templateData)).rejects.toThrow(
          'Failed to parse AI generated content.',
        );

        expect(PromptBuilder.onDeckPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });
    });

    describe('handleAIPushTemplate', () => {
      it('should generate push notification templates and return them', async () => {
        const templateData: AIPushTemplateDto = {
          templateName: 'Discount Offer',
          purpose: 'To inform users about special discounts',
          additionalInstructions: 'Create urgency',
        };
        const prompt = 'Generated push notification prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Discount Offer 1',
            title: 'Limited Time Discount!',
            composedMessage: 'Get {{DISCOUNT}} off on your next purchase. Act now!',
          },
          {
            templateName: 'Discount Offer 2',
            title: 'Exclusive Discount Just for You!',
            composedMessage: 'Enjoy a special {{DISCOUNT}} discount. Hurry!',
          },
          {
            templateName: 'Discount Offer 3',
            title: 'Save Big with Our Latest Discount!',
            composedMessage: 'Avail {{DISCOUNT}} off before it’s gone!',
          },
        ]);

        (PromptBuilder.pushPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        const expectedResponse: AITemplateResponse<PushTemplateResponse> = {
          message: 'Push templates generated successfully.',
          templates: [
            {
              templateName: 'Discount Offer 1',
              title: 'Limited Time Discount!',
              composedMessage: 'Get {{DISCOUNT}} off on your next purchase. Act now!',
            },
            {
              templateName: 'Discount Offer 2',
              title: 'Exclusive Discount Just for You!',
              composedMessage: 'Enjoy a special {{DISCOUNT}} discount. Hurry!',
            },
            {
              templateName: 'Discount Offer 3',
              title: 'Save Big with Our Latest Discount!',
              composedMessage: 'Avail {{DISCOUNT}} off before it’s gone!',
            },
          ],
        };

        const result = await templateService.handleAIPushTemplate(templateData);

        expect(PromptBuilder.pushPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
        expect(result).toEqual(expectedResponse);
      });

      it('should throw BadRequest if OpenAIService fails', async () => {
        const templateData: AIPushTemplateDto = {
          templateName: 'Discount Offer',
          purpose: 'To inform users about special discounts',
          additionalInstructions: 'Create urgency',
        };
        const prompt = 'Generated push notification prompt based on the template data';
        const errorMessage = 'OpenAI error';

        (PromptBuilder.pushPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockRejectedValue(new Error(errorMessage));

        await expect(templateService.handleAIPushTemplate(templateData)).rejects.toThrow(
          'Error generating AI content.',
        );

        expect(PromptBuilder.pushPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });

      it('should throw BadRequest if AI did not return an array of three templates', async () => {
        const templateData: AIPushTemplateDto = {
          templateName: 'Discount Offer',
          purpose: 'To inform users about special discounts',
          additionalInstructions: 'Create urgency',
        };
        const prompt = 'Generated push notification prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Discount Offer 1',
          },
        ]);

        (PromptBuilder.pushPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        await expect(templateService.handleAIPushTemplate(templateData)).rejects.toThrow(
          'Failed to parse AI generated content.',
        );

        expect(PromptBuilder.pushPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });
    });

    describe('handleAISlackTemplate', () => {
      it('should generate Slack message templates and return them', async () => {
        const templateData: AISlackTemplateDto = {
          templateName: 'Team Meeting',
          purpose: 'To remind team members about the upcoming meeting',
          audience: 'Development Team',
          mentions: '@here',
          urgency: UrgencyLevel.High,
          additionalInstructions: 'Include meeting agenda',
        };
        const prompt = 'Generated Slack message prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Team Meeting 1',
            composedMessage:
              "Hello @here, don't forget about the team meeting at {{MEETING_TIME}}. Agenda: {{AGENDA}}.",
          },
          {
            templateName: 'Team Meeting 2',
            composedMessage:
              '@here Reminder: Our team meeting is scheduled for {{MEETING_TIME}}. Please review the agenda: {{AGENDA}}.',
          },
          {
            templateName: 'Team Meeting 3',
            composedMessage: 'Hi @here, join us for the team meeting at {{MEETING_TIME}}. Agenda includes: {{AGENDA}}.',
          },
        ]);

        (PromptBuilder.slackPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        const expectedResponse: AITemplateResponse<SlackTemplateResponse> = {
          message: 'Slack templates generated successfully.',
          templates: [
            {
              templateName: 'Team Meeting 1',
              composedMessage:
                "Hello @here, don't forget about the team meeting at {{MEETING_TIME}}. Agenda: {{AGENDA}}.",
            },
            {
              templateName: 'Team Meeting 2',
              composedMessage:
                '@here Reminder: Our team meeting is scheduled for {{MEETING_TIME}}. Please review the agenda: {{AGENDA}}.',
            },
            {
              templateName: 'Team Meeting 3',
              composedMessage:
                'Hi @here, join us for the team meeting at {{MEETING_TIME}}. Agenda includes: {{AGENDA}}.',
            },
          ],
        };

        const result = await templateService.handleAISlackTemplate(templateData);

        expect(PromptBuilder.slackPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
        expect(result).toEqual(expectedResponse);
      });

      it('should throw BadRequest if OpenAIService fails', async () => {
        const templateData: AISlackTemplateDto = {
          templateName: 'Team Meeting',
          purpose: 'To remind team members about the upcoming meeting',
          audience: 'Development Team',
          mentions: '@here',
          urgency: UrgencyLevel.High,
          additionalInstructions: 'Include meeting agenda',
        };
        const prompt = 'Generated Slack message prompt based on the template data';
        const errorMessage = 'OpenAI error';

        (PromptBuilder.slackPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockRejectedValue(new Error(errorMessage));

        await expect(templateService.handleAISlackTemplate(templateData)).rejects.toThrow(
          'Error generating AI content.',
        );

        expect(PromptBuilder.slackPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });

      it('should throw BadRequest if AI did not return an array of three templates', async () => {
        const templateData: AISlackTemplateDto = {
          templateName: 'Team Meeting',
          purpose: 'To remind team members about the upcoming meeting',
          audience: 'Development Team',
          mentions: '@here',
          urgency: UrgencyLevel.High,
          additionalInstructions: 'Include meeting agenda',
        };
        const prompt = 'Generated Slack message prompt based on the template data';
        const generatedContent = JSON.stringify([
          {
            templateName: 'Team Meeting 1',
          },
        ]);

        (PromptBuilder.slackPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        await expect(templateService.handleAISlackTemplate(templateData)).rejects.toThrow(
          'Failed to parse AI generated content.',
        );

        expect(PromptBuilder.slackPrompt).toHaveBeenCalledWith(templateData);
        expect(openAIServiceMock.generateCompletion).toHaveBeenCalledWith(prompt);
      });
    });

    describe('handleAITeamsTemplate', () => {
      it('should generate Teams templates and return them', async () => {
        const templateData: AITeamsTemplateDto = {
          templateName: 'Standup Reminder',
          purpose: 'Remind team about daily standup',
          audience: 'Engineering',
          urgency: UrgencyLevel.Medium,
        };
        const prompt = 'Generated Teams prompt';
        const generatedContent = JSON.stringify([
          { templateName: 'Standup 1', text: 'Hey team, standup in 5 minutes!' },
          { templateName: 'Standup 2', text: 'Reminder: daily standup starting soon.' },
          { templateName: 'Standup 3', text: 'Time for standup, join the call!' },
        ]);

        (PromptBuilder.teamsPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockResolvedValue(generatedContent);

        const result = await templateService.handleAITeamsTemplate(templateData);

        expect(PromptBuilder.teamsPrompt).toHaveBeenCalledWith(templateData);
        expect(result.message).toBe('Teams templates generated successfully.');
        expect(result.templates).toHaveLength(3);
      });

      it('should throw BadRequest if OpenAI fails', async () => {
        const templateData: AITeamsTemplateDto = {
          templateName: 'Standup Reminder',
          purpose: 'Remind team about daily standup',
        };
        const prompt = 'Generated Teams prompt';

        (PromptBuilder.teamsPrompt as jest.Mock).mockReturnValue(prompt);
        openAIServiceMock.generateCompletion.mockRejectedValue(new Error('OpenAI error'));

        await expect(templateService.handleAITeamsTemplate(templateData)).rejects.toThrow(
          'Error generating AI content.',
        );
      });
    });
  });

  describe('getTemplate', () => {
    it('should return template when found', async () => {
      const mockTemplate = { _id: 'tpl-1', name: 'Welcome' };
      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await templateService.getTemplate('tpl-1', 'org-1');

      expect(result).toEqual(mockTemplate);
      expect(TemplateRepository.prototype.findTemplateById).toHaveBeenCalledWith('tpl-1', 'org-1');
    });

    it('should throw BadRequest when template not found', async () => {
      (TemplateRepository.prototype.findTemplateById as jest.Mock).mockResolvedValue(null);

      await expect(templateService.getTemplate('bad-id', 'org-1')).rejects.toThrow('No Matching Template Found');
    });
  });
});
