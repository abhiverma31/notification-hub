import 'reflect-metadata';
import { Types } from 'mongoose';
import { TemplateRepository } from '../../../../src/shared-library/repositories/Template';
//import { TemplateInterface } from '../../../../src/consumer/types/Interfaces/Template';
import { TemplateInterface, TemplateModel, onDeckTemplateDetails } from '../../../../src/shared-library/models/Template';
import { ChannelType } from '../../../../src/shared-library/types/Enum/ChannelType';

jest.mock('../../../../src/shared-library/models/Template');

describe('TemplateRepository', () => {
  let templateRepository: TemplateRepository;

  beforeEach(() => {
    templateRepository = new TemplateRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should find template by ID', async () => {
    const mockTemplateId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'mockOrganisationId';
    const mockTemplate = { _id: mockTemplateId, organisationId: mockOrganisationId };

    jest.spyOn(TemplateModel, 'findOne').mockResolvedValueOnce(mockTemplate);
    jest.spyOn(TemplateModel, 'findOneAndUpdate').mockResolvedValueOnce(mockTemplate);

    const result = await templateRepository.findTemplateById(mockTemplateId, mockOrganisationId);

    expect(TemplateModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(mockTemplateId),
      organisationId: mockOrganisationId,
    });
    expect(result).toEqual(mockTemplate);
  });

  it('should find template by template name', async () => {
    const mockDefaultTemplateName = 'mockDefaultTemplateName';
    const mockChannelType = ChannelType.EMAIL;
    const mockOrganisationId = 'mockOrganisationId';
    const mockTemplate = {
      name: mockDefaultTemplateName,
      channelType: mockChannelType,
      organisationId: mockOrganisationId,
    } as TemplateInterface;

    jest.spyOn(TemplateModel, 'findOne').mockResolvedValueOnce(mockTemplate);
    jest.spyOn(TemplateModel, 'findOneAndUpdate').mockResolvedValueOnce(mockTemplate);

    const result = await templateRepository.findTemplateByTemplateName(
      mockDefaultTemplateName,
      mockChannelType,
      mockOrganisationId,
    );

    expect(TemplateModel.findOne).toHaveBeenCalledWith({
      name: mockDefaultTemplateName,
      channelType: mockChannelType,
      organisationId: mockOrganisationId,
    });
    expect(result).toEqual(mockTemplate);
  });

  it('should update the template for any channel (eg Ondeck in this test)', async () => {
    const mockTemplateId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'mockOrganisationId';
    const mockDate = new Date('2024-07-15T10:08:02.011Z');
    const mockTemplate = {
      _id: mockTemplateId,
      schema_version: 1,
      name: 'On deck Template',
      channelType: 'onDeck',
      organisationId: mockOrganisationId,
      templateDetails: {
          title: 'on deck temp 1 updated',
          content: 'content updated',
          actionUrl: 'www.google.com'
      },
      updated_at: mockDate
  };
 
  const originalDate = global.Date;
  global.Date = jest.fn(() => mockDate) as any;
  global.Date.now = originalDate.now;

  jest.spyOn(TemplateModel, 'findOneAndUpdate').mockResolvedValue(mockTemplate as any);

  const result = await templateRepository.updateTemplate(
      mockTemplateId,
      {
          title: 'on deck temp 1 updated',
          content: 'content updated',
          actionUrl: 'www.google.com'
      },
      mockOrganisationId,
      'onDeck' as ChannelType
  );

  expect(TemplateModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockTemplateId, organisationId: mockOrganisationId, channelType: 'onDeck' },
      { $set: { templateDetails: { title: 'on deck temp 1 updated', content: 'content updated', actionUrl: 'www.google.com' }, updated_at: mockDate } },
      { new: true}
  );
  expect(result).toEqual(mockTemplate);
  global.Date = originalDate;
  });

  it('should return null if template does not exist', async () => {
    const mockTemplateId = '65816f6d40cb6e53c6656fa0';
    const mockOrganisationId = 'mockOrganisationId';
    const updateTemplateDetails: onDeckTemplateDetails = {
      title: 'Test Title',
      content: 'Test Content',
      actionUrl: 'https://test.url',
    };
  
    const mockDate = new Date('2024-07-15T10:08:02.011Z');
  
    // Mock Date object
    const originalDate = global.Date;
    global.Date = jest.fn(() => mockDate) as any;
    global.Date.now = originalDate.now;
  
    jest.spyOn(TemplateModel, 'findOneAndUpdate').mockResolvedValueOnce(null);
  
    const result = await templateRepository.updateTemplate(
      mockTemplateId,
      updateTemplateDetails,
      mockOrganisationId,
      ChannelType.ONDECK,
    );
  
    expect(TemplateModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mockTemplateId, organisationId: mockOrganisationId, channelType: 'onDeck' },
      { $set: { templateDetails: { title: 'Test Title', content: 'Test Content', actionUrl: 'https://test.url' }, updated_at: mockDate } },
      { new: true }
    );
  
    expect(result).toBeNull();
  
    // Restore the original Date implementation
    global.Date = originalDate;
  });
  

});
