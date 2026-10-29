import 'reflect-metadata';
import UserRepository from '../src/shared-library/repositories/User';
import { logger } from './utils/ScriptLogger';
import { TemplateRepository } from '../src/shared-library/repositories/Template';
import { OrganisationRepository } from '../src/shared-library/repositories/Organisation';
import { DeliveryReportRepository } from '../src/shared-library/repositories/DeliveryReport';
import { OnDeckRepository } from '../src/shared-library/repositories/OnDeck';
import { OnDeckConnectionRepository } from '../src/shared-library/repositories/OnDeckConnection';
import mongoose, { ConnectOptions } from 'mongoose';
import { MemberRepository } from '../src/shared-library/repositories/Member';

async function migrateUsers() {
  logger.traceStart(null, 'Migrating Users');
  const userRepository = new UserRepository();
  const migratedCount = await userRepository.migrate();
  logger.traceEnd(null, 'Migrating Users', { migratedCount });
}

async function migrateMembers() {
  logger.traceStart(null, 'Migrating Members');
  const memberRepository = new MemberRepository();
  const migratedCount = await memberRepository.migrate();
  logger.traceEnd(null, 'Migrating Members', { migratedCount });
}

async function migrateTemplates() {
  logger.traceStart(null, 'Migrating Templates');
  const templateRepository = new TemplateRepository();
  const migratedCount = await templateRepository.migrate();
  logger.traceEnd(null, 'Migrating Templates', { migratedCount });
}

async function migrateOrganisations() {
  logger.traceStart(null, 'Migrating Organisations');
  const organisationRepository = new OrganisationRepository();
  const migratedCount = await organisationRepository.migrate();
  logger.traceEnd(null, 'Migrating Organisations', { migratedCount });
}

async function migrateDeliveryReports() {
  logger.traceStart(null, 'Migrating DeliveryReports');
  const deliveryReportRepository = new DeliveryReportRepository();
  const migratedCount = await deliveryReportRepository.migrate();
  logger.traceEnd(null, 'Migrating DeliveryReports', { migratedCount });
}

async function migrateOnDeckNotifications() {
  logger.traceStart(null, 'Migrating OnDeckNotifications');
  const onDeckRepository = new OnDeckRepository();
  const migratedCount = await onDeckRepository.migrate();
  logger.traceEnd(null, 'Migrating OnDeckNotifications', { migratedCount });
}

async function migrateOnDeckConnections() {
  logger.traceStart(null, 'Migrating OnDeckConnections');
  console.log("Migrating OnDeckConnections");
  const onDeckConnectionRepository = new OnDeckConnectionRepository();
  const migratedCount = await onDeckConnectionRepository.migrate();
  logger.traceEnd(null, 'Migrating OnDeckConnections', { migratedCount });
  console.log("Migrating OnDeckConnections", migratedCount);
}

function getMongoString(environment: string) {
  if (environment === 'staging') {
    return process.env.staging_MONGO_CONNECTION_URL!;
  } else if (environment === 'prod') {
    return process.env.prod_MONGO_CONNECTION_URL!;
  }

  return undefined;
}

(async () => {
  const environment = process.argv[2];
  const dbName: string = environment ? environment : 'local';
  const mongoString: string = getMongoString(environment) ? getMongoString(environment)! : 'mongodb://127.0.0.1:27018';

  try {
    const options: ConnectOptions = {
      dbName: `notification-${dbName}`,
    };
    await mongoose.connect(mongoString, options);

    await migrateUsers();
    await migrateMembers();
    await migrateTemplates();
    await migrateOrganisations();
    await migrateDeliveryReports();
    await migrateOnDeckNotifications();
    await migrateOnDeckConnections();
  } finally {
    await mongoose.disconnect();
  }
})();
