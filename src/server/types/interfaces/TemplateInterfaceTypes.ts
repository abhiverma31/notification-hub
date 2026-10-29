import { TemplateInterface } from '../../../shared-library/models/Template';
import { PushProviders } from '../Enum/PushProviders';

export type Data = {
  [key: string]: string;
};
export interface TemplateOptions {
  templateId?: string;
  template?: TemplateDetailsInterface;
  providers?: PushProviders[];
  pusherChannel?: string[];
  pusherEvent?: string;
  beamsInterest?: string[];
}

export interface ChannelTemplateInterface {
  [key: string]: TemplateOptions;
}

export interface TemplateDetailsInterface {
  [key: string]: any;
}

export interface TemplateHydrationServiceType {
  hydrate: (template: TemplateInterface, data: Data) => Promise<TemplateDetailsInterface>;
}
