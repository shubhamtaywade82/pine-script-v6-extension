import { register } from '../router.js';
import * as core from '../../core/health.js';

const statusCmd = {
  description: 'Check CDP connection to TradingView (same as MCP tool tv_health_check)',
  handler: () => core.healthCheck(),
};

register('status', statusCmd);
register('tv_health_check', statusCmd);

register('launch', {
  description: 'Launch TradingView with CDP enabled',
  options: {
    port: { type: 'string', short: 'p', description: 'CDP port (default 9222)' },
    'no-kill': { type: 'boolean', description: 'Do not kill existing instances' },
  },
  handler: (opts) => core.launch({
    port: opts.port ? Number(opts.port) : undefined,
    kill_existing: !opts['no-kill'],
  }),
});
