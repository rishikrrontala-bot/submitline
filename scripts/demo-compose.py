"""Build the narrated, captioned Submitline MP4 from real browser footage.

The source capture and timeline come from demo-capture.mjs. Narration uses macOS
offline speech and is never played during this script. Captions are burned into
the browser recording; this script also writes the exact transcript and SRT.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import imageio_ffmpeg


ROOT = Path(__file__).resolve().parent.parent
PROOF = ROOT / "proof"
TIMELINE = PROOF / "demo-timeline.json"
CAPTURE = PROOF / "demo-capture.webm"
FINAL = PROOF / "submitline-demo.mp4"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "Samantha"
RATE = "180"
CAPTURE_LEAD_IN = 0.8  # Playwright starts video before the first timed scene.


def duration(path: Path) -> float:
    result = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not match:
        raise RuntimeError(f"Could not read duration for {path}: {result.stderr[-1000:]}")
    return int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])


def timestamp(seconds: float) -> str:
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"


def main() -> None:
    scenes = json.loads(TIMELINE.read_text())
    if len(scenes) != 11 or not CAPTURE.is_file():
        raise RuntimeError("Complete real recording and timeline are required")
    video_duration = duration(CAPTURE)
    scene_end = scenes[-1]["end"]
    final_duration = scene_end + 0.3
    if not 120 <= final_duration <= 180:
        raise RuntimeError(f"Demo duration must be 2–3 minutes, got {final_duration:.2f}s")
    if abs(video_duration - scene_end) > 6:
        raise RuntimeError(f"Capture/timeline mismatch: {video_duration:.2f}s vs {scene_end:.2f}s")

    lines = [
        "# Submitline demo — exact narration and captions",
        "",
        f"Runtime: {final_duration:.1f} seconds. Screen actions and network observations are from the real app.",
        "Narration uses the macOS Samantha voice; captions are burned into the video and also supplied as SRT.",
        "The Northstar entry is explicitly fictional. The recorded HTTP 404 and subsequent HTTP 200 are real requests.",
        "No deAPI model output appears because no API key was available for this recording.",
        "",
    ]
    srt: list[str] = []
    input_args = ["-ss", str(CAPTURE_LEAD_IN), "-i", str(CAPTURE)]
    filters: list[str] = []
    tags: list[str] = []
    for index, scene in enumerate(scenes, 1):
        start, end = scene["start"], scene["end"]
        narration = scene["narration"]
        voice_path = PROOF / f"voice-{index:02}.aiff"
        subprocess.run(["say", "-v", VOICE, "-r", RATE, "-o", str(voice_path), narration], check=True)
        voice_duration = duration(voice_path)
        room = end - start - 0.05
        if voice_duration > room:
            raise RuntimeError(f"Narration {index:02} takes {voice_duration:.2f}s but scene has {room:.2f}s")
        input_args += ["-i", str(voice_path)]
        tag = f"v{index}"
        delay_ms = round((start + 0.25) * 1000)
        filters.append(f"[{index}:a]adelay={delay_ms}|{delay_ms}[{tag}]")
        tags.append(f"[{tag}]")
        lines += [f"## {timestamp(start).replace(',', '.')}–{timestamp(end).replace(',', '.')} · {scene['title']}", "", narration, ""]
        part1, part2 = scene["captions"]
        fraction = len(part1.split()) / len(narration.split())
        cut = start + 0.25 + voice_duration * fraction
        srt.extend([
            str(index * 2 - 1),
            f"{timestamp(start + 0.25)} --> {timestamp(cut)}",
            part1,
            "",
            str(index * 2),
            f"{timestamp(cut)} --> {timestamp(end)}",
            part2,
            "",
        ])
        print(f"{index:02} {scene['title']}: voice {voice_duration:.2f}s / room {room:.2f}s")

    (PROOF / "DEMO-SCRIPT.md").write_text("\n".join(lines))
    (PROOF / "submitline-demo.srt").write_text("\n".join(srt))
    subtitle_file = PROOF / "submitline-demo.srt"
    filters.append(f"[0:v]drawbox=x=0:y=ih-136:w=iw:h=136:color=0x100f0d@1:t=fill,subtitles=filename='{subtitle_file}':force_style='Fontname=DM Sans,FontSize=15,PrimaryColour=&H00EAF1F4,Outline=0,Shadow=0,Alignment=2,MarginV=24'[vout]")
    filters.append(f"{''.join(tags)}amix=inputs={len(scenes)}:duration=longest:dropout_transition=0,apad=pad_dur=2,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[aout]")
    cmd = [
        FFMPEG, "-hide_banner", "-y", *input_args,
        "-filter_complex", ";".join(filters),
        "-map", "[vout]", "-map", "[aout]",
        "-t", f"{final_duration:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(FINAL),
    ]
    subprocess.run(cmd, check=True)
    print(f"Saved {FINAL} ({duration(FINAL):.2f}s)")


if __name__ == "__main__":
    main()
