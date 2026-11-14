"""Measure grid pitch from exported pixels, without imaging dependencies."""
import json
import subprocess
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--images-dir", default="out/clipify-final")
parser.add_argument("--report", default="out/grid-consistency-review/pixel-measurements.json")
args = parser.parse_args()
directory = Path("out/grid-consistency-review")
directory.mkdir(parents=True, exist_ok=True)
results = []


def pitch(values):
    residuals = [0.0] * len(values)
    for i in range(6, len(values) - 6):
        baseline = sum(values[i + d] for d in (-5, -4, -3, 3, 4, 5)) / 6
        residuals[i] = max(0.0, values[i] - baseline)
    groups = []
    for i, value in enumerate(residuals):
        if value > 3:
            if groups and i == groups[-1][-1] + 1:
                groups[-1].append(i)
            else:
                groups.append([i])
    centers = [sum(i * residuals[i] for i in g) / sum(residuals[i] for i in g) for g in groups]
    if len(centers) < 10:
        raise ValueError(f"Too few visible grid lines: {centers}")
    return (centers[-1] - centers[0]) / (len(centers) - 1), centers


for name in ("16x9", "4x5", "9x16"):
    path = str(Path(args.images_dir) / f"clipify-{name}-thumbnail.png")
    meta = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-of", "json", path]))["streams"][0]
    width, height = meta["width"], meta["height"]
    pixels = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"])
    # Top and left margins contain only background at every scene/frame.
    xs = [pixels[(8 * width + x) * 3 + 1] for x in range(width)]
    ys = [pixels[(y * width + 8) * 3 + 1] for y in range(height)]
    x_pitch, x_lines = pitch(xs)
    y_pitch, y_lines = pitch(ys)
    expected = width * 48 / 1080
    result = {"format": name, "width": width, "height": height,
              "horizontal_pitch_px": x_pitch, "vertical_pitch_px": y_pitch,
              "cell_width_at_540px": x_pitch * 540 / width,
              "cell_height_at_540px": y_pitch * 540 / width,
              "square_error_percent": abs(x_pitch / y_pitch - 1) * 100,
              "x_line_centers": x_lines, "y_line_centers": y_lines}
    result["passed"] = abs(x_pitch - expected) < .25 and abs(y_pitch - expected) < .25 and result["square_error_percent"] < .3
    results.append(result)

passed = all(r["passed"] for r in results)
report = {"passed": passed, "source_directory": args.images_dir, "reference_display_width": 540, "expected_display_cell": 24, "results": results}
Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"passed": passed, "results": [{k: v for k, v in r.items() if not k.endswith("centers")} for r in results]}, indent=2))
if not passed:
    raise SystemExit(1)
