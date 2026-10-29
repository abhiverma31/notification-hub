import { DeliveryReportInterface } from '../../../shared-library/models/DeliveryReportModel';

export interface DeliveryReportViewModel {
  deliveryReportsList: DeliveryReportInterface[];
  pagination: DeliveryReportPagination;
}

interface DeliveryReportPagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}
