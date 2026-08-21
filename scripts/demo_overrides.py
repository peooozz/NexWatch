"""
NexWatch Demo Overrides & Synthetic Violation Controls
======================================================
Scripted event guarantees for demo footage where the real detector's output
is inconsistent (e.g. borderline lighting, occlusion).

NEVER enable this when measuring real detection accuracy — it fabricates positives.
Default: Disabled (NEXWATCH_DEMO_FORCE_EVENTS=false).
"""
import os

DEMO_FORCE_EVENTS_ENABLED = os.getenv("NEXWATCH_DEMO_FORCE_EVENTS", "false").lower() in ["1", "true", "yes"]

FORCED_HELMET_VIOLATION_IDS = {319, 431, 225, 751}
FORCED_TRIPLE_RIDING = {319: (35, None), 751: (35, None), 338: (80, 350)}  # id: (start_frame, end_frame)
FORCED_WRONG_WAY_IDS = {228, 431}
FORCED_WRONG_WAY_WINDOW = (60, 450)

def is_forced_helmet_violation(track_id: int) -> bool:
    return DEMO_FORCE_EVENTS_ENABLED and track_id in FORCED_HELMET_VIOLATION_IDS

def is_forced_triple_riding(track_id: int, frame_index: int) -> bool:
    if not DEMO_FORCE_EVENTS_ENABLED or track_id not in FORCED_TRIPLE_RIDING:
        return False
    start, end = FORCED_TRIPLE_RIDING[track_id]
    return frame_index > start and (end is None or frame_index < end)

def is_forced_wrong_way(track_id: int, frame_index: int) -> bool:
    if not DEMO_FORCE_EVENTS_ENABLED or track_id not in FORCED_WRONG_WAY_IDS:
        return False
    start, end = FORCED_WRONG_WAY_WINDOW
    return start < frame_index < end
