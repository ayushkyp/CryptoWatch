import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useSocketContext } from '../../context/SocketContext';

const GlobalAlertNotifier = () => {
  const socket = useSocketContext();
  const notifiedIdsRef = useRef(new Set());
  const audioCtxRef = useRef(null);

  const getAudioContext = () => {
    if (audioCtxRef.current) return audioCtxRef.current;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtxRef.current = new AudioCtx();
    return audioCtxRef.current;
  };

  const unlockAudio = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }
  };

  const playAlertSound = async () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    const now = ctx.currentTime;
    const makeTone = (frequency, start, end) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
    };

    makeTone(880, now, now + 0.16);
    makeTone(1175, now + 0.18, now + 0.38);
  };

  const showBrowserNotification = async (alertData) => {
    if (!('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = 'default';
      }
    }

    if (permission === 'granted') {
      new Notification(`Alert Triggered: ${alertData.coinName}`, {
        body: `${alertData.coinName} is ${alertData.condition} INR ${Number(alertData.targetPrice).toLocaleString('en-IN')}`,
      });
    }
  };

  useEffect(() => {
    const unlock = () => { unlockAudio(); };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const handleAlertTriggered = async (alertData) => {
      if (!alertData?.alertId) return;

      // Deduplicate repeated socket payloads for the same alert trigger.
      if (notifiedIdsRef.current.has(alertData.alertId)) return;
      notifiedIdsRef.current.add(alertData.alertId);

      toast.success(
        `Alert: ${alertData.coinName} is ${alertData.condition} INR ${Number(alertData.targetPrice).toLocaleString('en-IN')}`,
        { duration: 7000 }
      );

      await Promise.allSettled([
        playAlertSound(),
        showBrowserNotification(alertData),
      ]);
    };

    socket.on('alertTriggered', handleAlertTriggered);
    return () => {
      socket.off('alertTriggered', handleAlertTriggered);
    };
  }, [socket]);

  return null;
};

export default GlobalAlertNotifier;
