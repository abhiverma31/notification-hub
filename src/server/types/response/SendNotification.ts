/**
 * 
 * 
 * @example
{
    "transactions": [
        {
            "id": "d0d0c13e-794c-4029-bb69-c29d561de595",
            "recipient": "john@technogise.com",
            "channel": "onDeck"
        },
        {
            "id": "2a619949-74c5-4849-8c76-61a84864618d",
            "recipient": "john@technogise.com",
            "channel": "push"
        },
        {
            "id": "37e40296-6e95-4e20-809d-00a8681f5151",
            "recipient": "john@technogise.com",
            "channel": "email"
        }
    ]
}
*/
export interface SendNotificationResponse {
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  recipient?: string;
  channel?: string;
  error?: string;
}
