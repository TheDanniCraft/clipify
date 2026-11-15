"""Write the SDK artifact with stable archive metadata, independent of Bun versions."""
import gzip
import io
import sys
import tarfile
from pathlib import Path

sdk = Path(sys.argv[1])
output = Path(sys.argv[2])
with output.open("wb") as target:
    with gzip.GzipFile(fileobj=target, mode="wb", filename="", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT) as archive:
            for name in ["README.md", "dist/index.d.ts", "dist/index.js", "package.json"]:
                data = (sdk / name).read_bytes()
                entry = tarfile.TarInfo(f"package/{name}")
                entry.size = len(data)
                entry.mode = 0o644
                entry.mtime = 0
                entry.uid = entry.gid = 0
                entry.uname = entry.gname = ""
                archive.addfile(entry, io.BytesIO(data))
