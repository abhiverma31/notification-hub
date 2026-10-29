import { injectable } from 'tsyringe';
import { Types } from 'mongoose';
import { ChannelType } from '../types/Enum/ChannelType';
import {
  EmailTemplateDetails,
  PushTemplateDetails,
  SlackTemplateDetails,
  SmsTemplateDetails,
  TeamsTemplateDetails,
  TelegramTemplateDetails,
  TemplateInterface,
  TemplateModel,
  TemplateQuery,
  onDeckTemplateDetails,
} from '../models/Template';

@injectable()
export class TemplateRepository {
  static readonly SCHEMA_VERSION = 1;

  public async insertTemplate(template: TemplateInterface): Promise<TemplateInterface> {
    return await TemplateModel.create(this.upgrade(template));
  }

  public async findTemplateById(templateId: string, organisationId: string): Promise<TemplateInterface | null> {
    return await this.upgradeAndSave(
      await TemplateModel.findOne({ _id: new Types.ObjectId(templateId), organisationId: organisationId }),
    );
  }

  public async getTemplates(
    query: TemplateQuery,
    offset?: number,
    limit?: number,
    sortBy: string = 'updated_at',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<TemplateInterface[]> {
    // Build sort object dynamically
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    return await TemplateModel.find(query).skip(offset!).limit(limit!).sort(sortObj);
  }
  public async getTemplatesCount(query: TemplateQuery): Promise<number> {
    return await TemplateModel.countDocuments(query);
  }

  public async getTemplateCount(name: string, channelType: ChannelType, organisationId: string): Promise<number> {
    return TemplateModel.countDocuments({ name, channelType, organisationId });
  }

  public async findTemplateByTemplateName(
    name: string,
    channelType: ChannelType,
    organisationId: string,
  ): Promise<TemplateInterface | null> {
    return await this.upgradeAndSave(await TemplateModel.findOne({ name, channelType, organisationId }));
  }

  public async updateTemplate(
    templateId: string,
    updateTemplate:
      | onDeckTemplateDetails
      | PushTemplateDetails
      | EmailTemplateDetails
      | SlackTemplateDetails
      | TeamsTemplateDetails
      | SmsTemplateDetails
      | TelegramTemplateDetails,
    organisationId: string,
    channelType: ChannelType,
  ): Promise<TemplateInterface | null> {
    const now = new Date();
    const filter = { _id: templateId, organisationId: organisationId, channelType: channelType };
    const update = { $set: { templateDetails: updateTemplate, updated_at: now } };
    const updatedTemplate = await TemplateModel.findOneAndUpdate(filter, update, { new: true });

    if (updatedTemplate) {
      const result = await this.upgradeAndSave(updatedTemplate);

      return result;
    } else {
      return null;
    }
  }

  private setLatestSchemaVersion(template: TemplateInterface): TemplateInterface {
    template.schema_version = TemplateRepository.SCHEMA_VERSION;

    return template;
  }

  private upgrade(template: TemplateInterface): TemplateInterface {
    // add upgrade logic

    return this.setLatestSchemaVersion(template);
  }

  private async upgradeAndSave(dbObject: any): Promise<TemplateInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== TemplateRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return TemplateModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: TemplateRepository.SCHEMA_VERSION } }],
    };
    const limit = 100;
    let modifiedCount = 0;
    let templatesToUpgrade;

    do {
      templatesToUpgrade = await TemplateModel.find(filter).limit(limit);

      const upgradedTemplates: TemplateInterface[] = [];

      for (const templateToUpgrade of templatesToUpgrade) {
        upgradedTemplates.push(this.upgrade(templateToUpgrade)!);
        modifiedCount++;
      }

      const bulkOperations = upgradedTemplates.map((template) => ({
        updateOne: {
          filter: { _id: template._id },
          update: template,
          upsert: true,
        },
      }));
      await TemplateModel.bulkWrite(bulkOperations);
    } while (templatesToUpgrade.length !== 0);

    return modifiedCount;
  }
}
