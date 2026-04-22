export const EMAIL_QUEUE = {
  sync: 'queue.email.sync',
  parse: 'queue.email.parse',
  thread: 'queue.email.thread',
  link: 'queue.email.link',
  outbound: 'queue.email.outbound',
  eventPublish: 'queue.email.event.publish',
  retry: 'queue.email.retry',
  dlq: 'queue.email.dlq',
} as const;