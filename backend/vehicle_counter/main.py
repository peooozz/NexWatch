"""CLI entry point for vehicle counting on images and video streams."""

import argparse
import json
import logging
from pathlib import Path
from src.config import DEFAULT_CONF_THRESHOLD, DEFAULT_MODEL_WEIGHTS
from src.image_counter import ImageVehicleCounter
from src.video_counter import VideoVehicleCounter

logging.basicConfig(level=logging.INFO, format="%(asctime)s - [%(levelname)s] - %(message)s")


def main():
    parser = argparse.ArgumentParser(description="Accurate YOLO-based Vehicle Counter")
    parser.add_argument("--mode", type=str, required=True, choices=["image", "video"],
                        help="Mode of operation: 'image' or 'video'")
    parser.add_argument("--source", type=str, required=True,
                        help="Path to input image or video file")
    parser.add_argument("--output", type=str, default=None,
                        help="Path to save output annotated file")
    parser.add_argument("--weights", type=str, default=DEFAULT_MODEL_WEIGHTS,
                        help="YOLO model checkpoint name or path (default: yolo11m.pt)")
    parser.add_argument("--conf", type=float, default=DEFAULT_CONF_THRESHOLD,
                        help="Confidence threshold (default: 0.40)")
    parser.add_argument("--display", action="store_true",
                        help="Show live OpenCV rendering window during video execution")

    args = parser.parse_args()

    input_path = Path(args.source)
    if not input_path.exists():
        logging.error(f"Input path does not exist: {args.source}")
        return

    if args.mode == "image":
        output_path = args.output or f"outputs/images/{input_path.stem}_counted{input_path.suffix}"
        counter = ImageVehicleCounter(model_path=args.weights, conf_threshold=args.conf)
        total, breakdown = counter.count_vehicles(image_path=str(input_path), output_path=output_path)

        print("\n--- Detection Results ---")
        print(f"Total Vehicles: {total}")
        print(f"Breakdown: {json.dumps(breakdown, indent=2)}")
        print(f"Output saved to: {output_path}")

    elif args.mode == "video":
        output_path = args.output or f"outputs/videos/{input_path.stem}_tracked.mp4"
        counter = VideoVehicleCounter(model_path=args.weights, conf_threshold=args.conf)
        total_unique, breakdown = counter.process_video(
            video_path=str(input_path),
            output_path=output_path,
            display=args.display,
        )

        print("\n--- Tracking Summary ---")
        print(f"Total Unique Vehicles: {total_unique}")
        print(f"Breakdown: {json.dumps(breakdown, indent=2)}")
        print(f"Annotated Video saved to: {output_path}")


if __name__ == "__main__":
    main()
