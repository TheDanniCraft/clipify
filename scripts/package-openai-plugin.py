"""Validate Clipify's portable manifests and create an uploadable ZIP."""

import json
from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile

from jsonschema import Draft202012Validator


root = Path(__file__).resolve().parents[1]
package = root / "plugins" / "clipify"
for name in ("plugin", "mcp"):
    schema = json.loads((root / "scripts" / "plugin-schemas" / f"{name}.schema.json").read_text())
    document = json.loads((package / f"{name}.json").read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(document)

manifest = json.loads((package / "plugin.json").read_text())
interface = manifest["extensions"]["com.openai"]["interface"]
if len(interface["shortDescription"]) > 30:
    raise ValueError("OpenAI subtitle must be 30 characters or fewer")
for field in ("websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"):
    if not interface[field].startswith("https://"):
        raise ValueError(f"{field} must use HTTPS")
for field in ("composerIcon", "logo"):
    asset = (package / interface[field]).resolve()
    if not asset.is_relative_to(package.resolve()) or not asset.is_file():
        raise ValueError(f"Invalid packaged asset: {field}")

output = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "dist" / "clipify-openai-plugin.zip"
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for name in ("plugin.json", "mcp.json", "assets/logo.png"):
        archive.write(package / name, name)
    if archive.testzip() is not None:
        raise ValueError("ZIP integrity check failed")
print(f"Validated and packaged: {output}")
