import 'reflect-metadata';
import { container } from 'tsyringe';
import { encodeToBase64, generateApiKeyWithSecret, generateHMAC } from '../../src/server/utils/KeyTools';
import { OrganisationRepository } from '../../src/shared-library/repositories/Organisation';
import { OrganisationModel } from '../../src/shared-library/models/Organisation';
import { TemplateRepository } from '../../src/shared-library/repositories/Template';
import { OnDeckConnectionRepository } from '../../src/shared-library/repositories/OnDeckConnection';
import { emailTemplate } from './emailTemplate';
import { pushTemplate } from './pushTemplate';
import { onDeckTemplate } from './onDeckTemplate';
import { event as eventData } from './event';
import * as dotenv from 'dotenv';
import { logger } from '../utils/ScriptLogger';
import { getSeedOrganisation } from './organisation';
import { getSeedUser } from './user';
import UserRepository from '../../src/shared-library/repositories/User';
import { OrganisationInterface } from '../../src/shared-library/models/Organisation';
import { ApiKey } from '../../src/server/types/internal/ApiKey';
import { EventRepository } from '../../src/shared-library/repositories/Event';
import { MemberRepository } from '../../src/shared-library/repositories/Member';
import { ChannelType } from '../../src/shared-library/types/Enum/ChannelType';
import { TemplateInterface } from '../../src/shared-library/models/Template';
dotenv.config();

export interface SeedDataResult {
  EmailTemplateId: string;
  PushTemplateId: string;
  OnDeckTemplateId: string;
  X_ORG_KEY: string;
  X_ORG_LP_KEY: string;
  OrganisationId: string;
  UserId: string;
  UserEmail: string;
  X_ORG_USER_KEY: string;
  EventId: string;
}

async function insertDataForUIFlow() {
  const organisationData = {
    "schema_version": 1,
    "name": "Technogise",
    "api_key": "ogw4EjyjuQLfSiQubkchea",
    "api_secret_hash": "b66417b698ad0676be3ac621d64b59c6af6e6269e952b2b57380efba943f4c05",
    "x_org_key": "b2d3NEVqeWp1UUxmU2lRdWJrY2hlYSxEd2l6d0VNMjhEa0hFYmpLakR5TWhmSE5zRlNIamk2NWpMcW5vSHpIQXRObw==",
    "is_archived": false,
    "settings": {
      "email": [],
      "push": [],
      "slack": [],
      "sms": [],
      "whatsapp": [],
      "teams": [],
      "telegram": []
    }
  };

  const organisationRepository = container.resolve(OrganisationRepository);
  const organisation = await organisationRepository.create(organisationData);

  const members = [{
    "_id": "c09cccb6-9e47-4ca0-995a-445efd9a0593",
    "schema_version": 1,
    "email": "satyam@technogise.com",
    "organisation_id": [
      organisation._id?.toString()
    ],
    "name": {
      "first": "Satyam",
      "last": "Saxena"
    }
  }]; // add your email to login and use the seeded data for UI flow

  const memberRepository = container.resolve(MemberRepository);
  for (const member of members) {
    await memberRepository.addMember(member);
  }

  const templates = [{
    "schema_version": 1,
    "name": "Request Document",
    "channelType": ChannelType.ONDECK,
    "organisationId": organisation._id?.toString()!,
    "templateDetails": {
      "title": "Request a document from user",
      "content": "This template is designed to request document from user",
      "actionUrl": ""
    }
  }, {
    "schema_version": 1,
    "name": "Form Share On Deck",
    "channelType": ChannelType.ONDECK,
    "organisationId": organisation._id?.toString()!,
    "templateDetails": {
      "title": "Form Share template",
      "content": "",
      "actionUrl": ""
    }
  }];

  const savedTemplates: TemplateInterface[] = [];
  const templateRepository = container.resolve(TemplateRepository);
  for (const template of templates) {
    const savedTemplate = await templateRepository.insertTemplate(template);
    savedTemplates.push(savedTemplate);
  }

  const events = [{
    "schema_version": 1,
    "name": "On order placed",
    "organisationId": organisation._id?.toString()!,
    "templateIds": [savedTemplates[0]._id!, savedTemplates[1]._id!]
  }]

  const eventRepository = container.resolve(EventRepository);
  for (const event of events) {
    await eventRepository.insertEvent(event);
  }
}

async function insertSeedOrganisation(apiKey: ApiKey, result: SeedDataResult) {
  result.X_ORG_KEY = encodeToBase64(`${apiKey.key},${apiKey?.secret}`);
  const insertOrgModel = getSeedOrganisation(apiKey, result.X_ORG_KEY);
  const organisationRepository = container.resolve(OrganisationRepository);
  const organisation = await organisationRepository.create(insertOrgModel);

  result.OrganisationId = organisation._id!;
  result.X_ORG_LP_KEY = apiKey.key;

  return organisation;
}

async function insertSeedUser(result: SeedDataResult, apiKey: ApiKey) {
  const insertUserModel = getSeedUser(result.OrganisationId);

  const userRepository = container.resolve(UserRepository);
  const user = (await userRepository.upsert(insertUserModel))!;

  const hmac = generateHMAC(user.email, apiKey.secret_hash);
  const userKey = encodeToBase64(`${user.email},${apiKey.key},${hmac}`);
  result.UserId = user._id!;
  result.UserEmail = user.email;
  result.X_ORG_USER_KEY = userKey;
}

async function insertSeedTemplates(organisation: OrganisationInterface, result: SeedDataResult) {
  const templateRepository = container.resolve(TemplateRepository);
  const email = await templateRepository.insertTemplate({
    ...emailTemplate,
    organisationId: organisation._id!,
  });
  result.EmailTemplateId = email._id!;

  const push = await templateRepository.insertTemplate({
    ...pushTemplate,
    organisationId: organisation._id!,
  });
  result.PushTemplateId = push._id!;

  const onDeck = await templateRepository.insertTemplate({
    ...onDeckTemplate,
    organisationId: organisation._id!,
  });
  result.OnDeckTemplateId = onDeck._id!;
}

async function insertEvent(result: SeedDataResult) {
  const eventRepository = container.resolve(EventRepository);
  const event = await eventRepository.insertEvent({
    ...eventData,
    organisationId: result.OrganisationId,
    templateIds: [result.EmailTemplateId, result.PushTemplateId, result.OnDeckTemplateId],
  });
  result.EventId = event._id!;
}

export const insertSeedData = async () => {
  // Skip seeding if data already exists
  const organisationRepository = container.resolve(OrganisationRepository);
  const existing = await OrganisationModel.findOne({ name: 'testOrg' });
  if (existing) {
    logger.info('Seed data already exists, skipping insertion.');
    return;
  }
  const result: SeedDataResult = {
    EmailTemplateId: '',
    PushTemplateId: '',
    OnDeckTemplateId: '',
    OrganisationId: '',
    UserId: '',
    UserEmail: '',
    X_ORG_KEY: '',
    X_ORG_LP_KEY: '',
    X_ORG_USER_KEY: '',
    EventId: '',
  };

  const apiKey = generateApiKeyWithSecret();

  // Ensure OnDeckConnection collection exists
  const onDeckConnectionRepository = container.resolve(OnDeckConnectionRepository);

  const organisation = await insertSeedOrganisation(apiKey, result);
  await insertSeedUser(result, apiKey);
  await insertSeedTemplates(organisation, result);
  await insertEvent(result);

  await insertDataForUIFlow();

  logger.debug('Seed Data', result);

  return result;
};
