import { useState, useEffect, useCallback } from 'react';
import {
  getAlerts as fetchAlertsAPI,
  createAlert as createAlertAPI,
  deleteAlert as deleteAlertAPI,
} from '../services/api';
import { useSocketContext } from '../context/SocketContext';

const ensureNotificationPermission = async () => {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
};

const useAlerts = () => {
  const socket = useSocketContext();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const res = await fetchAlertsAPI();
        setAlerts(res.data.alerts || []);
      } catch (error) {
        console.error('Failed to load alerts:', error.message);
      }
    };
    loadAlerts();
  }, []);

  useEffect(() => {
    const handleAlertTriggered = (alertData) => {
      // Update alerts state so triggered tab refreshes
      setAlerts((prev) =>
        prev.map((a) =>
          a._id === alertData.alertId
            ? { ...a, status: 'triggered', triggeredAt: alertData.triggeredAt }
            : a
        )
      );
    };

    socket.on('alertTriggered', handleAlertTriggered);
    return () => socket.off('alertTriggered', handleAlertTriggered);
  }, [socket]);

  const createAlert = useCallback(async (data) => {
    // Ask notification permission on user action (best browser compatibility)
    await ensureNotificationPermission();

    const res = await createAlertAPI(data);
    setAlerts((prev) => [res.data.alert, ...prev]);
    return res.data.alert;
  }, []);

  const deleteAlert = useCallback(async (id) => {
    await deleteAlertAPI(id);
    setAlerts((prev) => prev.filter((a) => a._id !== id));
  }, []);

  const triggeredAlerts = alerts.filter((a) => a.status === 'triggered');

  return { alerts, createAlert, deleteAlert, triggeredAlerts };
};

export default useAlerts;
