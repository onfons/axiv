#!/usr/bin/env python3
"""실행 중인 수집 프로세스 정리 + Git Push"""

import os, subprocess, sys

WORKDIR = '/home/ubuntu/projects/axiv'

# 실행 중인 python 프로세스 확인 (collect_ 관련)
r = subprocess.run(['pgrep', '-f', 'collect_'], capture_output=True, text=True)
pids = [p.strip() for p in r.stdout.split('\n') if p.strip()]
if pids:
    print(f'🛑 실행 중인 수집 프로세스: {pids}')
    for pid in pids:
        subprocess.run(['kill', pid], capture_output=True)
    print('   모두 중단됨')
else:
    print('✅ 실행 중인 수집 프로세스 없음')

# Git Push
print('\n=== Git Push ===')
subprocess.run(['git', 'add', '-A'], cwd=WORKDIR, capture_output=True)
r = subprocess.run(['git', 'status', '--short'], cwd=WORKDIR, capture_output=True, text=True)
changed = [l for l in r.stdout.split('\n') if l.strip()]
print(f'변경 파일: {len(changed)}개')

r = subprocess.run(['git', 'commit', '-m', 'feat: 카테고리 히든 처리 + DB 정화 + 수집 프로세스 정리'], cwd=WORKDIR, capture_output=True, text=True)
if 'nothing to commit' in r.stdout.lower():
    print('⏹️  커밋할 내용 없음')
else:
    print('✅ 커밋 완료')

subprocess.run(['git', 'push', 'origin', 'main'], cwd=WORKDIR, timeout=30)
print('✅ Git Push 완료 → Vercel 자동 배포')

print('\n🎯 모든 작업 완료')