"""
Self-contained Ingest Test Harness:
Starts Uvicorn FastAPI in a background thread and runs the full test suite.
"""

import sys
import time
import threading
import asyncio
import uvicorn
from pathlib import Path

# Ensure root directory is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.main import app
from scripts.test_push_ingest import run_tests

class ServerThread(threading.Thread):
    def __init__(self, app, host="127.0.0.1", port=8000):
        super().__init__(daemon=True)
        self.config = uvicorn.Config(app=app, host=host, port=port, log_level="warning")
        self.server = uvicorn.Server(self.config)

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True

def main():
    print("Starting in-process FastAPI server on 127.0.0.1:8000 for verification...")
    server = ServerThread(app=app, host="127.0.0.1", port=8000)
    server.start()
    time.sleep(2.5)  # Wait for server startup

    try:
        success = asyncio.run(run_tests())
        print(f"\nFinal Test Result: {'SUCCESS (PASS)' if success else 'FAILED'}")
    finally:
        print("Stopping test server...")
        server.stop()
        time.sleep(0.5)

if __name__ == "__main__":
    main()
