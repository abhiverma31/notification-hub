import "reflect-metadata";
import { TemplateHydrationService } from '../../../../src/consumer/services/TemplateHydration';
import { ChannelType } from "../../../../src/shared-library/types/Enum/ChannelType";
import { replacePlaceholders } from "../../../../src/consumer/helper/ReplacePlaceholders";
import { ValidateError } from "@tsoa/runtime";
import { Recipient } from "../../../../src/shared-library/types/Dto/Recipient";

jest.mock('../../../../src/consumer/helper/ReplacePlaceholders');


const templateHydrationService = new TemplateHydrationService();

describe('TemplateHydrationService', () => {
    beforeEach(() => {
        jest.clearAllMocks(); 
      });
    
  it('should hydrate template with placeholders replaced', async () => {
    const template  = {
        templateDetails: {
            title: "{{data.title}}",
            content: "{{data.content}}",
            actionUrl: "{{data.actionUrl}}"
        }
    } ;

    const recipient = {
        email: "test@technogise.com",
        channels: [ChannelType.EMAIL]
    } as unknown as Recipient;

    const data = {
        "title": "Test Notification-#2",
        "content": "Test ",
        "actionUrl": "www.google.com"
    };

    const expected = {
        "actionUrl": "www.google.com",
         "content": "Test ",
         "title": "Test Notification-#2"
    };
    (replacePlaceholders as jest.Mock).mockImplementation((content: string) => {
        return content.replace('{{data.title}}', 'Test Notification-#2').replace('{{data.content}}', 'Test ').replace('{{data.actionUrl}}', 'www.google.com');
      });
    const result = await templateHydrationService.hydrate(template, recipient, data);
    expect(result).toEqual(expected);
  });

  it('should handle missing placeholders in template', async () => {
    const template = {
        templateDetails: {
            title: "{{data.title}}",
            content: "{{data.content}}",
            actionUrl: "{{data.actionUrl}}"
        }
    };

    const recipient = {
        email: "test@technogise.com",
        channels: [ChannelType.EMAIL]
    } as unknown as Recipient;

    const data = {
        "content": "Test ",
        "actionUrl": "www.google.com"
    };

    const expected = {
        "actionUrl": "www.google.com",
         "content": "Test ",
         "title": "Test Notification-#2"
    };
    (replacePlaceholders as jest.Mock).mockImplementation((content: string) => {
        throw new ValidateError({ field: { message: 'Placeholder was not populated', value: null } }, 'Placeholder was not populated');
      });
      await expect(templateHydrationService.hydrate(template, recipient, data)).rejects.toThrow('Placeholder was not populated');
  
  });
});
