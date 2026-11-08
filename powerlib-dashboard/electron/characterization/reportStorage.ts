import fs from "node:fs/promises";

export async function replaceReport(temporary: string, destination: string,
  rename = fs.rename, sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; ; attempt++) {
    try { await rename(temporary, destination); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!["EPERM", "EACCES", "EBUSY"].includes(code || "") || attempt >= 7) throw error;
      await sleep(Math.min(20 * 2 ** attempt, 400));
    }
  }
}
