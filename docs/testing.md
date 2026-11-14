# 実行時契約の検証

`pnpm test` はElectron側をローカルのTypeScriptでコンパイルしてから、
`tests/*.test.cjs` をすべて実行します。

- `runtime-contract.test.cjs`: 実際のrenderer・IPC dispatcher・queue・ConversionSessionを接続し、連続ジョブの直列実行、終了通知とFFmpeg終了の順序、描画失敗の伝播、中断後の復旧を確認します。OSウィンドウ、Canvas、ファイル入力、FFmpeg backendはテスト用に置き換えます。
- `renderer-timeline.test.cjs`: 実際のniconicommentsライブラリとアプリのrendererを実行し、コメントのあるフレームを描画し、空のフレームでは空画像を再利用することを確認します。
- session・queue・renderer・processの各テストは、フレームの順序、遅延した通知、プロセス失敗、ストリーム破棄などの詳細を検証します。

CIではLinuxに加え、配布対象のWindows x64とmacOS x64でも回帰テストを実行します。
その後、`electron-builder --dir` で作成したアプリを起動し、ビルド済み画面の表示、
preload API、設定の読み書きとキューのIPC、ウィンドウを閉じた後の正常終了を確認します。
開発サーバーや起動処理のモックは使用しません。初回起動では実際にFFmpeg/FFprobeを
ダウンロードするためネットワーク接続が必要です。起動の制限時間は120秒です。

同じ確認を対象OS上で行う場合:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm copy-files
# Windows
pnpm exec electron-builder --dir --win --x64 --publish never
pnpm test:smoke dist/win-unpacked/niconicomments-convert.exe
# macOS (署名用証明書がない場合はCSC_IDENTITY_AUTO_DISCOVERY=falseを設定)
pnpm exec electron-builder --dir --mac --x64 --publish never
pnpm test:smoke dist/mac/niconicomments-convert.app/Contents/MacOS/niconicomments-convert
```

スモークテストは一時的なユーザーデータディレクトリを使い、終了時に削除します。
起動時のダウンロード先はアプリの通常の保存先（生成した配布ディレクトリ内）です。
インストーラー、コード署名、実動画の変換結果はこのスモークテストの対象外です。
