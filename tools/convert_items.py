"""将 CoC-1920s常用物品表-精简版.xlsx 转换为 backend/public/items.json。

零第三方依赖（zipfile + xml.etree），可重复执行：
    python tools/convert_items.py [xlsx路径] [输出json路径]
"""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_to_index(ref: str) -> int:
    letters = ''
    for ch in ref:
        if ch.isalpha():
            letters += ch
        else:
            break
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch.upper()) - ord('A') + 1)
    return idx - 1


def load_shared_strings(zf: zipfile.ZipFile) -> list:
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    out = []
    for si in root.findall('m:si', NS):
        text = ''.join(
            (t.text or '') for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        )
        out.append(text)
    return out


def read_rows(zf: zipfile.ZipFile, shared: list):
    root = ET.fromstring(zf.read('xl/worksheets/sheet1.xml'))
    sheet_data = root.find('m:sheetData', NS)
    rows = []
    for row in sheet_data.findall('m:row', NS):
        cells = {}
        for c in row.findall('m:c', NS):
            col = col_to_index(c.get('r', ''))
            t = c.get('t')
            v = c.find('m:v', NS)
            if t == 's' and v is not None:
                idx = int(v.text)
                val = shared[idx] if idx < len(shared) else ''
            elif t == 'inlineStr':
                is_el = c.find('m:is', NS)
                val = ''.join(x.text or '' for x in is_el.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')) if is_el is not None else ''
            else:
                val = v.text if v is not None else ''
            cells[col] = (val or '').strip()
        rows.append(cells)
    return rows


def parse_price(raw: str):
    """价格列：数字转 float，空/无法解析返回 None（表示价格自定）。"""
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def convert(xlsx_path: str, out_path: str):
    zf = zipfile.ZipFile(xlsx_path)
    shared = load_shared_strings(zf)
    rows = read_rows(zf, shared)

    # 跳过标题/说明/表头，数据从第 5 行起（表头在第 4 行）
    data_rows = [r for r in rows[4:] if r.get(0)]

    items = []
    seen = set()
    for r in data_rows:
        name = r.get(0, '').strip()
        if not name or name in seen:
            continue  # 去重（表中「防水火柴盒」「50英尺绳索」重复出现）
        seen.add(name)
        items.append({
            'name': name,
            'price': parse_price(r.get(1, '')),
            'category': r.get(2, '') or '—',
            'identify': r.get(3, '') or '—',
            'usage': r.get(4, '') or '',
        })

    payload = {
        'source': 'CoC-1920s常用物品表-精简版.xlsx',
        'updatedAt': datetime.now().strftime('%Y-%m-%d'),
        'count': len(items),
        'items': items,
    }

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    print(f'{len(items)} items -> {out_path}')


if __name__ == '__main__':
    xlsx = sys.argv[1] if len(sys.argv) > 1 else 'CoC-1920s常用物品表-精简版.xlsx'
    out = sys.argv[2] if len(sys.argv) > 2 else 'backend/public/items.json'
    convert(xlsx, out)
