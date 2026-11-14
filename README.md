# niconicomments-convert(仮、名称未定)
[[English](https://github.com/xpadev-net/niconicomments-convert/blob/master/README.en.md)]


niconicommentsを使って動画を書き出す簡易ツール(?)です  
適当に作ったのでエラー出たらもう一度起動してやり直してみてください  

## 改善点や要望などについて
頂いたものは可能な限り対応させていただきます  
一応ニコニコ動画関連の5chスレはちょくちょく確認していますが、把握漏れがある可能性もあるので可能であればGitHub上のIssueやTwitterのDMから直接連絡していただけるとありがたいです

## 注意事項
- なにか損害が発生しても一切責任を負いません
- 基本的に見切り発車でリリースするので1日経たないうちに次のリリース出ることが多々あります  
新しいバージョンが出た後は1日くらい様子見てから使うことをおすすめします

## 特徴
- 一時ファイルを使用しないためディスク容量を必要としません
- コメントの描画と変換を並行して行うため処理時間を短縮できます
- 互換性は高いほうだと思います

## 使い方  
→ [チュートリアル](https://github.com/xpadev-net/niconicomments-convert/wiki/%E3%83%81%E3%83%A5%E3%83%BC%E3%83%88%E3%83%AA%E3%82%A2%E3%83%AB)

## 開発者向け
### 起動準備と保存先
- ffmpeg / ffprobe は Electron の `app.getPath("userData")` 配下の `bin` に保存します。
- ログは `app.getPath("logs")` に日付別で保存します。
- 旧バージョンでインストール先に保存したバイナリは移行しないため、更新後の初回起動時は再ダウンロードします。
- 起動準備に失敗した場合は「再試行」「終了」を選択できます。ダウンロード画面を閉じると準備を中止して終了します。

### コマンド
- パッケージマネージャーは `pnpm` を使用します
- 依存関係のインストール: `pnpm install`
- Lint: `pnpm lint`
- 型チェック: `pnpm check-types`
- フロントエンドビルド: `pnpm copy-files`
- Electronビルド: `pnpm build:win` / `pnpm build:mac`

## お願い
なんかいい名前つけてください
