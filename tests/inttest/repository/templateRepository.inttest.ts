import 'reflect-metadata';
import 'dotenv/config';
import { ChannelType } from '../../../src/shared-library/types/Enum/ChannelType';
import { EmailTemplateDetails, TemplateInterface } from '../../../src/shared-library/models/Template';
import { TemplateRepository } from '../../../src/shared-library/repositories/Template';
import { DatabaseConnector } from '../../../src/shared-library/connectors/DatabaseConnector';

const templateRepository = new TemplateRepository();
const db = new DatabaseConnector();

describe('Template Repository', () => {
  beforeAll(async () => {
    await db.connect('Server');
  });

  afterAll(async () => {
    await db.clearTestDatabase();
    await db.disconnect('Test');
  });

  it('Should insert a template into the database', async () => {
    const emailDetails: EmailTemplateDetails = {
      body: 'Hello',
      subject: 'Test Email',
    } as unknown as EmailTemplateDetails;
    // Arrange
    const template: TemplateInterface = {
      name: 'Sample Template',
      channelType: ChannelType.EMAIL,
      organisationId: 'dummy id',
      templateDetails: emailDetails,
    };

    // Act
    const insertedTemplate = await templateRepository.insertTemplate(template);

    // Assert
    expect(insertedTemplate).toBeDefined();
    expect(insertedTemplate!.name).toBe(template.name);
    expect(insertedTemplate!.channelType).toBe(template.channelType);
    expect(insertedTemplate!.organisationId).toBe(template.organisationId);
    expect(insertedTemplate!.templateDetails).toEqual(template.templateDetails);
  });

  it('should find a template by template ID and organisation ID', async () => {
    const emailDetails: EmailTemplateDetails = {
      body: 'Welcome',
      subject: 'Greetings',
    } as unknown as EmailTemplateDetails;

    const template: TemplateInterface = {
      name: 'Email Template',
      channelType: ChannelType.EMAIL,
      organisationId: 'TG001',
      templateDetails: emailDetails,
    };
    const insertedTemplate = await templateRepository.insertTemplate(template);
    const foundTemplate = await templateRepository.findTemplateById(
      insertedTemplate._id as string,
      template.organisationId,
    );
    expect(foundTemplate).toBeDefined();
    expect(foundTemplate!.organisationId).toBe(template.organisationId);
    expect(foundTemplate!.channelType).toBe(template.channelType);
    expect(foundTemplate!.name).toBe(template.name);
    expect(foundTemplate!.templateDetails.body).toBe(template.templateDetails.body);
    expect(foundTemplate!.templateDetails.subject).toBe(template.templateDetails.subject);
  });
});
