import 'reflect-metadata';
import { MemberService } from '../../../../src/server/services/Member';
import { MemberInterface } from '../../../../src/shared-library/models/Member';
import { MemberRepository } from '../../../../src/shared-library/repositories/Member';

jest.mock('../../../../src/shared-library/repositories/Member');

describe('getMemberByEmail', () => {
  let memberService: MemberService;
  let memberRepositoryMock: jest.Mocked<MemberRepository>;
  
  beforeEach(() => {
    memberRepositoryMock = new MemberRepository() as jest.Mocked<MemberRepository>;
    memberService = new MemberService(memberRepositoryMock);
  });

  it('should return member when provided email exists', async () => {
    const existingUser: MemberInterface = {
      _id: 'testmember',
      email: 'user@technogise.com',
    };
    memberRepositoryMock.findMemberByEmailId.mockResolvedValueOnce(existingUser);

    const result = await memberService.getMemberByEmailId('user@technogise.com');

    expect(result).toEqual(existingUser);
    expect(memberRepositoryMock.findMemberByEmailId).toHaveBeenCalledWith('user@technogise.com');
  });

  it('should return null when provided email does not exist', async () => {
    memberRepositoryMock.findMemberByEmailId.mockResolvedValueOnce(null);

    const result = await memberService.getMemberByEmailId('nonexistent@example.com');

    expect(result).toBeNull();
    expect(memberRepositoryMock.findMemberByEmailId).toHaveBeenCalledWith('nonexistent@example.com');
  });

  it('should add a new member', async () => {
    const user = {
      _id: 'testUserId',
      email: 'testUser@mail.com',
      name: {
        first: 'Test',
        last: 'User',
      }
    };
    memberRepositoryMock.addMember.mockResolvedValueOnce(user);

    const result = await memberService.addMember(user);

    expect(result).toEqual(user);
    expect(memberRepositoryMock.addMember).toHaveBeenCalledWith(user);
  });

  it('should propagate error when addMember fails', async () => {
    memberRepositoryMock.addMember.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(memberService.addMember({ email: 'fail@mail.com' } as any)).rejects.toThrow('DB write failed');
  });

  it('should propagate error when getMemberByEmailId fails', async () => {
    memberRepositoryMock.findMemberByEmailId.mockRejectedValueOnce(new Error('DB read failed'));

    await expect(memberService.getMemberByEmailId('fail@mail.com')).rejects.toThrow('DB read failed');
  });
});
