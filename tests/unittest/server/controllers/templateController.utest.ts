import 'reflect-metadata';
import { TemplateController } from '../../../../src/server/controllers/Template';
import { TemplateService } from '../../../../src/server/services/Template';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { HttpStatusCode } from '../../../../src/server/types/Enum/HttpStatusCode';
import {
  EmailTemplateDetails,
  PushTemplateDetails,
  SlackTemplateDetails,
  onDeckTemplateDetails,
} from '../../../../src/shared-library/models/Template';
import { BadRequest, Conflict } from '../../../../src/server/utils/errors/BadRequest';
import { NHRequest } from '../../../../src/server/types/internal/NHRequest';
import { UpdateTemplateRequest } from '../../../../src/server/types/request/UpdateTemplateRequest';
import {
  AIEmailTemplateDto,
  AIOnDeckTemplateDto,
  AIPushTemplateDto,
  AISlackTemplateDto,
} from '../../../../src/shared-library/types/Dto/AITemplateDtos';
import { EmailLength, SalesIntensity, UrgencyLevel } from '../../../../src/shared-library/types/Enum/AITemplateEnum';
import {
  AITemplateResponse,
  EmailTemplateResponse,
  OnDeckTemplateResponse,
  PushTemplateResponse,
  SlackTemplateResponse,
} from '../../../../src/server/types/response/AITemplateResponse';

jest.mock('../../../../src/server/services/Template.ts');

const validTemplateId = { id: '65951c177ec771e99b2b1269' };

describe('Template Controller', () => {
  const templateServiceMock = new (TemplateService as jest.Mock)();
  const templateController = new TemplateController(templateServiceMock);

  beforeEach(() => {
    jest.clearAllMocks();
    templateController.setStatus = jest.fn();
  });

  describe('createTemplate', () => {
    it('should be create email template and respond with status 201', async () => {
      (TemplateService.prototype.createTemplate as jest.Mock).mockResolvedValue(validTemplateId);

      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };

      const body = {
        name: 'Valid Name',
        templateDetails: {
          subject: 'Special Offer - {{USERNAME}}',
          body: "<p><a href='{{OFFER_URL}}'>Claim Your Offer</a></p><p>Thank you for choosing us!</p>",
          json: {},
        },
        placeholders: ['USERNAME', 'OFFER_URL'],
        channelType: ChannelType.EMAIL,
      };

      await templateController.createTemplate(request, body);

      expect(TemplateService.prototype.createTemplate).toHaveBeenCalledWith(body, request.user.organisation._id);
      expect(templateController.setStatus).toHaveBeenCalledWith(HttpStatusCode.CREATED);
    });

    it('should create push template and respond with status 201', async () => {
      (TemplateService.prototype.createTemplate as jest.Mock).mockResolvedValue(validTemplateId);

      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };

      const body = {
        name: 'Valid Name',
        channelType: ChannelType.PUSH,
        templateDetails: {
          title: 'Special Offer - {{USERNAME}}',
          body: 'Claim Your Offer! Thank you for choosing us!',
        },
        placeholders: ['USERNAME', 'OFFER_URL'],
      };

      await templateController.createTemplate(request, body);

      expect(TemplateService.prototype.createTemplate).toHaveBeenCalledWith(body, request.user.organisation._id);
      expect(templateController.setStatus).toHaveBeenCalledWith(HttpStatusCode.CREATED);
    });

    it('should create onDeck template and respond with status 201', async () => {
      (TemplateService.prototype.createTemplate as jest.Mock).mockResolvedValue(validTemplateId);

      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };

      const body = {
        name: 'Valid Name',
        templateDetails: {
          title: '{{TITLE}}',
          content: '{{CONTENT}}',
          actionUrl: '{{ACTION_URL}}',
        },
        placeholders: ['TITLE', 'CONTENT', 'ACTION_URL'],
        channelType: ChannelType.ONDECK,
      };

      await templateController.createTemplate(request, body);

      expect(TemplateService.prototype.createTemplate).toHaveBeenCalledWith(body, request.user.organisation._id);
      expect(templateController.setStatus).toHaveBeenCalledWith(HttpStatusCode.CREATED);
    });

    it('should create slack template and respond with status 201', async () => {
      (TemplateService.prototype.createTemplate as jest.Mock).mockResolvedValue(validTemplateId);

      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };

      const body = {
        name: 'Valid Template Name',
        templateDetails: {
          text: 'Hello there, I am a basic rich text block!',
          html: '<p></p>',
        },
        channelType: ChannelType.SLACK,
      };

      await templateController.createTemplate(request, body);

      expect(TemplateService.prototype.createTemplate).toHaveBeenCalledWith(body, request.user.organisation._id);
      expect(templateController.setStatus).toHaveBeenCalledWith(HttpStatusCode.CREATED);
    });

    it('should handle 409 conflict when template already exists', async () => {
      (TemplateService.prototype.createTemplate as jest.Mock).mockResolvedValue(validTemplateId);

      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };

      const body = {
        name: 'Valid Template Name',
        channelType: ChannelType.SLACK,
        templateDetails: {
          text: 'Hello there, I am a basic rich text block!',
          html: '<p></p>',
        },
      };
      const conflictErrorMessage = `Template name '${body.name}' already exists`;
      try {
        await templateController.createTemplate(request, body);
      } catch (error) {
        expect(error).toBeInstanceOf(Conflict);
        expect(error.message).toBe(conflictErrorMessage);
      }
    });
  });

  describe('getTemplates Controller', () => {
    it('should return an array of templates', async () => {
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
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };
      (TemplateService.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);
      const result = await templateController.getTemplates(request, 0, 10);
      expect(result).toEqual(validTemplateList);
      expect(result).toHaveLength(2);
    });

    it('should return an empty array', async () => {
      const validTemplateList = [];
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      };
      (TemplateService.prototype.getTemplates as jest.Mock).mockResolvedValue(validTemplateList);
      const result = await templateController.getTemplates(request, 0, 10);
      expect(result).toEqual(validTemplateList);
      expect(result).toHaveLength(0);
    });
  });

  describe('Update Templates', () => {
    it('should update OnDeck template and respond with status 200', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.ONDECK,
        templateDetails: {
          title: 'New Title',
          content: 'Updated Content',
          actionUrl: 'http://example.com/action',
        },
      };

      templateServiceMock.updateTemplate.mockResolvedValueOnce();

      await templateController.updateTemplate(request, templateId, updateTemplate);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should throw a BadRequest error if On Deck template does not exist', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.ONDECK,
        templateDetails: {
          title: 'New Title',
          content: 'Updated Content',
          actionUrl: 'http://example.com/action',
        },
      };

      templateServiceMock.updateTemplate.mockRejectedValueOnce(new BadRequest('Template does not exist'));

      await expect(templateController.updateTemplate(request, templateId, updateTemplate)).rejects.toThrow(BadRequest);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should update Push template and respond with status 200', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.PUSH,
        templateDetails: {
          title: 'New Title',
          body: 'Updated Body',
        } as PushTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockResolvedValueOnce();

      await templateController.updateTemplate(request, templateId, updateTemplate);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should throw a BadRequest error if Push template does not exist', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.PUSH,
        templateDetails: {
          title: 'New Title',
          body: 'Updated Body',
        } as PushTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockRejectedValueOnce(new BadRequest('Template does not exist'));

      await expect(templateController.updateTemplate(request, templateId, updateTemplate)).rejects.toThrow(BadRequest);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should update Email template', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.EMAIL,
        templateDetails: {
          subject: 'New Subject',
          body: 'Updated Body',
          json: { key: 'value' },
        } as EmailTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockResolvedValueOnce();

      await templateController.updateTemplate(request, templateId, updateTemplate);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should throw a BadRequest error if Email template does not exist', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.EMAIL,
        templateDetails: {
          subject: 'New Subject',
          body: 'Updated Body',
          json: { key: 'value' },
        } as EmailTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockRejectedValueOnce(new BadRequest('Template does not exist'));

      await expect(templateController.updateTemplate(request, templateId, updateTemplate)).rejects.toThrow(BadRequest);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should update Slack template', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.SLACK,
        templateDetails: {
          text: 'New Markdown Content',
          html: 'Updated HTML Content',
        } as SlackTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockResolvedValueOnce();

      await templateController.updateTemplate(request, templateId, updateTemplate);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });

    it('should throw a BadRequest error if Slack template does not exist', async () => {
      const request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;

      const templateId = '65951c177ec771e99b2b1269';
      const updateTemplate: UpdateTemplateRequest = {
        channelType: ChannelType.SLACK,
        templateDetails: {
          text: 'New Markdown Content',
          html: 'Updated HTML Content',
        } as SlackTemplateDetails,
      };

      templateServiceMock.updateTemplate.mockRejectedValueOnce(new BadRequest('Template does not exist'));

      await expect(templateController.updateTemplate(request, templateId, updateTemplate)).rejects.toThrow(BadRequest);

      expect(templateServiceMock.updateTemplate).toHaveBeenCalledWith(
        templateId,
        updateTemplate,
        request.user.organisation!._id,
      );
    });
  });

  describe('AI Template Endpoints', () => {
    let request: NHRequest;

    beforeEach(() => {
      request = {
        user: {
          organisation: {
            _id: '65700801832930b3803258fb',
          },
        },
      } as NHRequest;
    });

    describe('receiveAIEmailTemplate', () => {
      it('should generate email templates and return them', async () => {
        const body: AIEmailTemplateDto = {
          templateName: 'Welcome Email',
          purpose: 'To welcome new users',
          marketing: 'Introduce premium features',
          urgency: UrgencyLevel.Medium,
          emailLength: EmailLength.Moderate,
          salesIntensity: SalesIntensity.ModeratelySalesy,
          additionalInstructions: 'Use a friendly tone',
        };

        const generatedTemplates: EmailTemplateResponse[] = [
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
        ];

        const mockResponse: AITemplateResponse<EmailTemplateResponse> = {
          message: 'Email templates generated successfully.',
          templates: generatedTemplates,
        };

        templateServiceMock.handleAIEmailTemplate.mockResolvedValue(mockResponse);

        const result = await templateController.receiveAIEmailTemplate(request, body);

        expect(templateServiceMock.handleAIEmailTemplate).toHaveBeenCalledWith(body);
        expect(result).toEqual(mockResponse);
      });

      it('should throw BadRequest if templateName or purpose is missing', async () => {
        const body: AIEmailTemplateDto = {
          templateName: '',
          purpose: '',
          marketing: '',
          urgency: UrgencyLevel.Medium,
          emailLength: EmailLength.Moderate,
          salesIntensity: SalesIntensity.ModeratelySalesy,
          additionalInstructions: '',
        };

        await expect(templateController.receiveAIEmailTemplate(request, body)).rejects.toThrow(BadRequest);
        await expect(templateController.receiveAIEmailTemplate(request, body)).rejects.toThrow(
          'Template name and purpose are required.',
        );

        expect(templateServiceMock.handleAIEmailTemplate).not.toHaveBeenCalled();
      });
    });

    describe('receiveAIOnDeckTemplate', () => {
      it('should generate OnDeck templates and return them', async () => {
        const body: AIOnDeckTemplateDto = {
          templateName: 'Event Reminder',
          purpose: 'Remind users of upcoming events',
          actionUrl: 'http://example.com/event',
          additionalInstructions: 'Highlight benefits',
        };

        const onDeckTemplate1: onDeckTemplateDetails = {
          title: "Don't Miss Our Event!",
          content: 'Join us for an exciting event at {{ACTION_URL}}.',
          actionUrl: 'http://example.com/event1',
        };

        const onDeckTemplate2: onDeckTemplateDetails = {
          title: 'Upcoming Event Alert!',
          content: "We're thrilled to invite you to our event at {{ACTION_URL}}.",
          actionUrl: 'http://example.com/event2',
        };

        const onDeckTemplate3: onDeckTemplateDetails = {
          title: 'Join Our Event!',
          content: 'Mark your calendar for our event at {{ACTION_URL}}.',
          actionUrl: 'http://example.com/event3',
        };

        const generatedTemplates: OnDeckTemplateResponse[] = [
          {
            templateName: 'Event Reminder 1',
            ...onDeckTemplate1,
            composedMessage: '',
          },
          {
            templateName: 'Event Reminder 2',
            ...onDeckTemplate2,
            composedMessage: '',
          },
          {
            templateName: 'Event Reminder 3',
            ...onDeckTemplate3,
            composedMessage: '',
          },
        ];

        const mockResponse: AITemplateResponse<OnDeckTemplateResponse> = {
          message: 'OnDeck templates generated successfully.',
          templates: generatedTemplates,
        };

        templateServiceMock.handleAIOnDeckTemplate.mockResolvedValue(mockResponse);

        const result = await templateController.receiveAIOnDeckTemplate(request, body);

        expect(templateServiceMock.handleAIOnDeckTemplate).toHaveBeenCalledWith(body);
        expect(result).toEqual(mockResponse);
      });

      it('should throw BadRequest if templateName or purpose is missing', async () => {
        const body: AIOnDeckTemplateDto = {
          templateName: '',
          purpose: '',
          actionUrl: '',
          additionalInstructions: '',
        };

        await expect(templateController.receiveAIOnDeckTemplate(request, body)).rejects.toThrow(BadRequest);
        await expect(templateController.receiveAIOnDeckTemplate(request, body)).rejects.toThrow(
          'Template name and purpose are required.',
        );

        expect(templateServiceMock.handleAIOnDeckTemplate).not.toHaveBeenCalled();
      });
    });

    describe('receiveAIPushTemplate', () => {
      it('should generate push notification templates and return them', async () => {
        const body: AIPushTemplateDto = {
          templateName: 'Discount Offer',
          purpose: 'Inform users about discounts',
          additionalInstructions: 'Create urgency',
        };

        const generatedTemplates: PushTemplateResponse[] = [
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
        ];

        const mockResponse: AITemplateResponse<PushTemplateResponse> = {
          message: 'Push templates generated successfully.',
          templates: generatedTemplates,
        };

        templateServiceMock.handleAIPushTemplate.mockResolvedValue(mockResponse);

        const result = await templateController.receiveAIPushTemplate(request, body);

        expect(templateServiceMock.handleAIPushTemplate).toHaveBeenCalledWith(body);
        expect(result).toEqual(mockResponse);
      });

      it('should throw BadRequest if templateName or purpose is missing', async () => {
        const body: AIPushTemplateDto = {
          templateName: '',
          purpose: '',
          additionalInstructions: '',
        };

        await expect(templateController.receiveAIPushTemplate(request, body)).rejects.toThrow(BadRequest);
        await expect(templateController.receiveAIPushTemplate(request, body)).rejects.toThrow(
          'Template name and purpose are required.',
        );

        expect(templateServiceMock.handleAIPushTemplate).not.toHaveBeenCalled();
      });
    });

    describe('receiveAISlackTemplate', () => {
      it('should generate Slack message templates and return them', async () => {
        const body: AISlackTemplateDto = {
          templateName: 'Team Meeting',
          purpose: 'Remind team about the meeting',
          audience: 'Development Team',
          mentions: '@here',
          urgency: UrgencyLevel.High,
          additionalInstructions: 'Include agenda',
        };

        const generatedTemplates: SlackTemplateResponse[] = [
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
        ];

        const mockResponse: AITemplateResponse<SlackTemplateResponse> = {
          message: 'Slack templates generated successfully.',
          templates: generatedTemplates,
        };

        templateServiceMock.handleAISlackTemplate.mockResolvedValue(mockResponse);

        const result = await templateController.receiveAISlackTemplate(request, body);

        expect(templateServiceMock.handleAISlackTemplate).toHaveBeenCalledWith(body);
        expect(result).toEqual(mockResponse);
      });

      it('should throw BadRequest if templateName or purpose is missing', async () => {
        const body: AISlackTemplateDto = {
          templateName: '',
          purpose: '',
          audience: '',
          mentions: '',
          urgency: UrgencyLevel.Low,
          additionalInstructions: '',
        };

        await expect(templateController.receiveAISlackTemplate(request, body)).rejects.toThrow(BadRequest);
        await expect(templateController.receiveAISlackTemplate(request, body)).rejects.toThrow(
          'Template name and purpose are required.',
        );

        expect(templateServiceMock.handleAISlackTemplate).not.toHaveBeenCalled();
      });
    });
  });
});
