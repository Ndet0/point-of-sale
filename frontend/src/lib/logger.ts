const isDev = import.meta.env.DEV;

export const logger = {
  info: (message: string, meta?: unknown) => {
    if (isDev) console.info(`[INFO] ${message}`, meta ?? '');
  },
  warn: (message: string, meta?: unknown) => {
    if (isDev) console.warn(`[WARN] ${message}`, meta ?? '');
  },
  error: (message: string, meta?: unknown) => {
    console.error(`[ERROR] ${message}`, meta ?? '');
  },
};
