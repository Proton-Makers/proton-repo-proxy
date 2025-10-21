import { execSync } from 'node:child_process';

/**
 * Execute wrangler KV command
 */
export function execWrangler(args: string[]): string {
  const cmd = `npx wrangler ${args.join(' ')}`;

  // Limit console output to avoid flooding with large commands
  const displayCmd = cmd.length > 150 ? `${cmd.slice(0, 150)}... (${cmd.length} chars)` : cmd;
  console.log(`🔧 ${displayCmd}`);

  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Command failed: ${displayCmd}`);
    throw error;
  }
}
