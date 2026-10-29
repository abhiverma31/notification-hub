
import { UserInterface } from '../../../../src/shared-library/models/User';
import { Recipient } from '../../../../src/shared-library/types/Dto/Recipient';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import adaptToUserInterface from '../../../../src/shared-library/models/adapters/User';

describe('adaptToUserInterface function', () => {
  it('should adapt UserDto to UserInterface correctly', () => {
    // Arrange
    const users: Recipient = { email: 'user1@example.com', name: { first: 'User 1' }, channels: [ChannelType.EMAIL] };

    const organisationId = 'org123';

    // Act
    const adaptedUsers: UserInterface = adaptToUserInterface(users, organisationId);

    // Assert
    expect(adaptedUsers).toMatchObject({
      _id: 'org123::user1@example.com',
      email: 'user1@example.com',
      name: { first: 'User 1' },
    });
  });
});
