import { injectable } from 'tsyringe';
import { OrganisationInterface, OrganisationModel } from '../models/Organisation';
import { logger } from '../utils/CommonLogger';

@injectable()
export class OrganisationRepository {
  static readonly SCHEMA_VERSION = 2;

  public async findByID(id: string): Promise<OrganisationInterface | null> {
    return this.upgradeAndSave(await OrganisationModel.findById(id));
  }

  public async create(create: OrganisationInterface): Promise<OrganisationInterface> {
    return await OrganisationModel.create(this.upgrade(create));
  }

  public async findByAPIKey(apiKey: string): Promise<OrganisationInterface | null> {
    logger.info('Find By API Key', apiKey);

    return this.upgradeAndSave(await OrganisationModel.findOne({ api_key: apiKey }));
  }

  async findByName(name: string): Promise<OrganisationInterface | null> {
    return this.upgradeAndSave(await OrganisationModel.findOne({ name: name }));
  }

  async update(organisation: OrganisationInterface): Promise<OrganisationInterface | null> {
    return this.upgradeAndSave(await OrganisationModel.findByIdAndUpdate(organisation._id, organisation));
  }

  private setLatestSchemaVersion(organisation: OrganisationInterface): OrganisationInterface {
    organisation.schema_version = OrganisationRepository.SCHEMA_VERSION;

    return organisation;
  }

  private upgrade(organisation: OrganisationInterface): OrganisationInterface {
    // add upgrade logic

    return this.setLatestSchemaVersion(organisation);
  }

  private async upgradeAndSave(dbObject: any): Promise<OrganisationInterface | null> {
    if (!dbObject) return dbObject;

    const isOlderSchema =
      dbObject.schema_version === undefined ||
      dbObject.schema_version === null ||
      dbObject.schema_version !== OrganisationRepository.SCHEMA_VERSION;

    if (isOlderSchema) {
      dbObject = this.upgrade(dbObject);

      return OrganisationModel.findOneAndUpdate({ _id: dbObject._id }, dbObject, { upsert: true, new: true });
    }

    return dbObject;
  }

  public async migrate() {
    const filter = {
      $or: [{ schema_version: { $exists: false } }, { schema_version: { $ne: OrganisationRepository.SCHEMA_VERSION } }],
    };
    const limit = 100;
    let modifiedCount = 0;
    let organisationsToUpgrade;

    do {
      organisationsToUpgrade = await OrganisationModel.find(filter).limit(limit);

      const upgradedOrganisations: OrganisationInterface[] = [];

      for (const organisationToUpgrade of organisationsToUpgrade) {
        upgradedOrganisations.push(this.upgrade(organisationToUpgrade)!);
        modifiedCount++;
      }

      const bulkOperations = upgradedOrganisations.map((organisation) => ({
        updateOne: {
          filter: { _id: organisation._id },
          update: organisation,
          upsert: true,
        },
      }));
      await OrganisationModel.bulkWrite(bulkOperations);
    } while (organisationsToUpgrade.length !== 0);

    return modifiedCount;
  }
}
