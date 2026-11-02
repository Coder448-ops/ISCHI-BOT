export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL) {
    const { startNotificationWorker } = await import('./lib/server/notifications');
    startNotificationWorker();
  }
}
