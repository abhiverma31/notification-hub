import { injectable, inject } from 'tsyringe';
import { ServerLogger } from '../utils/ServerLogger';
import { MemberRepository } from '../../shared-library/repositories/Member';
import { AddMemberInterface, MemberInterface } from '../../shared-library/models/Member';

@injectable()
export class MemberService {
  private readonly logger = new ServerLogger();
  constructor(@inject(MemberRepository) private memeberRepository: MemberRepository) {}

  async getMemberByEmailId(emailId: string): Promise<MemberInterface | null> {
    return await this.memeberRepository.findMemberByEmailId(emailId);
  }

  async addMember(user: AddMemberInterface): Promise<MemberInterface | null> {
    return await this.memeberRepository.addMember(user);
  }
}
