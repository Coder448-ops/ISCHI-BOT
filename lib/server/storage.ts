import { randomUUID, createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, open, readdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import { storeSchemas, type StoreData, type StoreName } from './schemas';

export class StorageError extends Error {
  constructor(
    message: string,
    public code = 'STORAGE_UNAVAILABLE',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
const names = Object.keys(storeSchemas) as StoreName[];
const globalStore = globalThis as unknown as {
  ischiQueue?: Promise<unknown>;
  ischiReady?: Promise<void>;
  ischiRoot?: string;
};
export function dataRoot() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
    throw new StorageError(
      'Bu serverda JSON fayllar doimiy saqlanmaydi. Doimiy diskli backend serverga ulang. DATA_DIR doimiy diskka joylashtirilishi shart.',
      'PERSISTENT_DISK_REQUIRED',
    );
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR ||
      (process.env.NODE_ENV === 'production' ? '/var/lib/ischi/data' : 'data'),
  );
  const publicRoot = path.resolve('public');
  if (
    root === publicRoot ||
    root.startsWith(publicRoot + path.sep) ||
    root.startsWith(path.resolve('.next') + path.sep)
  )
    throw new StorageError('DATA_DIR public yoki build papkasida bo‘lmasin.');
  return root;
}
const fileFor = (root: string, name: StoreName) => path.join(root, `${name}.json`);
async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function atomicWrite(filename: string, value: unknown) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + '\n', 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, filename);
  await syncDirectory(path.dirname(filename));
}
async function readJson(filename: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(filename, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StorageError('JSON fayl buzilgan. Administrator zaxiradan tiklashi kerak.');
  }
}
function validate<K extends StoreName>(name: K, data: unknown): StoreData[K] {
  const result = storeSchemas[name].safeParse(data);
  if (!result.success) {
    console.error(
      `[ISCHI] invalid collection=${name} fields=${result.error.issues.map((x) => x.path.join('.')).join(',')}`,
    );
    throw new StorageError(`Ma’lumotlar tekshiruvdan o‘tmadi: ${name}.`);
  }
  return result.data as StoreData[K];
}
async function readOne<K extends StoreName>(root: string, name: K): Promise<StoreData[K]> {
  const envelope = (await readJson(fileFor(root, name))) as
    { version?: number; revision?: number; data?: unknown } | undefined;
  if (!envelope || envelope.version !== 1)
    throw new StorageError(
      `Fayl versiyasi noto‘g‘ri yoki fayl topilmadi: ${name}.`,
      'DATA_FILE_INVALID',
    );
  return validate(name, envelope.data);
}
async function revision(root: string, name: StoreName) {
  const envelope = (await readJson(fileFor(root, name))) as { revision?: number };
  return envelope.revision || 0;
}
function validateRelations(data: StoreData) {
  const productIds = new Set(data.products.map((p) => p.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  if (productIds.size !== data.products.length || categoryIds.size !== data.categories.length)
    throw new ApiError(400, 'Identifikatorlar takrorlanmasin.');
  if (new Set(data.products.map((p) => p.code.toLowerCase())).size !== data.products.length)
    throw new ApiError(400, 'Mahsulot kodi takrorlanmasin.');
  if (new Set(data.coupons.map((c) => c.code)).size !== data.coupons.length)
    throw new ApiError(400, 'Kupon kodi takrorlanmasin.');
  for (const p of data.products) {
    if (!categoryIds.has(p.categoryId)) throw new ApiError(400, 'Kategoriya topilmadi.');
    if (p.relatedIds.some((id) => !productIds.has(id)))
      throw new ApiError(400, 'O‘xshash mahsulot topilmadi.');
  }
  for (const o of data.orders)
    if (o.items.some((i) => i.quantity > 1000000)) throw new ApiError(400, 'Miqdor juda katta.');
}
type Journal = { id: string; changes: { name: StoreName; revision: number; data: unknown }[] };
async function recover(root: string) {
  const journalDir = path.join(root, '.journals');
  for (const entry of await readdir(journalDir)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(entry)) continue;
    const journal = (await readJson(path.join(journalDir, entry))) as Journal;
    if (!journal || !Array.isArray(journal.changes))
      throw new StorageError('Tranzaksiya jurnali buzilgan. Qo‘lda tiklash kerak.');
    for (const change of journal.changes) {
      if (!names.includes(change.name)) throw new StorageError('Jurnalda noma’lum fayl.');
      validate(change.name, change.data);
    }
    for (const change of journal.changes)
      await atomicWrite(fileFor(root, change.name), {
        version: 1,
        revision: change.revision,
        data: change.data,
      });
    await unlink(path.join(journalDir, entry));
  }
}
async function initialize() {
  const root = dataRoot();
  if (globalStore.ischiReady && globalStore.ischiRoot === root) return globalStore.ischiReady;
  globalStore.ischiRoot = root;
  const ready = (async () => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await mkdir(path.join(root, 'backups'), { recursive: true, mode: 0o700 });
    await mkdir(path.join(root, '.journals'), { recursive: true, mode: 0o700 });
    await mkdir(path.join(root, 'uploads'), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(root, {
      lockfilePath: path.join(root, '.write.lock'),
      realpath: false,
      stale: 20000,
      update: 5000,
      retries: { retries: 20, minTimeout: 50, maxTimeout: 300 },
    });
    try {
      await recover(root);
      const initialized = await readJson(path.join(root, '.initialized'));
      for (const name of names) {
        if (initialized && (await readJson(fileFor(root, name))) === undefined)
          throw new StorageError(
            `Saqlangan ${name}.json fayli topilmadi. Bo‘sh fayl yaratish o‘rniga zaxiradan tiklang.`,
            'DATA_FILE_MISSING',
          );
        if ((await readJson(fileFor(root, name))) === undefined) {
          const seedFile = path.resolve('seeds', `${name}.json`);
          const seed = (await readJson(seedFile)) as { data?: unknown } | undefined;
          if (!seed) throw new StorageError(`Boshlang‘ich ma’lumot topilmadi: ${name}.`);
          await atomicWrite(fileFor(root, name), {
            version: 1,
            revision: 0,
            data: validate(name, seed.data),
          });
        } else await readOne(root, name);
      }
      if (!initialized)
        await atomicWrite(path.join(root, '.initialized'), {
          version: 1,
          initializedAt: new Date().toISOString(),
        });
      const secretPath = path.join(root, '.receipt-secret');
      try {
        await stat(secretPath);
      } catch {
        await atomicWrite(secretPath, randomBytes(32).toString('hex'));
      }
    } finally {
      await release();
    }
  })();
  globalStore.ischiReady = ready.catch((error) => {
    globalStore.ischiReady = undefined;
    throw error;
  });
  return globalStore.ischiReady;
}
export async function withStore<T>(
  fn: (data: StoreData) => T | Promise<T>,
  writeNames: StoreName[] = [],
): Promise<T> {
  await initialize();
  const root = dataRoot();
  const task = async () => {
    const release = await lockfile.lock(root, {
      lockfilePath: path.join(root, '.write.lock'),
      realpath: false,
      stale: 20000,
      update: 5000,
      retries: { retries: 40, minTimeout: 50, maxTimeout: 300 },
    });
    try {
      await recover(root);
      const data = {} as StoreData;
      for (const name of names) Object.assign(data, { [name]: await readOne(root, name) });
      const before = structuredClone(data);
      const result = await fn(data);
      const changed = [...new Set(writeNames)].filter(
        (name) => JSON.stringify(before[name]) !== JSON.stringify(data[name]),
      );
      if (changed.length) {
        for (const name of names) Object.assign(data, { [name]: validate(name, data[name]) });
        validateRelations(data);
        const id = randomUUID();
        const backupDir = path.join(root, 'backups', id);
        await mkdir(backupDir, { mode: 0o700 });
        for (const name of changed)
          await atomicWrite(path.join(backupDir, `${name}.json`), {
            version: 1,
            revision: await revision(root, name),
            data: before[name],
          });
        const changes = [];
        for (const name of changed)
          changes.push({ name, revision: (await revision(root, name)) + 1, data: data[name] });
        const journalPath = path.join(root, '.journals', `${id}.json`);
        await atomicWrite(journalPath, { id, changes } satisfies Journal);
        for (const change of changes)
          await atomicWrite(fileFor(root, change.name), {
            version: 1,
            revision: change.revision,
            data: change.data,
          });
        await unlink(journalPath);
        const backupNames = (await readdir(path.join(root, 'backups'))).filter((x) =>
          /^[a-f0-9-]{36}$/.test(x),
        );
        const backups = (
          await Promise.all(
            backupNames.map(async (id) => ({
              id,
              modified: (await stat(path.join(root, 'backups', id))).mtimeMs,
            })),
          )
        )
          .sort((a, b) => a.modified - b.modified || a.id.localeCompare(b.id))
          .map((x) => x.id);
        // UUID names are random: order by filesystem modification time, never by name.
        if (backups.length > 40)
          for (const old of backups.slice(0, -40)) {
            const oldPath = path.join(root, 'backups', old);
            for (const file of await readdir(oldPath)) await unlink(path.join(oldPath, file));
            const { rmdir } = await import('node:fs/promises');
            await rmdir(oldPath);
          }
      }
      return result;
    } finally {
      await release();
    }
  };
  const queued = (globalStore.ischiQueue || Promise.resolve()).then(task, task);
  globalStore.ischiQueue = queued.catch(() => undefined);
  return queued;
}
export async function readStore<K extends StoreName>(name: K): Promise<StoreData[K]> {
  return withStore((data) => structuredClone(data[name]));
}
export async function receiptToken(orderId: string) {
  await initialize();
  const secret = String(await readFile(path.join(dataRoot(), '.receipt-secret'), 'utf8')).trim();
  return createHmac('sha256', secret).update(orderId).digest('base64url');
}
export async function listBackups() {
  return withStore(async () => {
    const root = path.join(dataRoot(), 'backups');
    const result = [];
    for (const id of await readdir(root)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue;
      const info = await stat(path.join(root, id));
      result.push({
        id,
        createdAt: info.mtime.toISOString(),
        files: (await readdir(path.join(root, id)))
          .filter((x) => x.endsWith('.json'))
          .map((x) => x.slice(0, -5)),
      });
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}
export async function restoreBackup(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new ApiError(400, 'Zaxira nomi noto‘g‘ri.');
  const restoredNames: StoreName[] = [];
  return withStore(async (data) => {
    const directory = path.join(dataRoot(), 'backups', id);
    const files = (await readdir(directory)).filter((x) => /^[a-z]+\.json$/.test(x));
    const restored = {} as StoreData;
    restoredNames.length = 0;
    for (const file of files) {
      const name = file.slice(0, -5) as StoreName;
      if (!names.includes(name) || name === 'sessions') continue;
      const envelope = (await readJson(path.join(directory, file))) as
        { version?: number; data?: unknown } | undefined;
      if (!envelope || envelope.version !== 1) throw new StorageError('Zaxira fayli buzilgan.');
      Object.assign(restored, { [name]: validate(name, envelope.data) });
      restoredNames.push(name);
    }
    if (!restoredNames.length) throw new ApiError(404, 'Zaxira topilmadi.');
    // Preserve delivery facts before replacing the transaction snapshot.
    const deliveryFacts = new Map(
      data.notifications.filter((x) => x.state === 'sent').map((x) => [x.id, x]),
    );
    for (const name of restoredNames) Object.assign(data, { [name]: restored[name] });
    if (restoredNames.includes('notifications')) {
      data.notifications = data.notifications.map((event) => {
        const delivered = deliveryFacts.get(event.id);
        if (delivered) return delivered;
        // An old pending snapshot cannot prove Telegram did not receive the message.
        return event.state === 'sent'
          ? event
          : {
              ...event,
              state: 'uncertain' as const,
              lockedAt: null,
              error: 'Zaxiradan tiklandi. Qayta yuborishdan oldin Telegram chatini tekshiring.',
            };
      });
    }
  }, restoredNames);
}
export function safeStorageError(error: unknown) {
  if (error instanceof StorageError || error instanceof ApiError) return error;
  return new StorageError(
    'Fayl omboriga kirishda xatolik. Disk ruxsatlari va bo‘sh joyini tekshiring.',
  );
}
