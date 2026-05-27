#!/usr/bin/env python3
"""샘플 20개 영상 meta/llama-3.1-70b-instruct로 처리"""
import json, subprocess, sys, os

# URL 목록 로드
with open('/home/ubuntu/projects/axiv/scripts/famous_creator_urls.json', 'r') as f:
    all_urls = json.load(f)

sample = all_urls[:20]
print(f"📊 샘플 {len(sample)}개 처리 시작 (모델: meta/llama-3.1-70b-instruct)\n")

success = 0
failed = 0
total_places = 0

for i, url in enumerate(sample):
    print(f"🔄 [{i+1}/{len(sample)}] 처리 중...")
    try:
        result = subprocess.run(
            [sys.executable, 'scripts/batch_save.py', url],
            capture_output=True, text=True, timeout=300,  # 5분
            env={**os.environ, 'NVIDIA_MODEL': 'meta/llama-3.1-70b-instruct'}
        )
        
        output = result.stdout
        if "저장:" in output:
            # 장소 수 추출
            import re
            match = re.search(r'저장:\s*(\d+)\s*곳', output)
            places = int(match.group(1)) if match else 0
            total_places += places
            print(f"   ✅ 성공 ({places}개 장소)")
            success += 1
        else:
            print(f"   ⚠️ 저장 정보 없음")
            failed += 1
    except subprocess.TimeoutExpired:
        print(f"   ⏱️ 타임아웃 (300초)")
        failed += 1
    except Exception as e:
        print(f"   ❌ 예외: {e}")
        failed += 1

print(f"\n{'='*50}")
print(f"✅ 완료: {success}/{len(sample)}개 성공")
print(f"❌ 실패: {failed}개")
print(f"📊 총 장소: {total_places}개")
print(f"📈 성공률: {success/len(sample)*100:.1f}%")
