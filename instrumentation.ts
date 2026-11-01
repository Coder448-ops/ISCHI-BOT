export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startNotificationWorker } = await import('./lib/server/notifications');
    startNotificationWorker();
  }
}
