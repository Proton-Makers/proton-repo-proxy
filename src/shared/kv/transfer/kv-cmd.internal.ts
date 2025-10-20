import { execSync } from 'node:child_process';

/**
 * Execute wrangler KV command
 */
export function execWrangler(args: string[]): string {
  const cmd = `npx wrangler ${args.join(' ')}`;
  console.log(`🔧 ${cmd}`);

  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Command failed: ${cmd}`);
    throw error;
  }
}
