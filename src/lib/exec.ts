/**
 * Ejecutar programas del sistema de forma SEGURA.
 *
 * Usamos execFile (argumentos como lista) y NUNCA exec/shell con texto concatenado:
 * asi, aunque el modelo envie texto raro, no se puede inyectar comandos.
 */
import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export function run(
  command: string,
  args: string[] = [],
  options: { timeoutMs?: number; cwd?: string; env?: Record<string, string> } = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: options.timeoutMs ?? 15_000,
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : process.env,
        maxBuffer: 5 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException).code === "number"
            ? ((error as NodeJS.ErrnoException).code as unknown as number)
            : error
              ? 1
              : 0;
        resolve({ stdout: String(stdout), stderr: String(stderr || error?.message || ""), code });
      },
    );
  });
}
