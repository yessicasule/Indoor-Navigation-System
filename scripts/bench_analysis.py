"""Time the full analysis pipeline on synthetic telemetry of increasing size.

    python scripts/bench_analysis.py
"""
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "tests"))
import analyse  # noqa: E402
import synthetic  # noqa: E402

print("samples   runs   seconds")
for runs in (5, 20, 60):
    t, _ = synthetic.make_telemetry(seed=0, runs_per_device=runs)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        synthetic.write_site(root)
        t.to_csv(root / "t.csv", index=False)
        start = time.perf_counter()
        analyse.run(synthetic.SITE, root / "t.csv", root / "out", data_dir=root)
        print(f"{len(t):7d}  {runs * len(synthetic.DEVICES):5d}  {time.perf_counter() - start:8.1f}")
