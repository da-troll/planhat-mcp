"""Runs before any test module imports planhat_mcp.

The token must be in os.environ before the module loads: load_dotenv() does not
override existing env vars, so this keeps a developer's real .env token out of
the test run (and makes the suite work in CI, where no .env exists at all).
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("PLANHAT_TOKEN", "test-token")
