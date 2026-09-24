import { useEffect, useRef, useState } from 'react';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { paymentForm, type PaymentFormState } from '@/store/paymentFormStore';

// Host global del formulario de pago. Vive en el layout del grupo pasajero, POR
// ENCIMA del <Tabs> (tab bar), de modo que en Android el overlay cubre toda la
// pantalla (tab bar incluida) y ningún botón del mapa queda por arriba. En iOS el
// <Modal> nativo se presenta igual que antes.
//
// 2026-09-24 (1.er fix): el <Modal> nativo se mantiene SIEMPRE montado y solo se
// alterna `visible` (NO se desmonta con `return null`), replicando el patrón del
// <Modal> del Historial (history.tsx:684-685) que en iOS SÍ presentaba.
//
// 2026-09-24 (2.º fix — REVERTIDO por el Fix 3): se serializaba con
// IOS_PRESENTATION_DELAY_MS=300ms para diferir la presentación del pago detrás
// del <Modal> de notificación "ride_accepted" (UnifiedNotificationOverlay, otro
// <Modal> nativo), porque iOS descartaba el segundo <Modal> concurrente. El
// usuario probó el build con ese delay y SIGUIÓ fallando → se descartó el timing
// como causa raíz.
//
// 2026-09-24 (FIX 3, vigente): la causa raíz era la DOBLE presentación de
// <Modal> nativo en el mismo tick. El UnifiedNotificationOverlay ya NO presenta
// un <Modal> nativo para banners/status/toasts en iOS — los renderiza sobre
// <FullWindowOverlay> (react-native-screens), a nivel de UIWindow. Así el
// <Modal> del pago vuelve a ser el ÚNICO modal nativo → iOS lo presenta de
// inmediato y siempre. Por eso aquí la presentación es DIRECTA en cuanto
// `state.visible && state.props`; no queda ningún delay.
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
