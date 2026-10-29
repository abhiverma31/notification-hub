import { UserDto } from '../../../shared-library/types/Dto/Notification';
import { ChannelTemplateInterface, Data } from '../interfaces/TemplateInterfaceTypes';

/**
 * 
 * for sending notification, channel block of the request should contain templateId or template irrespective of the channel.
 * 
 * @example
{
  "recipients": [
    {
      "email": "john@technogise.com",
      "name": {
        "first": "john",
        "last": "Doe"
      },
      "fcmToken": "eSiDj3WH6T3pND7CTf2zqc:APA91bFzuK_3l0zLBJ-0r8KUncXh9B9CFUQ6GvWC4XF-LUo_0ARvmbnkimjH37J_RHhBv3Yjt1lNOuj-28jEQeMWdvQP3Vj6MM5PPTvKUtPdK9JIpXVzFB0aCDs-APyP5of1iQplkSGO",
      "channels": [
        "email",
        "push",
        "onDeck"
      ]
    }
  ],
  "channels": {
    "email": {
      "templateId": "65b9e39bed0fbe51b7894aeb"
    },
    "push": {
      "templateId": "65b9e39bed0fbe51b7894aec"
    },
    "onDeck": {
         "template": {
                   "title": "Test Notification {{recipient.name.first}}",
                   "actionUrl": "www.google.com",
                    "content": "test"
               }
    }
  },
  "data": {
    "title": "test title",
    "content": "test content",
    "offerUrl": "https://google.com/"
  }
}
*/
export interface SendNotificationRequest {
  source?: string;
  recipients?: UserDto[];
  channels: ChannelTemplateInterface;
  data?: Data;
}

export interface SendNotificationByEventRequest {
  source?: string;
  recipients?: UserDto[];
  eventName?: string;
  eventId?: string;
  data?: Data;
  channels?: ChannelTemplateInterface;
}
