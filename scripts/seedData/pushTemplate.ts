import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { TemplateInterface } from '../../src/shared-library/models/Template';
import { TemplateRepository } from '../../src/shared-library/repositories/Template';

export const pushTemplate: TemplateInterface = {
  schema_version: TemplateRepository.SCHEMA_VERSION,
  name: 'Promotional Push Template Test',
  channelType: ChannelType.PUSH,
  organisationId: '6593a7018ccd1ece6fa712a3',
  templateDetails: {
    title: 'Special Offer - {{recipient.name.first}}',
    body: "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}",
  },
};
