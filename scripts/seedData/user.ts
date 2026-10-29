import { UserInterface } from '../../src/shared-library/models/User';
import { Recipient } from '../../src/shared-library/types/Dto/Recipient';
import adaptToUserInterface from '../../src/shared-library/models/adapters/User';
import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { randomUUID } from 'crypto';

const recipient: Recipient = {
  userId: randomUUID(),
  email: 'test@test.com',
  name: { first: 'First', last: 'Last' },
  channel: ChannelType.ONDECK,
};

export function getSeedUser(organisationId: string): UserInterface {
  return adaptToUserInterface(recipient, organisationId);
}
