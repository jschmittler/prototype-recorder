import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Extract a single representative frame from a finished recording.
 *
 * The first frame of a walkthrough is usually a blank or half-painted page, so
 * the grab is offset a little way in. The poster is best-effort: if ffmpeg is
 * missing or the encode fails, the job still completes without one and the UI
 * falls back to a text-only card.
 */
export function makePoster(
  videoPath: string,
  durationSeconds: number,
  ffmpegPath = "ffmpeg"
): string | undefined {
  // Far enough in to have real content, but never past the end of a short clip.
  const offset = durationSeconds > 0 ? Math.min(1.5, durationSeconds * 0.25) : 0;
  const posterPath = path.join(path.dirname(videoPath), `${path.parse(videoPath).name}.poster.jpg`);

  try {
    // execFile (no shell): every argument is a discrete argv entry, so nothing
    // here is interpreted as a command.
    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-loglevel", "error",
        "-ss", offset.toFixed(2),
        "-i", videoPath,
        "-frames:v", "1",
        // Downscale to card width; -2 keeps the height even for the encoder.
        "-vf", "scale=640:-2",
        "-q:v", "6",
        posterPath,
      ],
      { stdio: "ignore", timeout: 20_000 }
    );
  } catch {
    return undefined;
  }

  // A zero-byte file means ffmpeg exited cleanly but produced nothing usable.
  if (!fs.existsSync(posterPath) || fs.statSync(posterPath).size === 0) return undefined;
  return posterPath;
}
