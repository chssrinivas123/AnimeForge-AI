from __future__ import annotations

import json
import os
import subprocess
import uuid
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = BACKEND_ROOT.parent
GODOT_PROJECT_DIR = REPOSITORY_ROOT / "godot"
GENERATED_SCENES_DIR = BACKEND_ROOT / "generated_scenes"
GENERATOR_SCRIPT = "res://scripts/generate_battle_scene.gd"
GENERATION_TIMEOUT_SECONDS = 180


class GodotRunnerError(RuntimeError):
    pass


def get_godot_executable() -> Path:
    executable = os.getenv("GODOT_EXECUTABLE")
    if not executable:
        raise GodotRunnerError("GODOT_EXECUTABLE is not configured.")

    path = Path(executable).expanduser()
    if not path.is_file():
        raise GodotRunnerError("The configured Godot executable is unavailable.")
    return path.resolve()


def get_scene_path(job_id: str, generated_root: Path = GENERATED_SCENES_DIR) -> Path:
    try:
        safe_job_id = str(uuid.UUID(job_id))
    except (ValueError, AttributeError) as error:
        raise GodotRunnerError("Invalid generation job ID.") from error

    root = generated_root.resolve()
    scene_path = (root / safe_job_id / "battlefield.tscn").resolve()
    if not scene_path.is_relative_to(root):
        raise GodotRunnerError("Invalid generated scene location.")
    return scene_path


def run_godot_scene(
    job_id: str,
    prompt: str,
    generated_root: Path = GENERATED_SCENES_DIR,
) -> Path:
    executable = get_godot_executable()
    scene_path = get_scene_path(job_id, generated_root)
    output_dir = scene_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    input_path = output_dir / "request.json"
    payload: dict[str, Any] = {
        "job_id": str(uuid.UUID(job_id)),
        "prompt": prompt,
        "output_dir": str(output_dir),
    }

    try:
        input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        command = [
            str(executable),
            "--headless",
            "--path",
            str(GODOT_PROJECT_DIR),
            "--script",
            GENERATOR_SCRIPT,
            "--",
            "--input",
            str(input_path),
        ]
        result = subprocess.run(
            command,
            cwd=GODOT_PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=GENERATION_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise GodotRunnerError("Godot scene generation timed out.") from error
    except OSError as error:
        raise GodotRunnerError("Could not start Godot scene generation.") from error
    finally:
        input_path.unlink(missing_ok=True)

    if result.returncode != 0:
        raise GodotRunnerError(f"Godot scene generation exited with code {result.returncode}.")
    if not scene_path.is_file():
        raise GodotRunnerError("Godot completed without creating the expected scene.")
    return scene_path
