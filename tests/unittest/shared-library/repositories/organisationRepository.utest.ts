import 'reflect-metadata';
import { OrganisationRepository } from '../../../../src/shared-library/repositories/Organisation';
import { OrganisationInterface, OrganisationModel } from '../../../../src/shared-library/models/Organisation';

describe('OrganisationRepository', () => {
  let organisationRepository: OrganisationRepository;

  beforeEach(() => {
    organisationRepository = new OrganisationRepository();
  });

  describe('getOrganisationById', () => {
    it('should return the organization when found', async () => {
      const mockOrganisation = {
        _id: 'mocked-id',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-api-secret-hash',
      };
      jest.spyOn(OrganisationModel, 'findById').mockResolvedValue(mockOrganisation);
      jest.spyOn(OrganisationModel, 'findOneAndUpdate').mockResolvedValue(mockOrganisation);

      const result = await organisationRepository.findByID('1');
      expect(result).toEqual(mockOrganisation);
    });

    it('should return null when organization is not found', async () => {
      jest.spyOn(OrganisationModel, 'findById').mockResolvedValue(null);

      const result = await organisationRepository.findByID('2');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return the new organization', async () => {
      const newOrganisation: OrganisationInterface = {
        _id: 'mocked-id',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-api-secret-hash',
      };
      jest.spyOn(OrganisationModel, 'create').mockResolvedValue(newOrganisation);

      const result = await organisationRepository.create(newOrganisation);
      expect(result).toEqual(newOrganisation);
    });
  });

  describe('findByAPIKey', () => {
    it('should return the organization when found', async () => {
      const mockOrganisation = {
        _id: 'mocked-id',
        name: 'Test Organisation',
        api_key: 'mocked-api-key',
        api_secret_hash: 'mocked-api-secret-hash',
      };
      jest.spyOn(OrganisationModel, 'findOne').mockResolvedValue(mockOrganisation);
      jest.spyOn(OrganisationModel, 'findOneAndUpdate').mockResolvedValue(mockOrganisation);

      const result = await organisationRepository.findByAPIKey('apiKey');
      expect(result).toEqual(mockOrganisation);
    });

    it('should return null when organization is not found', async () => {
      jest.spyOn(OrganisationModel, 'findOne').mockResolvedValue(null);

      const result = await organisationRepository.findByAPIKey('apiKey2');
      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return the organization when found', async () => {
      const mockOrganisation = { id: '3', name: 'TestOrg' };
      jest.spyOn(OrganisationModel, 'findOne').mockResolvedValue(mockOrganisation);
      jest.spyOn(OrganisationModel, 'findOneAndUpdate').mockResolvedValue(mockOrganisation);

      const result = await organisationRepository.findByName('TestOrg');
      expect(result).toEqual(mockOrganisation);
    });

    it('should return null when organization is not found', async () => {
      jest.spyOn(OrganisationModel, 'findOne').mockResolvedValue(null);

      const result = await organisationRepository.findByName('NonExistingOrg');
      expect(result).toBeNull();
    });
  });
});
