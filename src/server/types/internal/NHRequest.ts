import { UserInterface } from '../../../shared-library/models/User';
import { OrganisationInterface } from '../../../shared-library/models/Organisation';
import { MemberInterface } from '../../../shared-library/models/Member';

export interface NHRequestUser {
  role: string;
  organisation?: OrganisationInterface;
  user?: UserInterface;
  member?: MemberInterface;
}

export interface NHRequest {
  headers: Map<string, string>;
  user: NHRequestUser;
  httpVersionMajor: number;
  httpVersionMinor: number;
  complete: boolean;
  trailers: Map<string, string>;
  aborted: boolean;
  upgrade: boolean;
  url: string;
  method: string;
  params: Map<string, string>;
  query: Map<string, string>;
  body: unknown;
}
