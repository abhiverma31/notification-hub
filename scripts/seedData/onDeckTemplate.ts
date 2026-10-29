import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { TemplateInterface } from '../../src/shared-library/models/Template';
import { TemplateRepository } from '../../src/shared-library/repositories/Template';

export const onDeckTemplate: TemplateInterface = {
  schema_version: TemplateRepository.SCHEMA_VERSION,
  name: 'Promotional ondeck Template Test',
  channelType: ChannelType.ONDECK,
  organisationId: '6593a7018ccd1ece6fa712a3',
  templateDetails: {
    title: '{{data.title}}',
    content: '{{data.content}}',
    actionUrl: '{{data.actionUrl}}',
  },
};
