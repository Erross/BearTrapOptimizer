"""Apply reviewed terminology after updating translation catalogs.

Catalogs are static source-controlled UI copy, never translations of user data.
The TSV columns are English, Turkish, French, German, Danish, Spanish, Portuguese.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ['en', 'tr', 'fr', 'de', 'da', 'es', 'pt']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--languages', nargs='+', choices=LANGUAGES, default=LANGUAGES)
    selected = parser.parse_args().languages
    overrides = []
    for line in (ROOT / 'scripts/i18n-overrides.tsv').read_text().splitlines():
        if not line.strip():
            continue
        row = line.split('\t')
        if len(row) != len(LANGUAGES) or any(not cell for cell in row):
            raise ValueError('Each override needs seven nonempty columns: ' + row[0])
        overrides.append(row)
    for i, lang in enumerate(LANGUAGES):
        if lang not in selected:
            continue
        path = ROOT / 'web/locales' / (lang + '.json')
        messages = json.loads(path.read_text())
        # The draft model treated a leading sentence separator as dialogue.
        # Remove only its known spurious prefix on those source fragments.
        draft_prefixes = {
            'tr': '- Evet . ', 'fr': '- Je ne sais pas . ',
            'de': '- Ich weiß nicht . ', 'da': '- Jeg er ikke sikker. ',
            'es': '- ¿ Qué ? ', 'pt': '- Não . ',
        }
        prefix = draft_prefixes.get(lang)
        if prefix:
            for key, value in list(messages.items()):
                if key.startswith('. ') and value.startswith(prefix):
                    messages[key] = '. ' + value[len(prefix):]
        for row in overrides:
            messages[row[0]] = row[i]
        # Apply reviewed numeric templates to matching literal labels too.
        for row in overrides:
            ids = re.findall(r'\{(\d+)\}', row[0])
            if not ids:
                continue
            pattern = re.escape(row[0])
            for ident in set(ids):
                pattern = pattern.replace(re.escape('{' + ident + '}'), r'(\d+)')
            for key in list(messages):
                match = re.fullmatch(pattern, key)
                if match:
                    value = row[i]
                    for ident, number in zip(ids, match.groups()):
                        value = value.replace('{' + ident + '}', number)
                    messages[key] = value
        # Restore punctuation unsupported by the offline draft tokenizer.
        for key, value in list(messages.items()):
            if '⁇' not in value:
                continue
            punctuation = set(re.findall(r'[–—’“”→↑↓…]', key))
            if punctuation and punctuation <= {'“', '”'}:
                count = 0
                def quote(_):
                    nonlocal count
                    count += 1
                    return '“' if count % 2 else '”'
                value = re.sub('⁇', quote, value)
            elif len(punctuation) == 1:
                value = value.replace('⁇', next(iter(punctuation)))
            else:
                # Prefer the exact English message to corrupted punctuation.
                value = key
            messages[key] = value
        # Keep reviewed labels consistent when a draft retained English inside
        # a longer sentence. Source text is static UI copy, never player data.
        for row in sorted(overrides, key=lambda row: -len(row[0])):
            if row[i] == row[0] or re.search(r'[{}]', row[0]):
                continue
            pattern = re.compile(r'(?<![A-Za-z])' + re.escape(row[0]) + r'(?![A-Za-z])')
            for key, value in list(messages.items()):
                if row[0] in key and row[0] in value:
                    messages[key] = pattern.sub(lambda _: row[i], value)
        path.write_text(json.dumps(dict(sorted(messages.items())), ensure_ascii=False, indent=2) + '\n')
        print(lang, len(messages), 'messages')


if __name__ == '__main__':
    main()
