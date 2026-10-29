import adaptToNotificationInterface from '../../../../src/shared-library/models/adapters/Notification';
import { OnDeckNotification } from '../../../../src/shared-library/models/OnDeck';


describe('adaptToNotificationInterface function', () => {
  it('should adapt recipient data to NotificationInterface', () => {
    // Sample input data
    const title = 'Test Title';
    const content = 'Test Content';
    const actionUrl = 'Test URL';

    const recipient = { email: 'recipient1@example.com', name: 'Recipient One' };
    const source = 'Web_App';
    const organisationId = 'yourorganisationId';

    // Expected output based on the provided sample input
    const expectedNotifications: OnDeckNotification = {
      content: 'Test Content',
      recipient_id: 'yourorganisationId::recipient1@example.com',
      title: 'Test Title',
      actionUrl: 'Test URL',
      source_creation_timestamp: expect.any(Date),
    };

    // Call the function with the provided sample input
    const result = adaptToNotificationInterface(title, content, actionUrl, recipient as any, organisationId, source);

    // Perform assertions
    expect(result).toEqual(expectedNotifications); // Check if the output matches the expected result
  });
});
