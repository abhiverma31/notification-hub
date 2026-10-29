import dotenv from 'dotenv';
import { server } from './Server';
import { logger } from './utils/ServerLogger';

dotenv.config();

const port = process.env.SERVER_PORT || 4000;

server.app.listen(port, () => {
  logger.info(`Listening: http://localhost:${port}`);
});
