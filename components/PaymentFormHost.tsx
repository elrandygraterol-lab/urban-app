import { useEffect, useRef, useState } from 'react';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { paymentForm, type PaymentFormState } from '@/store/paymentFormStore';

// Host global del formulario de pago. Vive en el layout del grupo pasajero, POR
// ENCIMA del <Tabs> (tab bar), de modo que en Android el overlay cubre toda la
// pantalla (tab bar incluida) y ningún botón del mapa queda por arriba. En iOS el
// <Modal> nativo se presenta igual que antes.
//
// 2026-09-24: hipótesis basada en el hallazgo del Historial (history.tsx:684-685,
// cuyos <Modal> nativos SÍ presentan en iOS): el <Modal> nativo aquí se mantiene
// SIEMPRE montado y solo se alterna `visible` (NO se desmonta con `return null`),
// es decir nace con `visible=false` y luego cambia el flag. Antes este host montaba
// el <MobilePaymentModal> desde cero ya con `visible=true`, y en esta build ADHOC
// iOS eso no presentaba el formulario.
export default function PaymentFormHost() {
  const [state, setState] = useState<PaymentFormState>(paymentForm.state);
  const lastPropsRef = useRef<PaymentFormState['props'] | null>(null);

  useEffect(() => paymentForm.subscribe(setState), []);

  if (state.visible && state.props) {
    lastPropsRef.current = state.props;
  }

  const next = lastPropsRef.current;
  const visible = !!state.visible && !!next;

  return (
    <MobilePaymentModal
      visible={visible}
      amount={next?.amount ?? 0}
      currency={(next?.currency as 'VES' | 'USD') ?? 'VES'}
      exchangeRate={next?.exchangeRate}
      rideId={next?.rideId}
      passengerName={next?.passengerName}
      platformMethod={next?.platformMethod as never}
      onPaymentComplete={next?.onPaymentComplete ?? (() => {})}
      onCancel={next?.onCancel ?? (() => {})}
      onBeforeCancel={next?.onBeforeCancel}
    />
  );
}
