import React from 'react';
import { Modal, SafeAreaView, StyleSheet, View } from 'react-native';
import { useNotificationContext } from '@/context/NotificationContext';
import RideRequestModal from '@/components/RideRequestModal';
import { ToastNotification } from '@/components/ToastNotification';
import { rideAPI } from '@/services/api';

export const GlobalNotificationOverlay: React.FC = () => {
  const { activeRideRequest, toastQueue, dismissRideRequest, showToast, dismissToast } =
    useNotificationContext();

  const isVisible = !!activeRideRequest || toastQueue.length > 0;

  const handleAccept = async (rideId: string) => {
    try {
      await rideAPI.acceptRide(rideId);
      dismissRideRequest();
    } catch {
      showToast('Error al aceptar el viaje. Intenta de nuevo.', 'error');
    }
  };

  const handleReject = async (rideId: string) => {
    try {
      await rideAPI.rejectRide(rideId);
      dismissRideRequest();
    } catch {
      showToast('Error al rechazar el viaje. Intenta de nuevo.', 'error');
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        {/* Toasts at the top */}
        {toastQueue.length > 0 && (
          <SafeAreaView style={styles.toastArea}>
            {toastQueue.map((toast) => (
              <ToastNotification key={toast.id} toast={toast} onDismiss={dismissToast} />
            ))}
          </SafeAreaView>
        )}

        {/* Ride request modal centered */}
        {activeRideRequest !== null && (
          <View style={styles.modalArea}>
            <RideRequestModal
              data={activeRideRequest}
              onAccept={handleAccept}
              onReject={handleReject}
              onExpire={dismissRideRequest}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  toastArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  modalArea: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default GlobalNotificationOverlay;
