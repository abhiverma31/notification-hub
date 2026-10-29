import 'reflect-metadata';
import { DatabaseConnector } from '../../../../src/shared-library/connectors/DatabaseConnector';
import { container } from 'tsyringe';
import { SeedDataResult, insertSeedData } from '../../../../scripts/seedData/insertSeedData';
import request from 'supertest';
import { OnDeckNotification, OnDeckNotificationModel } from '../../../../src/shared-library/models/OnDeck';
import assert from 'node:assert';
import { logger } from '../../../common/utils/TestLogger';
import { Builder, By, Capabilities } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';

const mailhogBaseUrl = 'http://mailhog:8025';
const appBaseUrl = 'http://localhost:4000';

let seedData: SeedDataResult;
const db = container.resolve(DatabaseConnector);
describe('Notification API', () => {
  beforeAll(async () => {
    await db.connect('Notification E2E Test:BeforeAll');
    seedData = await insertSeedData();
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Notification E2E Test:AfterAll');
  });

  it('should handle POST /api/notification for email', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        email: {
          templateId: seedData.EmailTemplateId,
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test' },
          channels: ['email'],
        },
      ],
      data: {
        name: 'test',
        offerUrl: 'https://google.com/',
      },
    };
    const validPayloadForEmailMailhogSettings = {
      "channelType": "email",
      "provider": "GMAIL",
      "enabled": true,
      "settings": {
        "auth" : {
            "user": "test@technogise.com",
            "pass": "pwd"
        },
        "service": "mailhog", 
        "port": 1025, 
        "host": "mailhog", 
        "secure": false 
      }
    };

    const res = await request(appBaseUrl)
      .post('/api/organisation/settings')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayloadForEmailMailhogSettings)
      .expect(201)
    logger.debug('response for org settings', res);

    const r = await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');

    logger.debug('response', r);

    let attemptCount = 0;
    let responseEmail: any;
    let waitTime = 0;
    while (attemptCount <= 60) {
      const emails = await request(mailhogBaseUrl).get(`/api/v2/messages`);
      responseEmail = JSON.parse(emails.text);

      if(responseEmail.count > 0){
        logger.debug(`Email received after ${waitTime} seconds`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 more secs for the application to complete its flow
        break;
      }

      logger.debug(`Waiting for email: ${waitTime}s`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      waitTime +=2;
      attemptCount++;
    }

    if (responseEmail.count === 0) {
      assert.fail('No emails were received');
    }

    const toEmails = responseEmail.items[0].To.map(
      (to: { Mailbox: string; Domain: string }) => `${to.Mailbox}@${to.Domain}`,
    );
    expect(toEmails).toContain('test@test.com');
    const emailBody = responseEmail.items[0].Content.Body;
    const expectedSubstring = "We're excited to share a special offer with you!";
    expect(emailBody).toContain(expectedSubstring);
  }, 80000);

  it('should handle POST /api/notification for onDeck', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
          template : {
          title: 'test',
          content: 'test content',
          actionUrl: 'https://google.com/',
          }
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');

    let attemptCount = 0;
    let notifications: OnDeckNotification[] | undefined;
    let waitTime = 0;

    while (attemptCount <= 60) {
      notifications = await OnDeckNotificationModel.find({ recipient_id: `${seedData.OrganisationId}::test@test.com` });
      if (notifications.length > 0) {
        logger.debug(`onDeck Notification received after ${waitTime} seconds`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 more secs for the application to complete its flow
        break;
      }

      logger.debug(`Waiting for ondeck notifications: ${waitTime}s`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      waitTime+=2;
      attemptCount++;
    }

    if (notifications === undefined || notifications.length === 0) {
      assert.fail('No on deck notifications were created');
    }

    expect(notifications.length).toBe(1);
    expect(notifications[0].recipient_id).toBe(`${seedData.OrganisationId}::test@test.com`);
  }, 80000);

  it('should handle POST /api/notification for onDeck', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
          templateId: seedData.OnDeckTemplateId,
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
      data: {
        title: 'test',
        content: 'test content',
        actionUrl: 'https://google.com/',
      }
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');

    let attemptCount = 0;
    let notifications: OnDeckNotification[] | undefined;
    let waitTime = 0;

    while (attemptCount <= 60) {
      notifications = await OnDeckNotificationModel.find({ recipient_id: `${seedData.OrganisationId}::test@test.com` });
      if (notifications.length > 0) {
        logger.debug(`onDeck Notification received after ${waitTime} seconds`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 more secs for the application to complete its flow
        break;
      }

      logger.debug(`Waiting for ondeck notifications: ${waitTime}s`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      waitTime+=2;
      attemptCount++;
    }

    if (notifications === undefined || notifications.length === 0) {
      assert.fail('No on deck notifications were created');
    }

    expect(notifications.length).toBe(1);
    expect(notifications[0].recipient_id).toBe(`${seedData.OrganisationId}::test@test.com`);
  }, 80000);

  it('should throw Bad Request on POST /api/notification for onDeck', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
          templateId: '',
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
      data: {
        title: 'test',
        content: 'test content',
        actionUrl: 'https://google.com/',
      },
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(400)
      .expect('Content-Type', 'application/json; charset=utf-8');
   }, 80000);

   it('should throw Bad Request on POST /api/notification for onDeck', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
          templateId: '',
          template: {
            title: 'test',
            content: 'test content',
            actionUrl: 'https://google.com/',
          }
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(400)
      .expect('Content-Type', 'application/json; charset=utf-8');
   }, 80000);

   it('should throw Bad Request on POST /api/notification for onDeck', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
         
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(400)
      .expect('Content-Type', 'application/json; charset=utf-8');
   }, 80000);
   
  it.skip('should connect to web URL using Selenium-webdriver, get FCM token, and send Push notification', async () => {
    // Initialize Selenium WebDriver
    const chromeCapabilities = Capabilities.chrome();
    const chromeOptions = new ChromeOptions();
    chromeOptions.setUserPreferences({
      'profile.default_content_setting_values.notifications': 1,
    });

    const driver = await new Builder()
      .usingServer('http://chromedriver:4444/wd/hub')
      .withCapabilities(chromeCapabilities)
      .setChromeOptions(chromeOptions)
      .build();

    try {
      // Open the React app
      await driver.get('https://aarambh-87cdd.web.app/');

      // Wait for the token to be generated
      let waitCount = 0;
      let tokenText = null;
      while (tokenText === null) {
        try {
          logger.info(`Waiting for fcm token: ${waitCount}s`);
          const tokenElement = await driver.findElement(By.id('token'));
          tokenText = await tokenElement.getText();
        } catch (error) {
          waitCount++;
          await driver.sleep(1000); // Wait for 1 second
          if (waitCount === 5) {
            waitCount = 0;
            logger.debug('Refreshing the page..');
            await driver.navigate().refresh();
            await driver.sleep(2000); // Wait for 5 seconds after refresh
          }
        }
      }
      // Extract the FCM token
      if (tokenText != null) {
        console.log('Token Text:', tokenText);
        // Define the payload for sending notification

        const validPayload = {
          channels: {
            push: {
              templateId: '',
            },
          },
          recipients: [
            {
              email: 'test@test.com',
              name: { first: 'test-Push' },
              fcmToken: tokenText, // Use the obtained FCM token
              channels: ['push'],
            },
          ],
          data: {
            title: 'Test Title',
            body: 'Test Body',
          },
          source: 'push',
        };
        // Send notification
        await request(appBaseUrl)
          .post('/api/notification')
          .set('X-ORG-KEY', seedData.X_ORG_KEY)
          .send(validPayload)
          .expect(202)
          .expect('Content-Type', 'application/json; charset=utf-8');
      }
      let attemptCount = 0;
      let notificationAppeared: boolean = false;

      while (!notificationAppeared && attemptCount <= 40) {
        try {
          const notificationElement = await driver.findElement(By.id('notification'));
          const titleText = await notificationElement.getText();
          console.log('Notification Object:', titleText);

          // Assert that the notification title and body match the expected values
          if (titleText.includes('Test Title')) {
            notificationAppeared = true;
            break;
          }
        } catch (error) {
          // Handle the absence of the element gracefully
          console.log('Notification element not found. Retrying...');
          logger.debug(`Waiting for push notifications: ${attemptCount}s`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attemptCount++;
        }
      }

      if (notificationAppeared) {
        console.log('Notification appeared!');
      } else {
        console.log('No push notifications were created');
      }
      // Assert that the notification appeared
      assert(notificationAppeared, 'Notification did not appear within the expected timeframe');
    } finally {
      // Close the browser
      await driver.quit();
    }
  }, 180000);


  it('should throw Bad Request on POST /api/notification for onDeck when both template and templateid is provided', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        onDeck: {
          templateId: '',
          template: {
            title: 'test',
            content: 'test content',
            actionUrl: 'https://google.com/',
          }
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(400)
      .expect('Content-Type', 'application/json; charset=utf-8');
   }, 80000);

   it('should handle POST /api/notification for push', async () => {
    const validPayload = {
      source: 'server',
      channels: {
        push: {
          template:{
          title: "Test Notification ondeck 182",
          offerUrl: "www.google.com",
          body: "test",
          icon: "https://res.cloudinary.com/dqhzj9nig/image/upload/v1715930967/push_notification_icon_diifqk.png",
          importance: "high",
          sound: "default",
          tag: "webPush_notification_tag",
          channelId:  "fcm_default_channel"
       }
        },
      },
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test-ondeck' },
          channels: ['onDeck'],
        },
      ],
    };

    await request(appBaseUrl)
      .post('/api/notification')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');
   }, 80000);

   it('should handle POST /api/notification/by-event (success)', async () => {
    const validPayload = {
      eventName: 'On order placed',
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test' },
          channels: ['onDeck'],
        },
      ],
      data: {
        name: 'test',
        offerUrl: 'https://google.com/',
      },
    };
    const res = await request(appBaseUrl)
      .post('/api/notification/by-event')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');
    logger.debug('response', res);
    expect(res.body.transactions.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle POST /api/notification/by-event eventId (success)', async () => {
    const validPayload = {
      eventId: seedData.EventId,
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test' },
          channels: ['onDeck'],
        },
      ],
      data: {
        name: 'test',
        offerUrl: 'https://google.com/',
      },
    };
    const res = await request(appBaseUrl)
      .post('/api/notification/by-event')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(validPayload)
      .expect(202)
      .expect('Content-Type', 'application/json; charset=utf-8');
    logger.debug('response', res);
    expect(res.body.transactions.length).toBeGreaterThan(0);
  }, 30000);

  it('should return error for POST /api/notification/by-event with non-existent event', async () => {
    const invalidPayload = {
      eventName: 'NonExistentEvent',
      recipients: [
        {
          email: 'test@test.com',
          name: { first: 'test' },
          channels: ['email'],
        },
      ],
      data: {
        name: 'test',
        offerUrl: 'https://google.com/',
      },
    };
    await request(appBaseUrl)
      .post('/api/notification/by-event')
      .set('X-ORG-KEY', seedData.X_ORG_KEY)
      .send(invalidPayload)
      .expect(404);
  }, 30000);
});
