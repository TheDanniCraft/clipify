import os from "os";
import path from "path";
import { spawn } from "child_process";

const CACHE_DIR = path.join(os.homedir(), ".clipify-runner", "bin");
const ffmpegDest = path.join(CACHE_DIR, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

console.log(`[stream:test] Using FFmpeg at: ${ffmpegDest}`);

const args = ["-nostdin", "-re", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=60", "-f", "lavfi", "-i", "sine=frequency=1000:sample_rate=44100", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-b:v", "3000k", "-maxrate", "3000k", "-bufsize", "6000k", "-pix_fmt", "yuv420p", "-g", "120", "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "44100", "-f", "flv", "rtmp://127.0.0.1:1935/live"];

const child = spawn(ffmpegDest, args, { stdio: "inherit" });

child.on("close", (code) => {
	process.exit(code ?? 0);
});
