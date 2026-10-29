import { UserDto, UserQueueDto } from '../../../shared-library/types/Dto/Notification';
import { ChannelType } from '../../../shared-library/types/Enum/ChannelType';
import { ChannelTemplateInterface } from '../../types/interfaces/TemplateInterfaceTypes';
import { randomUUID } from 'crypto';

export class Recipient {
  public static separateChannelsAndAddUserId(
    recipients: UserDto[],
    channels: ChannelTemplateInterface,
  ): UserQueueDto[] {
    const recipientsList: UserQueueDto[] = [];
    for (const recipient of recipients) {
      const userId = randomUUID();
      for (const channel of recipient.channels) {
        if (Object.keys(channels).includes(channel)) {
          const recipientData: UserQueueDto = {
            userId: userId,
            name: recipient.name,
            email: recipient.email,
            channel,
            ...(channel === ChannelType.PUSH && {
              fcmToken: recipient.fcmToken,
              pushProviders: channels[channel]?.providers,
              pusherChannel: channels[channel]?.pusherChannel,
              pusherEvent: channels[channel]?.pusherEvent,
              beamsInterest: channels[channel]?.beamsInterest,
            }),
            ...((channel === ChannelType.SMS || channel === ChannelType.WHATSAPP) && {
              phone_number: recipient.phone_number,
            }),
            ...(channel === ChannelType.TELEGRAM && { telegramChatId: recipient.telegramChatId }),
          };
          recipientsList.push(recipientData);
        }
      }
    }

    return recipientsList;
  }
}
