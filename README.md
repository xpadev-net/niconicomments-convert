# niconicomments-convert(仮、名称未定)
niconicommentsを使って動画を書き出す簡易ツール(?)です  
適当に作ったのでエラー出たらもう一度起動してやり直してみてください  

## 注意事項
- もう一度出力したい/別の動画を出色したい場合は再起動してください
- なにか損害が発生しても一切責任を負いません
- めっちゃ変換遅いです

## 使い方  
- コメントデータを入手  
丹波津さんのコメント増量(未リリースの最新版)からコメントをダウンロードすると多分楽です  
v1 apiのレスポンスの内、data.threads以下の配列をJSONとして渡してください  
- 動画データを入手  
簡単：httpでシステムメッセージからダウンロード  
面倒：yt-dlpとかでダウンロード(アニメとかはこっち)  
- 動画とコメントを選択してオプションセットして変換  
多分niconicommentsのドキュメントかサンプルを見るか丹波津さんのコメント増量を使うかすればオプションの意味はわかると思う

## お願い
なんかいい名前つけてください