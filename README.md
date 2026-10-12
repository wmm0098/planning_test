# 프렙 카페

EPIC 1~3의 판매·비용 관리, 메뉴 수익성, 일·월 손익, 재고 입고·폐기·실측·잔량 조회, 전체 JSON 백업·복원을 구현했습니다. EPIC 1은 사용자 확인, EPIC 2·3은 사용자의 검수 위임에 따른 자동·실제 브라우저 검사로 완료했습니다. GitHub 보관은 완료했으며 Vercel 운영 배포가 남아 있습니다. 저장소는 [wmm0098/planning_test](https://github.com/wmm0098/planning_test), 기본 브랜치는 `main`입니다.

## 로컬 실행

Node.js 24.x 환경에서 실행합니다. 현재 컴퓨터의 기본 Node.js가 구버전일 수 있으므로 `node --version`을 확인하세요.

```sh
npm ci
npm run dev
```

주소는 `http://127.0.0.1:5173/`입니다. 브라우저 IndexedDB에 자료를 저장하므로 같은 주소와 브라우저 프로필을 사용하세요. 최초에 가상 샘플이 반영됩니다. 사이트 데이터 삭제 시 기록이 없어지며, 전체 백업 JSON을 주기적으로 내려받아 외부에 보관하세요. 운영 배포 전 로컬 확인에는 가상 기록을 사용합니다.

## 검사

```sh
npm run test -- --run
npm run typecheck
npm run test:e2e
npm run build
npm run test:production
```

브라우저 검사는 설치된 Google Chrome과 별도 임시 프로필을 사용합니다. 검사에는 실제 다운로드·전체 복원·저장 실패·다른 창 충돌·손상 자료 복구를 포함합니다. 사용자 요청에 따라 EPIC 2·3 검수는 담당자가 수행했습니다.

요구사항·개발 계획·검사 결과는 `docs` 폴더에 있습니다. 실제 운영 기록·백업·비밀값은 GitHub에 올리지 않습니다. 이번 단계에서는 Vercel 배포를 진행하지 않았습니다.
