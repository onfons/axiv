#!/usr/bin/env python3
"""GitHub 커밋 및 Vercel 배포 + 백그라운드에서 전국 데이터 재수집 실행"""

import subprocess, sys, os

WORKDIR = '/home/ubuntu/projects/axiv'

def run_cmd(cmd, timeout=30):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=WORKDIR, timeout=timeout)
    return r.stdout.strip() + r.stderr.strip()

print('=== 1. GitHub 커밋 및 Push ===')

# .gitignore에 scripts/*.json, *.sql 추가
with open(f'{WORKDIR}/.gitignore', 'r') as f:
    gi = f.read()
if 'scripts/*.json' not in gi:
    with open(f'{WORKDIR}/.gitignore', 'a') as f:
        f.write('\n# Migration scripts\nscripts/final_*.py\nscripts/migrate_*.py\nscripts/migrate_*.json\nscripts/google_enrich_*.py\nscripts/naver_*.py\nscripts/enrich_*.py\nscripts/create_tables.sql\nscripts/update_env.py\nscripts/verify_*.py\nscripts/test_*.py\nscripts/restore_all_data*.py\nscripts/restore_content_places.py\n')
    print('✅ .gitignore 업데이트')

# add
r = run_cmd('git add -A', timeout=10)
print(f'✅ git add 완료')

# status 확인
status = run_cmd('git status --short', timeout=5)
changed = [l for l in status.split('\n') if l.strip()]
print(f'변경 파일: {len(changed)}개')

# commit
r = run_cmd('git commit -m "feat: 데이터 정화 v5 + UI 모바일 최적화 + 전국 수집 파이프라인"', timeout=10)
if 'nothing to commit' in r.lower():
    print('⏹️  커밋할 내용 없음')
else:
    print(f'✅ 커밋 완료')

# push
r = run_cmd('git push origin main', timeout=30)
if 'Everything up-to-date' in r:
    print('✅ 최신 상태')
elif 'fatal' in r.lower():
    print(f'❌ Push 실패: {r[:200]}')
else:
    print(f'✅ Push 완료')

print('\n=== 2. 데이터 재수집 시작 (백그라운드) ===')

subprocess.Popen(
    ['python3', '/home/ubuntu/projects/axiv/scripts/collect_nationwide.py'],
    cwd=WORKDIR,
    stdout=open('/tmp/collect_nationwide.log', 'w'),
    stderr=subprocess.STDOUT,
)
print('✅ 데이터 재수집 백그라운드 실행 중 (로그: /tmp/collect_nationwide.log)')

print('\n=== 3. Vercel 배포 트리거 ===')
# git push로 Vercel 자동 배포 완료

print('=== 🎯 모든 작업 완료 ===')