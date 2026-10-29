import 'reflect-metadata';
import { ValidateError } from '@tsoa/runtime';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { Data, TemplateDetailsInterface, TemplateInterface } from '../../../../src/consumer/types/Interfaces/Template';
import { TemplateHydrationService } from '../../../../src/consumer/services/TemplateHydration';
import { UserDto, UserQueueDto } from '../../../../src/shared-library/types/Dto/Notification';
import { getError, NoErrorThrownError } from '../../../common/errors/NoErrorThrown';

const dummyTemplate = {
  name: 'Promotional Email Template',
  channelType: ChannelType.EMAIL,
  organisationId: '6569777c2373657237f61ffb',
  templateDetails: {
    subject: 'Special Offer - {{recipient.name.first}}',
    body: "<table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'>    <tr>      <td style='padding: 20px 0; text-align: center;'>        <img src='cid:promotionalImage' alt='Special Offer Banner' style='width: 100%; max-width: 600px;'>      </td>    </tr>    <tr>      <td>        <p>Hello {{recipient.name.first}},</p>        <p>Don't miss our special offer!</p>        <p>Click the link below to explore:</p>        <p><a href='{{data.offerUrl}}'>Claim Your Offer</a></p>        <p>Thank you for choosing us!</p>      </td>    </tr>  </table>",
  },
} as TemplateInterface;

describe('TemplateHydrationService', () => {
  let templateHydrationService: TemplateHydrationService;

  describe('Email Template Hydration', () => {
    beforeEach(() => {
      templateHydrationService = new TemplateHydrationService();
    });

    it('should hydrate template with valid placeholders and values', async () => {
      const template: TemplateInterface = dummyTemplate;
      const data = {
        name: 'John Doe',
        offerUrl: 'https://www.google.com/',
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };
      const hydratedTemplate: TemplateDetailsInterface = await templateHydrationService.hydrate(
        template,
        recipient,
        data,
      );

      expect(hydratedTemplate.subject).toEqual('Special Offer - John Doe');
      expect(hydratedTemplate.body).toContain('Hello John Doe');
      expect(hydratedTemplate.body).toContain(`<a href='https://www.google.com/'>`);
    });

    it('should handle missing placeholders correctly', async () => {
      const templateWithMissingPlaceholder = {
        ...dummyTemplate,
        templateDetails: {
          ...dummyTemplate.templateDetails,
          body: dummyTemplate.templateDetails.body.replace('{{data.offerUrl}}', '{{INVALID_PLACEHOLDER}}'),
        },
      };

      const data = {
        name: 'John Doe',
        offerUrl: 'https://www.google.com/',
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };

      const hydratedTemplate = await templateHydrationService.hydrate(templateWithMissingPlaceholder, recipient, data);

      // Verify that the placeholder remains in the content
      expect(hydratedTemplate.subject).toEqual('Special Offer - John Doe');
      expect(hydratedTemplate.body).toContain('{{INVALID_PLACEHOLDER}}');
    });

    it('should handle unrecognized placeholders', async () => {
      const unrecognizedTemplate = {
        ...dummyTemplate,
        templateDetails: {
          ...dummyTemplate.templateDetails,
          body: dummyTemplate.templateDetails.body.replace('{{data.offerUrl}}', '{{UNRECOGNIZED_PLACEHOLDER}}'),
        },
      };

      const data = {
        name: 'John Doe',
        offerUrl: 'https://www.google.com/',
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };

      const hydratedTemplate = await templateHydrationService.hydrate(unrecognizedTemplate, recipient, data);

      // Verify that the unrecognized placeholder remains in the content
      expect(hydratedTemplate.body).toContain('{{UNRECOGNIZED_PLACEHOLDER}}');
    });

    it('should not throw with extra properties in data', async () => {
      const extraPropertiesInData = {
        name: 'John Doe',
        offerUrl: 'https://www.google.com/',
        age: '25',
        url: 'https://example.com',
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };

      const error = await getError(async () =>
        templateHydrationService.hydrate(dummyTemplate, recipient, extraPropertiesInData),
      );

      expect(error).toBeInstanceOf(NoErrorThrownError);
      expect(error).not.toBeInstanceOf(ValidateError);
    });

    it('should handle empty template', async () => {
      const emptyTemplate = { ...dummyTemplate, templateDetails: {} } as TemplateInterface;
      const data = {
        name: 'John Doe',
        offerUrl: 'https://www.google.com/',
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };

      const hydratedTemplate = await templateHydrationService.hydrate(emptyTemplate, recipient, data);

      // Verify that the result is an empty template
      expect(hydratedTemplate.subject).toEqual(undefined);
      expect(hydratedTemplate.body).toEqual(undefined);
    });

    it('should handle empty data', async () => {
      const emptyData = {};
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John Doe' },
      };

      const error = await getError(async () => templateHydrationService.hydrate(dummyTemplate, recipient, emptyData));

      expect(error).not.toBeInstanceOf(NoErrorThrownError);
      expect(error).toBeInstanceOf(ValidateError);

      const validateError: ValidateError = error as ValidateError;

      expect(validateError.fields).toStrictEqual({
        'data.offerUrl': {
          message: 'Placeholder was not populated',
          value: null,
        },
      });
      expect(validateError.name).toStrictEqual('ValidateError');
      expect(validateError.status).toStrictEqual(400);
    });

    it('should handle non-string values in data', async () => {
      const dummyTemplate = {
        name: 'Promotional Email Template',
        channelType: ChannelType.EMAIL,
        organisationId: '6569777c2373657237f61ffb',
        templateDetails: {
          subject: 'Special Offer - {{data.company}}',
          body: "<table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'>    <tr>      <td style='padding: 20px 0; text-align: center;'>        <img src='cid:promotionalImage' alt='Special Offer Banner' style='width: 100%; max-width: 600px;'>      </td>    </tr>    <tr>      <td>        <p>Hello {{data.company}},</p>        <p>Don't miss our special offer!</p>        <p>Click the link below to explore:</p>        <p><a href='{{data.offerUrl}}'>Claim Your Offer</a></p>        <p>Thank you for choosing us!</p>      </td>    </tr>  </table>",
        },
      } as TemplateInterface;

      const nonStringValuesData = {
        company: 123, // number
        offerUrl: true, // boolean
      };
      const recipient: UserQueueDto = {
        channel: ChannelType.EMAIL,
        email: 'test@test.com',
        name: { first: 'John' },
      };

      const hydratedTemplate = await templateHydrationService.hydrate(
        dummyTemplate,
        recipient,
        nonStringValuesData as unknown as Data,
      );

      // Verify that non-string values are converted to strings
      expect(hydratedTemplate.subject).toEqual('Special Offer - 123');
      expect(hydratedTemplate.body).toContain('Hello 123');
      expect(hydratedTemplate.body).toContain(`<a href='true'>`);
    });
  });
});
