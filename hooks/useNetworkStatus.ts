import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  networkType: NetInfoStateType;
  isSlowConnection: boolean;
}

type NetworkListener = (status: NetworkStatus) => void;

const listeners = new Set<NetworkListener>();
let currentStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  networkType: NetInfoStateType.unknown,
  isSlowConnection: false,
};

export const notifyNetworkChange = (status: NetworkStatus) => {
  currentStatus = status;
  listeners.forEach(fn => fn(status));
};

export const addNetworkListener = (fn: NetworkListener): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const getNetworkStatus = (): NetworkStatus => currentStatus;

function isSlowNetwork(type: NetInfoStateType): boolean {
  return type === NetInfoStateType.cellular && (
    type === NetInfoStateType.cellular
  );
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus(state);
      const networkStatus: NetworkStatus = {
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        networkType: state.type,
        isSlowConnection: state.type === NetInfoStateType.cellular,
      };
      notifyNetworkChange(networkStatus);
    });

    NetInfo.fetch().then((state) => {
      setStatus(state);
      const networkStatus: NetworkStatus = {
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
        networkType: state.type,
        isSlowConnection: state.type === NetInfoStateType.cellular,
      };
      notifyNetworkChange(networkStatus);
    });

    return () => unsubscribe();
  }, []);

  if (!status) return currentStatus;

  return {
    isConnected: status.isConnected ?? true,
    isInternetReachable: status.isInternetReachable,
    networkType: status.type,
    isSlowConnection: status.type === NetInfoStateType.cellular,
  };
}

export function useNetworkTimeout(baseTimeoutMs: number = 10000): number {
  const { isSlowConnection } = useNetworkStatus();
  return isSlowConnection ? baseTimeoutMs * 2 : baseTimeoutMs;
}
