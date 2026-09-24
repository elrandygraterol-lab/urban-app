import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import MobilePaymentModal from '@/components/MobilePaymentModal';
import { paymentForm, type PaymentFormState } from '@/store/paymentFormStore';

// Host global del formulario de pago. Vive en el layout del grupo pasajero, POR
// ENCIMA del <Tabs> (tab bar), de modo que en Android el overlay cubre toda la
// pantalla (tab bar incluida) y ningún botón del mapa queda por arriba. En iOS el
// <Modal> nativo se presenta igual que antes.
//
// 2026-09-24 (1.er fix): el <Modal> nativo se mantiene SIEMPRE montado y solo se
// alterna `visible` (NO se desmonta con `return null`), replicando el patrón del
// <Modal> del Historial (history.tsx:684-685) que en iOS SÍ presentaba. Antes este
// host montaba el <MobilePaymentModal> desde cero ya con `visible=true`.
//
// 2026-09-24 (2.º fix): en iOS se SERIALIZA la presentación del <Modal> del pago
// detrás del <Modal> de notificación "ride_accepted" (UnifiedNotificationOverlay,
// que también es un <Modal> nativo y se presenta en el MISMO tick del evento).
// iOS descarta silenciosamente un segundo <Modal> nativo que intenta presentarse
// concurrentemente desde el mismo view controller raíz ("view not in window
// hierarchy"), por eso el formulario no aparecía en vivo pero sí al reabrir la app
// (donde no hay notificación simultánea). Se difiere ~IOS_PRESENTATION_DELAY_MS
// para que el <Modal> de la notificación se presente primero y el del pago se
// apile POR ENCIMA (iOS sí permite apilar sobre un modal ya presentado). En
// Android no aplica (el formulario es overlay <View>, no <Modal> nativo).
const IOS_PRESENTATION_DELAY_MS = 300;

export default function PaymentFormHost() {
  const [state, setState] = useState<PaymentFormState>(paymentForm.state);
  const [presentNow, setPresentNow] = useState(false);
  const lastPropsRef = useRef<PaymentFormState['props'] | null>(null);
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => paymentForm.subscribe(setState), []);

  useEffect(() => {
    if (!state.visible) {
      if (deferTimerRef.current != null) {
        clearTimeout(deferTimerRef.current);
        deferTimerRef.current = null;
      }
      setPresentNow(false);
      return;
    }

    // Android: presentar de inmediato (overlay <View>, sin <Modal> nativo).
    if (Platform.OS !== 'ios') {
      setPresentNow(true);
      return;
    }

    // iOS: diferir para no competir con el <Modal> de notificación.
    if (presentNow) return;
    if (deferTimerRef.current != null) return;
    deferTimerRef.current = setTimeout(() => {
      deferTimerRef.current = null;
      setPresentNow(true);
    }, IOS_PRESENTATION_DELAY_MS);

    return () => {
      if (deferTimerRef.current != null) {
        clearTimeout(deferTimerRef.current);
        deferTimerRef.current = null;
      }
    };
  }, [state.visible, presentNow]);

  if (state.visible && state.props) {
    lastPropsRef.current = state.props;
  }

  const next = lastPropsRef.current;
  const visible = !!presentNow && !!next;

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
