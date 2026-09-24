import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ModalProps, Platform } from 'react-native';

// Delay in ms to serialize modal presentation on iOS (avoids racing with other native Modals)
export const IOS_MODAL_PRESENTATION_DELAY_MS = 300;

export interface DeferredModalProps extends ModalProps {
  children?: ReactNode;
  /** If true, defer iOS presentation by IOS_MODAL_PRESENTATION_DELAY_MS to let other Modals appear first */
  deferIos?: boolean;
}

/**
 * DeferredModal wraps RN Modal to prevent iOS from dropping a second Modal when
 * presented in the same tick as another native Modal (e.g. UnifiedNotificationOverlay).
 *
 * The fix matches PaymentFormHost: on iOS, when `visible` becomes true, the actual
 * presentation is delayed ~300ms so the first Modal can finish presenting and the
 * new one stacks on top. On Android/other platforms it renders immediately.
 */
export const DeferredModal = ({
  deferIos = true,
  visible,
  children,
  ...rest
}: DeferredModalProps) => {
  const [presentNow, setPresentNow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const nextVisible = !!visible;

    if (nextVisible && !wasVisibleRef.current) {
      // Becoming visible
      if (!deferIos || Platform.OS !== 'ios') {
        setPresentNow(true);
      } else {
        if (timerRef.current != null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setPresentNow(true);
        }, IOS_MODAL_PRESENTATION_DELAY_MS);
      }
    }

    if (!nextVisible && wasVisibleRef.current) {
      // Becoming hidden
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setPresentNow(false);
    }

    wasVisibleRef.current = nextVisible;

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, deferIos]);

  const skipDefer = !deferIos || Platform.OS !== 'ios';
  const effectiveVisible = visible && (skipDefer || presentNow);

  return (
    <Modal visible={effectiveVisible} {...rest}>
      {children}
    </Modal>
  );
};

export default DeferredModal;
