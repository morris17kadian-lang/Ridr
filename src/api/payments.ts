import { apiRequest } from './http';

/** PowerTranz-style card payload for `/payments/powertranz/tokenize` */
export type PaymentsTokenizeSource = {
  CardPan: string;
  CardCvv: string;
  /** YYMM e.g. `2512` for Dec 2025 */
  CardExpiration: string;
  CardholderName: string;
};

/** Body for `POST /payments/powertranz/tokenize` (field names match gateway JSON). */
export type PaymentsTokenizeRequest = {
  TransactionIdentifier: string;
  TotalAmount: number;
  /** ISO 4217 numeric, e.g. `388` = JMD */
  CurrencyCode: string;
  Tokenize: boolean;
  ThreeDSecure: boolean;
  Source: PaymentsTokenizeSource;
  OrderIdentifier: string;
  ExternalIdentifier: string;
};

export async function postPaymentsTokenize(body: PaymentsTokenizeRequest): Promise<unknown> {
  return apiRequest<unknown>('/payments/powertranz/tokenize', {
    method: 'POST',
    json: body,
    auth: true,
  });
}
