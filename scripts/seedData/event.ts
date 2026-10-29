import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { EventInterface } from '../../src/shared-library/models/Event';
import { EventRepository } from '../../src/shared-library/repositories/Event';

export const event: EventInterface = {
  schema_version: EventRepository.SCHEMA_VERSION,
  name: 'On order placed',
  organisationId: '6593a7018ccd1ece6fa712a3',
  templateIds: [],
};
