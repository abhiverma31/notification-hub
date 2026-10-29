import 'reflect-metadata';
import express, { Express, Request, Response } from 'express';
import ServerlessHttp from 'serverless-http';
import { DatabaseConnector } from '../shared-library/connectors/DatabaseConnector';
import { container, inject, injectable } from 'tsyringe';
import { HttpStatusCode } from './types/Enum/HttpStatusCode';
import CorsOptions from './utils/CorsOptions';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import errorHandler from './middlewares/ErrorHandler';
import { RegisterRoutes } from './routes/Routes';
import { getFileUrl } from './utils/s3Client';

const WEBHOOK_RATE_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests' },
  skip: () => process.env.NODE_ENV === 'test',
});

import { twilioWebhookAuth, twilioSmsWebhookAuth } from './middlewares/TwilioWebhookAuth';
import { TwilioWebhookController } from './controllers/TwilioWebhook';

@injectable()
class Server {
  public app: Express;
  private serverInstance: any;
  constructor(@inject(DatabaseConnector) private databaseConnector: DatabaseConnector) {
    this.app = express();
    this.bootstrapApp();
    this.initRouter();
    this.setupSignalListeners();
    this.setupGlobalErrorHandler();
  }

  private bootstrapApp() {
    this.app.set('trust proxy', 1);
    this.app.disable('x-powered-by');
    this.app.use(cors(CorsOptions));
    this.app.use(
      '/api/webhooks/sendgrid',
      express.json({
        limit: '1mb',
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString();
        },
      }),
    );
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    (async () => {
      await this.databaseConnector.connect('Server');
    })();
  }

  private initRouter() {
    this.app.use('/api/webhooks/sendgrid', WEBHOOK_RATE_LIMIT);
    RegisterRoutes(this.app);

    this.app.get('/test', (req: Request, res: Response) => {
      res.json({ message: 'CORS test endpoint' });
    });

    this.app.get('/api-docs', async (req, res) => {
      const fileKey = 'api-docs/notification_hub_api.html';
      const fileUrl = await getFileUrl(fileKey);
      res.redirect(fileUrl);
    });

    const twilioWebhookController = container.resolve(TwilioWebhookController);
    this.app.post('/api/webhooks/twilio/whatsapp', twilioWebhookAuth, (req, res) =>
      twilioWebhookController.handleWhatsAppStatus(req, res),
    );
    this.app.post('/api/webhooks/twilio/sms', twilioSmsWebhookAuth, (req, res) =>
      twilioWebhookController.handleSmsStatus(req, res),
    );

    this.app.use((_req: Request, res: Response) => {
      res.status(HttpStatusCode.NOT_FOUND).send();
    });
  }

  private setupGlobalErrorHandler() {
    this.app.use(errorHandler);
  }

  private setupSignalListeners() {
    process.on('beforeExit', () => {
      this.databaseConnector.disconnect('Server').then(() => process.exit());
    });
  }
  public close() {
    if (this.serverInstance) {
      this.serverInstance.close();
    }
  }
}

export const server = container.resolve(Server);

export const handler = ServerlessHttp(server.app);
