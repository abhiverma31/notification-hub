import 'reflect-metadata';
import { MemberRepository } from '../../../../src/shared-library/repositories/Member';
import { AddMemberInterface, MemberInterface, MemberModel } from '../../../../src/shared-library/models/Member';

describe('MemberRepository', () => {
  let memberRepository: MemberRepository;

  beforeEach(() => {
    memberRepository = new MemberRepository();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findMemberByEmailId', () => {
    it('should return the member when found', async () => {
      const mockMember: MemberInterface = {
        _id: 'mocked-id',
        email: 'test@example.com',
        organisation_id: [],
        schema_version: 1,
      };

      jest.spyOn(MemberModel, 'findOne').mockResolvedValueOnce(mockMember as any);

      const result = await memberRepository.findMemberByEmailId('test@example.com');

      expect(result).toEqual(mockMember);
      expect(MemberModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return null when member is not found', async () => {
      jest.spyOn(MemberModel, 'findOne').mockResolvedValueOnce(null);

      const result = await memberRepository.findMemberByEmailId('nonexistent@example.com');

      expect(result).toBeNull();
      expect(MemberModel.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
    });
  });

  describe('addMember', () => {
    it('should add and return the new member', async () => {
      const mockMember: AddMemberInterface = {
        _id: 'mocked-id',
        email: 'newuser@example.com',
        name: {
          first: 'first',
          last: 'last',
        },
      };

      jest.spyOn(MemberModel, 'create').mockResolvedValueOnce(mockMember as any);

      const result = await memberRepository.addMember(mockMember);

      expect(result).toEqual(mockMember);
      expect(MemberModel.create).toHaveBeenCalledWith(mockMember);
    });
  });

  describe('updateOrganisationIdByEmail', () => {
    it('should add organisation id to the member', async () => {
      const mockExec = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(MemberModel, 'updateOne').mockReturnValue({ exec: mockExec } as any);

      await memberRepository.updateOrganisationIdByEmail('org-1', 'test@example.com');

      expect(MemberModel.updateOne).toHaveBeenCalledWith(
        { email: 'test@example.com' },
        { $addToSet: { organisation_id: 'org-1' } },
      );
    });
  });
});
