export interface PaymentFormProps {
  amount: number;
  currency?: string;
  exchangeRate?: number;
  rideId?: string;
  passengerName?: string;
  platformMethod?: unknown;
  onPaymentComplete: (paymentData: {
    method: 'mobile_payment' | 'cash';
    referenceNumber?: string;
    phoneNumber?: string;
    bankName?: string;
    referencia?: string;
    fecha?: string;
    banco?: string;
    telefonoP?: string;
    identificacion?: string;
    pagador?: string;
  }) => void;
  onCancel: () => void;
  onBeforeCancel?: () => void;
}

export interface PaymentFormState {
  visible: boolean;
  props: PaymentFormProps | null;
}

let state: PaymentFormState = { visible: false, props: null };
const listeners = new Set<(s: PaymentFormState) => void>();

export const paymentForm = {
  get state() {
    return state;
  },
  open(props: PaymentFormProps) {
    state = { visible: true, props };
    listeners.forEach((l) => l(state));
  },
  close() {
    state = { visible: false, props: null };
    listeners.forEach((l) => l(state));
  },
  subscribe(listener: (s: PaymentFormState) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};