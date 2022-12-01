const init = () => {
  document.body.innerHTML = `
<div class="wrapper">
<div class="container">
<p>必要なファイルをダウンロードしています...</p>
<p>環境によっては5分ほどかかる場合があります</p>
</div>
</div>
<style>
*{
margin: 0;padding: 0;
}
  .wrapper{
    position: fixed;
    top: 50vh;
    left: 50vw;
    user-select: none;
  }
  .container{
    transform: translate(-50%,-50%);
    width: 100vw;
    text-align: center;
  }</style>`;
};
if (window.location.search === "?downloader") {
  init();
}
export {};
