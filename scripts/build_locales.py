"""Apply reviewed terminology after updating translation catalogs.

Catalogs are static source-controlled UI copy, never translations of user data.
The TSV columns are English, Turkish, French, German, Danish, Spanish, Portuguese.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ['en', 'tr', 'fr', 'de', 'da', 'es', 'pt']


def main():
    overrides = []
    for line in (ROOT / 'scripts/i18n-overrides.tsv').read_text().splitlines():
        if not line.strip():
            continue
        row = line.split('\t')
        if len(row) != len(LANGUAGES) or any(not cell for cell in row):
            raise ValueError('Each override needs seven nonempty columns: ' + row[0])
        overrides.append(row)
    for i, lang in enumerate(LANGUAGES):
        path = ROOT / 'web/locales' / (lang + '.json')
        messages = json.loads(path.read_text())
        for row in overrides:
            messages[row[0]] = row[i]
        path.write_text(json.dumps(dict(sorted(messages.items())), ensure_ascii=False, indent=2) + '\n')
        print(lang, len(messages), 'messages')


if __name__ == '__main__':
    main()
