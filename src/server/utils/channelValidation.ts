import { ChannelTemplateInterface } from '../types/interfaces/TemplateInterfaceTypes';
import { BadRequest } from './errors/BadRequest';

export class ChannelTemplateValidator {
  static validateChannelTemplate(channels: ChannelTemplateInterface): void {
    const errors: string[] = Object.keys(channels).flatMap((key) => {
      const channel = channels[key];
      if (channel.templateId === undefined && channel.template === undefined) {
        return [`Channel '${key}' must have either a templateId or a template.`];
      }
      if (channel.templateId !== undefined && channel.template !== undefined) {
        return [`Channel '${key}' cannot have both a templateId and a template.`];
      }
      if (channel.templateId === '') {
        return [`templateId for Channel '${key}' must not be empty.`];
      }

      return [];
    });
    if (errors.length > 0) {
      throw new BadRequest(errors.join('\n'));
    }
  }
}
