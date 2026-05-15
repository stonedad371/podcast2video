import {spawn} from 'node:child_process';

const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export async function getAudioDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exit ${code}: ${stderr.trim()}`));
        return;
      }
      const dur = parseFloat(stdout.trim());
      if (!Number.isFinite(dur)) {
        reject(new Error(`ffprobe returned non-numeric: ${stdout}`));
        return;
      }
      resolve(dur);
    });
  });
}
