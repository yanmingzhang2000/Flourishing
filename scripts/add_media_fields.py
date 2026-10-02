#!/usr/bin/env python3
"""
为 canonical-exercise-library.json 批量添加 media 字段
"""
import json
import csv
from pathlib import Path

repo_root = Path(__file__).parent.parent
json_path = repo_root / 'data' / 'canonical-exercise-library.json'
csv_path = repo_root / 'exercise_assets_manifest.csv'
images_dir = repo_root / '素材' / 'images'

print(f'读取 JSON: {json_path}')
with open(json_path, 'r', encoding='utf-8') as f:
    library = json.load(f)

exercises = library['exercises']

print(f'读取 CSV: {csv_path}')
with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    manifest = {row['exercise_id']: row for row in reader}

# 为每个动作添加 media 字段
updated_count = 0
missing_ids = []

for ex in exercises:
    eid = ex['exercise_id']
    cover_file = images_dir / f'{eid}_cover.jpg'
    
    # 只为已下载成功的封面添加字段
    if cover_file.exists():
        ex['media'] = {
            'cover_image': f'./images/{eid}_cover.jpg',
            'video': None  # 视频暂未下载
        }
        updated_count += 1
    else:
        missing_ids.append(eid)

# 写回 JSON (保持可读格式，2空格缩进)
print(f'写入 JSON: {json_path}')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(library, f, ensure_ascii=False, indent=2)

print(f'\n已为 {updated_count}/67 个动作添加 media 字段')
print(f'{len(missing_ids)} 个动作缺失封面，保持原样:')
for mid in missing_ids:
    print(f'  - {mid}')
