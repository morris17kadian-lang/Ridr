import { apiRequest } from './http';

export type PaymentMethodDto = {
  id: string;
  provider: string;
  last4: string;
  brand: string;
  expiryMonth?: string;
  expiryYear?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ListPaymentMethodsResponse = {
  paymentMethods: PaymentMethodDto[];
};

export type PaymentMethodResponse = {
  paymentMethod: PaymentMethodDto;
};

export async function listPaymentMethods(): Promise<ListPaymentMethodsResponse> {
  return apiRequest<ListPaymentMethodsResponse>('/users/me/payment-methods', {
    method: 'GET',
    auth: true,
  });
}

export async function createPaymentMethod(body: {
  provider: string;
  token: string;
  last4: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  isDefault?: boolean;
}): Promise<PaymentMethodResponse> {
  return apiRequest<PaymentMethodResponse>('/users/me/payment-methods', {
    method: 'POST',
    json: body,
    auth: true,
  });
}

export async function updatePaymentMethod(
  id: string,
  body: { isDefault?: boolean; brand?: string; expiryMonth?: string; expiryYear?: string }
): Promise<PaymentMethodResponse> {
  return apiRequest<PaymentMethodResponse>(`/users/me/payment-methods/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    json: body,
    auth: true,
  });
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await apiRequest<unknown>(`/users/me/payment-methods/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

/** Maps API DTO to the profile card row shape (id = server payment method id). */
export function paymentMethodToDisplay(pm: PaymentMethodDto): {
  id: string;
  type: 'visa' | 'mastercard';
  last4: string;
  label: string;
  expiryMonth?: string;
  expiryYear?: string;
} {
  const b = (pm.brand ?? '').toLowerCase();
  const type: 'visa' | 'mastercard' =
    b.includes('master') || b === 'mc' || b.includes('mastercard') ? 'mastercard' : 'visa';
  return {
    id: pm.id,
    type,
    last4: pm.last4,
    label: `${pm.brand ?? 'Card'} •••• ${pm.last4}`,
    ...(pm.expiryMonth ? { expiryMonth: pm.expiryMonth } : {}),
    ...(pm.expiryYear ? { expiryYear: pm.expiryYear } : {}),
  };
}
