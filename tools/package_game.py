"""Pack the browser game and its design document for an itch.io HTML upload."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

project = Path(__file__).resolve().parents[1]
output = project / 'builds'
output.mkdir(exist_ok=True)
archive = output / 'Back-on-the-Block-web.zip'
files = [project / 'index.html', project / 'style.css', project / 'READ ME.txt']
for folder in ['src', 'assets', 'design']:
    files.extend(path for path in (project / folder).rglob('*') if path.is_file() and path.name != '.DS_Store')
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=9) as package:
    for path in sorted(files):
        package.write(path, path.relative_to(project))
with ZipFile(archive) as package:
    assert package.testzip() is None
    assert 'index.html' in package.namelist()
print(f'Created {archive} ({archive.stat().st_size / 1024:.0f} KB)')
