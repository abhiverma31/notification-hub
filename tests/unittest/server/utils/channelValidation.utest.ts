import { ChannelTemplateInterface } from "../../../../src/server/types/interfaces/TemplateInterfaceTypes";
import { ChannelTemplateValidator } from "../../../../src/server/utils/channelValidation";
import { BadRequest } from "../../../../src/server/utils/errors/BadRequest";


describe('ChannelTemplateValidator', () => {
  it('should throw BadRequest if neither templateId nor template is provided', () => {
    const channels: ChannelTemplateInterface = {
      channel1: { templateId: undefined, template: undefined },
      channel2: { templateId: undefined, template: {
               "title": "Test Notification {{recipient.name.first}}",
               "actionUrl": "www.google.com",
                 "content": "test"
           } },
      channel3: { templateId: '123', template: undefined },
    };

    expect(() => ChannelTemplateValidator.validateChannelTemplate(channels)).toThrow(BadRequest);
  });

  it('should not throw BadRequest if either templateId or template is provided', () => {
    const channels: ChannelTemplateInterface = {
      channel1: { templateId: '123', template: undefined },
      channel2: { templateId: undefined, template: {
        "title": "Test Notification {{recipient.name.first}}",
        "actionUrl": "www.google.com",
          "content": "test"
    } },
    };

    expect(() => ChannelTemplateValidator.validateChannelTemplate(channels)).not.toThrow(BadRequest);
  });

  it('should throw BadRequest if templateId is empty', () => {
    const channels: ChannelTemplateInterface = {
      channel1: { templateId: "" },
      channel2: {  template: {
               "title": "Test Notification {{recipient.name.first}}",
               "actionUrl": "www.google.com",
                 "content": "test"
           } },
      channel3: { templateId: '123', template: undefined },
    };

    expect(() => ChannelTemplateValidator.validateChannelTemplate(channels)).toThrow(BadRequest);
  });

  it('should throw BadRequest if templateId and template both are present', () => {
    const channels: ChannelTemplateInterface = {
      channel1: { templateId: "" ,template: {
               "title": "Test Notification {{recipient.name.first}}",
               "actionUrl": "www.google.com",
                 "content": "test"
           } },
    };

    expect(() => ChannelTemplateValidator.validateChannelTemplate(channels)).toThrow(BadRequest);
  });

});