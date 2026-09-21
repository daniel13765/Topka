import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

interface EchoWindow extends Window {
  Pusher: typeof Pusher;
}

declare const window: EchoWindow;

let echo: Echo<'reverb'> | null = null;

export function getEcho(): Echo<'reverb'> | null {
  const key = import.meta.env.VITE_REVERB_APP_KEY;
  if (!key || typeof window === 'undefined') return null;
  if (echo) return echo;

  window.Pusher = Pusher;
  echo = new Echo({
    broadcaster: 'reverb',
    key,
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
  });

  return echo;
}

export function disconnectEcho(): void {
  echo?.disconnect();
  echo = null;
}
