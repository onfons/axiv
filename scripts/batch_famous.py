#!/usr/bin/env python3
"""수집된 유명 유튜버 184개 영상을 batch_save.py로 처리"""
import json, subprocess, sys, os

# URL 목록 로드
with open('/home/ubuntu/projects/axiv/scripts/famous_creator_urls.json', 'r') as f:
    urls = json.load(f)

print(f"📊 총 {len(urls)}개 영상 처리 시작\n")

# 10개씩 배치로 처리
batch_size = 10
total = len(urls)
success_count = 0

for i in range(0, total, batch_size):
    batch = urls[i:i+batch_size]
    print(f"🔄 배치 {(i//batch_size)+1}/{(total-1)//batch_size + 1}: {len(batch)}개 처리 중...")
    
    try:
        # batch_save.py 실행
        result = subprocess.run(
            [sys.executable, 'scripts/batch_save.py'] + batch,
            capture_output=True, text=True, timeout=240
        )
        
        if result.returncode == 0:
            success_count += len(batch)
            print(f"   ✅ 성공 ({len(batch)}개)")
        else:
            print(f"   ⚠️ 오류: {result.stderr[:100] if result.stderr else '알 수 없음'}")
        
        print(f"   stdout: {result.stdout[-200:] if result.stdout else '없음'}")
        
    except subprocess.TimeoutExpired:
        print(f"   ⏱️ 타임아웃 (240초)")
    except Exception as e:
        print(f"   ❌ 예외: {e}")

print(f"\n{'='*50}")
print(f"✅ 완료: {success_count}/{total}개 영상 처리 완료")
print(f"📈 성공률: {success_count/total*100:.1f}%")
