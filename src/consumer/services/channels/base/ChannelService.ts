import { TemplateDetails } from '../../../../shared-library/models/Template';
import { Recipient } from '../../../../shared-library/types/Dto/Recipient';
import UserRepository from '../../../../shared-library/repositories/User';

export abstract class ChannelService {
  public abstract send(
    template: TemplateDetails,
    organisationId: string,
    recipient?: Recipient,
    transactionId?: string,
  ): Promise<void>;

  protected static async getFcmTokensByRecipientAndOrg(
    recipient: Recipient,
    organisationId: string,
    userRepository: UserRepository,
  ): Promise<string[]> {
    let fcmTokens = recipient.fcmToken;
    if (!fcmTokens) {
      const user = await userRepository.findByOrgIdEmailId(organisationId, recipient.email);
      if (!user) {
        throw new Error(`User with email "${recipient.email}" not found in organisation "${organisationId}"`);
      }
      fcmTokens = user.fcm_device_tokens!.map((tokenObj) => tokenObj.token);
    }
    if (!fcmTokens || fcmTokens.length === 0) {
      throw new Error(
        `FCM tokens are empty for user with email "${recipient.email}" in organisation "${organisationId}"`,
      );
    }
    return fcmTokens;
  }
}
