"""Exercise the upload package validation against isolated manifests."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]

class PackageTests(unittest.TestCase):
    def build(self, subtitle):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        shutil.copytree(ROOT / 'plugins', root / 'plugins')
        shutil.copytree(ROOT / 'scripts' / 'plugin-schemas', root / 'scripts' / 'plugin-schemas')
        shutil.copy(ROOT / 'scripts' / 'package-openai-plugin.py', root / 'scripts')
        manifest_path = root / 'plugins' / 'clipify' / 'plugin.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['extensions']['com.openai']['interface']['shortDescription'] = subtitle
        manifest_path.write_text(json.dumps(manifest))
        output = root / 'package.zip'
        result = subprocess.run([sys.executable, str(root / 'scripts' / 'package-openai-plugin.py'), str(output)], capture_output=True, text=True)
        return result, output

    def test_rejects_subtitle_longer_than_thirty_characters(self):
        result, output = self.build('x' * 31)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())

    def test_accepts_boundary_and_packages_version_one(self):
        result, output = self.build('x' * 30)
        self.assertEqual(result.returncode, 0, result.stderr)
        with ZipFile(output) as archive:
            self.assertEqual(set(archive.namelist()), {'plugin.json', 'mcp.json', 'assets/logo.png'})
            self.assertEqual(json.loads(archive.read('plugin.json'))['version'], '1.0.0')

if __name__ == '__main__':
    unittest.main()
