import 'reflect-metadata';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';
import { TemplateRepository } from '../../../../src/shared-library/repositories/Template';
import { TemplateService } from '../../../../src/consumer/services/Template';

jest.mock('../../../../src/shared-library/repositories/Template', () => ({
  findTemplateById: jest.fn().mockResolvedValue({
    MessageId: 'mocked-message-id',
  }),
}));

const mockTemplate = {
  _id: "new ObjectId('65816f6d40cb6e53c6656fa0')",
  name: 'Test Email with Image 3',
  channelType: ChannelType.EMAIL,
  organisationId: '6572cb0426dee1ff0b2d4df9',
  templateDetails: {
    subject: 'Special Offer - {{USERNAME}}',
    body: "<table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%'><tr><td style='padding: 20px 0; text-align: center;'><img src='sample_url' alt='Special Offer Banner' style='width: 100%; max-width: 600px;'></td></tr><tr><td><p>Hello {{USERNAME}},</p><p>Don't miss our special offer!</p><p>Click the link below to explore:</p><p><a href='{{OFFER_URL}}'>Claim Your Offer</a></p><p>Thank you for choosing us!</p></td></tr></table>",
  },
  placeholders: ['USERNAME', 'OFFER_URL'],
  __v: 0,
};

class MockTemplateRepository {
  public async findTemplateById(templateId: string, organisationId: string) {
    return Promise.resolve(templateId && organisationId ? mockTemplate : null);
  }
}

describe('TemplateService', () => {
  let templateService: TemplateService;
  let mockTemplateRepository: MockTemplateRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTemplateRepository = new MockTemplateRepository();
    templateService = new TemplateService(mockTemplateRepository as unknown as TemplateRepository);
  });

  describe('getTemplate', () => {
    it('should be able to get template', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const findTemplateByIdSpy = jest.spyOn(mockTemplateRepository, 'findTemplateById');

      await templateService.getTemplate(templateId, organisationId);
      expect(findTemplateByIdSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw error when templateId is not passed', async () => {
      const organisationId = 'organisation123';
      const templateId = '';

      try {
        await templateService.getTemplate(templateId, organisationId);
      } catch (error) {
        expect(error).toEqual(new Error('No Matching Template Found'));
      }
    });

    it('should throw error when organisationId is not passed', async () => {
      const organisationId = '';
      const templateId = 'template123';

      try {
        await templateService.getTemplate(templateId, organisationId);
      } catch (error) {
        expect(error).toEqual(new Error('No Matching Template Found'));
      }
    });

    it('should call repository with correct parameters', async () => {
      const organisationId = 'organisation123';
      const templateId = 'template123';
      const findTemplateByIdSpy = jest.spyOn(mockTemplateRepository, 'findTemplateById');

      await templateService.getTemplate(templateId, organisationId);
      
      expect(findTemplateByIdSpy).toHaveBeenCalledWith(templateId, organisationId);
    });
  });
});
