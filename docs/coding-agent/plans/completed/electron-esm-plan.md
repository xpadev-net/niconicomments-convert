# Electron メインプロセスの ESM 移行

承認はユーザーの指示により省略。Research waived: ビルド設定、既存のテスト、Electron の仕様を直接確認した。

## Design

Node の ESM 解決を使い、メインの参照先を明示する。バンドル方式は参照の変更を減らせる一方、ネイティブ依存を外部化する設定と配布時の追加検証が必要になる。既存の TypeScript ビルドとスモークテストを活用し、preload はサンドボックス用に CJS で出力する。

## Compatibility stance

preserve。画面の preload API、IPC、設定ファイル、配布用の起動エントリを維持する。

## Planner-added requirements

- None

## Task_1

- type: impl
- owns: package.json, electron/, src/domain/, src/@types/, vite.config.mts, build-script/, tests/
- depends_on: []
- acceptance:
  - メインプロセスが Node の ESM ローダーで解決される。
  - サンドボックスが有効な各ウィンドウに preload が読み込まれる。
  - 既存のテストでメインプロセスの動作を検証できる。
- validation:
  - {kind: test, required: true, owner: orchestrator, detail: 型チェックと既存の回帰テスト}
  - {kind: smoke, required: true, owner: orchestrator, detail: macOS の配布用アプリで起動、IPC、正常終了}

## Task Waves

1. Task_1

## Progress Log

- Task_1 完了。Node 26 と固定依存で型チェック、lint、回帰テスト 259 件、Vite のビルドが成功した。
- Electron 43.8.1 の macOS arm64 配布ビルドと開発用アプリで、起動、画面表示、preload、設定・キュー IPC、正常終了を確認した。配布ビルドは初回起動で FFmpeg と FFprobe を取得した。
- 独立レビューは APPROVED。Windows x64 と macOS x64 での起動は既存の CI 対象。

## Decision Log

- ルートを ESM とし、TypeScript が解決するローカル参照に出力時の拡張子を明記した。
- Electron がサンドボックス内の preload で ESM をサポートしていないため、3 種類のウィンドウで同じ CJS preload を使う。
- Windows 用のオプションネイティブ依存は使用時に読み込む。設定ストアと既存 IPC の形式は維持する。
