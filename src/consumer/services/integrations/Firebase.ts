import * as admin from 'firebase-admin';
import { MulticastMessage, WebpushNotification } from 'firebase-admin/lib/messaging/messaging-api';
import { injectable } from 'tsyringe';
import { PushNotificationTargetInfo, dataOption } from '../../types/Interfaces/PushQueueMessage';
import { logger } from '../../utils/ConsumerLogger';
import { PriorityEnum } from '../../types/Enum/PriorityEnum';
import { isValidPriorityEnum } from '../../utils/ValidatePriorityEnum';

@injectable()
export class FirebaseIntegration {
  public async sendPushNotificationsViaFirebase(
    firbaseApp: admin.app.App,
    notificationTragetInfo: PushNotificationTargetInfo,
    notificationContent: WebpushNotification,
    notificationData: dataOption,
    apnsData: dataOption,
  ) {
    logger.traceStart({ notificationTragetInfo }, '> firebaseIntegration > Sending Push Notification');
    const message: MulticastMessage = {
      tokens: notificationTragetInfo.token,
      webpush: {
        notification: notificationContent,
        data: notificationData,
      },
      android: {
        notification: {
          title: notificationContent.title,
          body: notificationContent.body,
          icon: notificationContent.icon,
          sound: notificationData.sound,
          tag: notificationData.tag,
          channelId: notificationData.channelId,
          clickAction: notificationData.url,
        },
        ttl: parseInt(notificationData.ttl),
        priority: isValidPriorityEnum(notificationData.importance)
          ? (notificationData.importance as PriorityEnum)
          : PriorityEnum.NORMAL,
      },
      apns: {
        headers: {
          'apns-priority': apnsData.apnsPriority,
          tag: notificationData.tag,
        },
        payload: {
          aps: {
            alert: {
              title: notificationContent.title,
              body: notificationContent.body,
            },
            sound: notificationData.sound,
            icon: notificationContent.icon,
          },
        },
      },
    };
    const response = await firbaseApp.messaging().sendEachForMulticast(message);
    firbaseApp.delete();
    logger.traceEnd({ notificationTragetInfo }, '> firebaseIntegration > Sending Push Notification');

    return response;
  }
}
