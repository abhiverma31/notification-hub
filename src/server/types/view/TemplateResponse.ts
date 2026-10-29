import { TemplateInterface } from '../../../shared-library/models/Template';

/**
 * @example
 * [
 *   {
 *     "data": [
 *       {
 *         "_id": "666be99e6fa80c950c7be79c",
 *         "name": "Promotional ondeck Template Test",
 *         "channelType": "onDeck",
 *         "organisationId": "666be99e6fa80c950c7be791",
 *         "templateDetails": {
 *           "title": "{{data.title}}",
 *           "content": "{{data.content}}",
 *           "actionUrl": "{{data.actionUrl}}"
 *         }
 *       },
 *       {
 *         "_id": "666be99e6fa80c950c7be79a",
 *         "name": "Promotional Push Template Test",
 *         "channelType": "push",
 *         "organisationId": "666be99e6fa80c950c7be791",
 *         "templateDetails": {
 *           "title": "Special Offer - {{recipient.name.first}}",
 *           "body": "Hello, {{recipient.name.first}}. We're excited to share a special offer with you! Click the link {{data.offerUrl}}"
 *         }
 *       }
 *     ],
 *     "pagination": {
 *       "currentPage": 1,
 *       "itemsPerPage": 10,
 *       "totalItems": 2,
 *       "totalPages": 1
 *     }
 *   }
 * ]
 */
export interface TemplateViewModel {
  templates: TemplateInterface[];
  pagination?: Pagination;
}

interface Pagination {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}
