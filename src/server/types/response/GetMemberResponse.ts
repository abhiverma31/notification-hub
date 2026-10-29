export interface GetMemberResponse {
  member: {
    name?: {
      first: string;
      last: string;
    };
  };
  organisation: {
    name?: string;
  };
}
