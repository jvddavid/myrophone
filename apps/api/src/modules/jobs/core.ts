import { Queue } from 'bullmq';
import { env } from '../../core/config/env';

const queueConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
};

const queueCache = new Map<string, Queue<unknown, unknown>>();

export function getQueue<Data, Result>(queueName: string): Queue<Data, Result> {
  const cached = queueCache.get(queueName);
  if (cached) {
    return cached as Queue<Data, Result>;
  }

  const queue = new Queue<Data, Result>(queueName, {
    connection: queueConnection,
  });

  queueCache.set(queueName, queue as Queue<unknown, unknown>);
  return queue;
}

export const defaultJobRetention = {
  completeAgeSeconds: 24 * 60 * 60,
  completeCount: 500,
  failAgeSeconds: 7 * 24 * 60 * 60,
  failCount: 5_000,
} as const;
