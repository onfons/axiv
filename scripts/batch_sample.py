#!/usr/bin/env python3
"""샘플 20개 영상 batch_save.py 처리"""
import json, subprocess, sys, os

# URL 목록 로드
with open('/home/ubuntu/projects/axiv/scripts/famous_creator_urls.json', 'r') as f:
    urls = json.load(f)

# 샘플 20개
sample = urls[:20]
print(f"📊 샘플 {len(sample)}개 처리 시작\n")

results = {
    'total': 0,
    'success': 0,
    'failed': 0,
    'places': []
}

for i, url in enumerate(sample):
    print(f"🔄 [{i+1}/{len(sample)}] 처리 중: {url}")
    try:
        result = subprocess.run(
            [sys.executable, 'scripts/batch_save.py', url],
            capture_output=True, text=True, timeout=240
        )
        
        if result.returncode == 0:
            results['success'] += 1
            # 장소 수 파악
            output = result.stdout
            if "저장: " in output:
                parts = output.split("저장: ")
                if len(parts) > 1:
                    place_count = parts[1].split("곳")[0]
                    print(f"   ✅ 성공 ({place_count}개 장소)")
                else:
                    print(f"   ✅ 성공")
            else:
                print(f"   ✅ 성공")
        else:
            results['failed'] += 1
            print(f"   ❌ 실패: {result.stderr[:100]}")
        
        results['total'] += 1
        
    except subprocess.TimeoutExpired:
        results['failed'] += 1
        print(f"   ⏱️ 타임아웃 (240초)")
    except Exception as e:
        results['failed'] += 1
        print(f"   ❌ 예외: {e}")

print(f"\n{'='*50}")
print(f"✅ 완료: {results['success']}/{results['total']}개 성공")
print(f"❌ 실패: {results['failed']}개")
print(f"📈 성공률: {results['success']/results['total']*100:.1f}%")
