import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { paymentForm, type PaymentFormState } from '@/store/paymentFormStore';

// Host global del formulario de pago. Vive en el layout del grupo pasajero, POR
// ENCIMA del <Tabs> (tab bar), de modo que en Android el overlay cubre toda la
// pantalla (tab bar incluida) y ningún botón del mapa queda por arriba. En iOS el
// <Modal> nativo se presenta igual que antes.
export default function PaymentFormHost() {
  const [state, setState] = useState<PaymentFormState>(paymentForm.state);

  useEffect(() => paymentForm.subscribe(setState), []);

  if (!state.visible || !state.props) return null;

  return (
    <MobilePaymentModal
      visible={state.visible}
      {...(state.props as unknown as Omit<ComponentProps<typeof MobilePaymentModal>, 'visible'>)}
    />
  );
}