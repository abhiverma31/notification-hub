import { UserInterface } from '../../../shared-library/models/User';

export interface UserListViewModel {
  userList: UserInterface[];
  pagination: UserListPagination;
}

interface UserListPagination {
  currentPage: number;
  itemsPerPage: number;
  totalUsers: number;
  totalPages: number;
}
