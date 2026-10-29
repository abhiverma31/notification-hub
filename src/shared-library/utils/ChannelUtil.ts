import { ChannelTemplateInterface } from '../../server/types/interfaces/TemplateInterfaceTypes';
export function getChannelNames(channels: ChannelTemplateInterface): string[] {
  return Object.keys(channels);
}
