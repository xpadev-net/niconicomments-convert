import { typeGuard } from "./typeGuard";

const init = () => {
  document.body.innerHTML = `
<div id="movieInput">
  <button id="movie">動画を選択</button>
  <p id="movieMessage"></p>
</div>
<div id="commentInput">
  <button id="commentData">コメントデータを選択</button>
  <p id="commentMessage"></p>
</div>
<div id="startInput">
  <button id="start">変換開始</button>
</div>
<div id="progress">
  <div>
    generate:
    <span id="genProgress" class="progress"></span>
  </div>
  <div>
    convert:
    <span id="conProgress" class="progress"></span>
  </div>
</div>
<div id="options">
  <label>
    <input type="checkbox" name="show-collision" id="show-collision" autocomplete="off">
    当たり判定表示
  </label>
  <label>
    <input type="checkbox" name="show-comment-count" id="show-comment-count" autocomplete="off">
    コメント数表示
  </label>
  <label>
    <input type="checkbox" name="use-legacy" id="use-legacy" autocomplete="off">
    ニコ動互換モード
  </label>
  <label>
    <input type="checkbox" name="keep-ca" id="keep-ca" autocomplete="off">
    CA衝突回避
  </label>
  <label>
    コメントサイズ(%)
    <input type="number" name="scale" id="scale" autocomplete="off" value="1" step="0.01">
  </label>
  <label>
    FPS
    <input type="number" name="scale" id="fps" autocomplete="off" value="30" step="1">
  </label>
</div><style>
  #options label{
    display: inline-block;
  }
  #options label:hover{
    background-color: #ccc;
  }
  #progress > div{
    display: flex;
    flex-direction: row;
  }
  .progress{
    width: 100%;
    height: 20px;
    border: 1px black solid;
    display: inline-block;
    color: white;
  }</style>`;
  let duration: number = 0,
    useLegacy = false,
    showCollision = false,
    showCommentCount = false,
    keepCA = false,
    totalFrames = 0,
    scale = 1,
    fps = 30;
  const movieButton = document.getElementById("movie"),
    commentDataButton = document.getElementById("commentData"),
    startButton = document.getElementById("start"),
    collisionInput = document.getElementById(
      "show-collision"
    ) as HTMLInputElement,
    commentCountInput = document.getElementById(
      "show-comment-count"
    ) as HTMLInputElement,
    legacyInput = document.getElementById("use-legacy") as HTMLInputElement,
    keepCAInput = document.getElementById("keep-ca") as HTMLInputElement,
    scaleInput = document.getElementById("scale") as HTMLInputElement,
    fpsInput = document.getElementById("fps") as HTMLInputElement,
    movieMessage = document.getElementById("movieMessage"),
    commentMessage = document.getElementById("commentMessage"),
    genProgress = document.getElementById("genProgress"),
    conProgress = document.getElementById("conProgress");

  if (
    !(
      movieButton &&
      commentDataButton &&
      startButton &&
      collisionInput &&
      commentCountInput &&
      legacyInput &&
      keepCAInput &&
      scaleInput &&
      movieMessage &&
      commentMessage &&
      genProgress &&
      conProgress
    )
  )
    throw new Error();

  movieButton.onclick = () => {
    window.api.request({
      type: "selectMovie",
      host: "main",
    });
  };
  commentDataButton.onclick = () => {
    window.api.request({
      type: "selectComment",
      host: "main",
    });
  };
  startButton.onclick = () => {
    window.api.request({
      type: "start",
      host: "main",
      data: {
        useLegacy,
        showCollision,
        showCommentCount,
        keepCA,
        scale,
      },
      fps,
    });
  };
  collisionInput.onchange = (_) => {
    showCollision = !showCollision;
    collisionInput.checked = showCollision;
  };
  commentCountInput.onchange = (_) => {
    showCommentCount = !showCommentCount;
    commentCountInput.checked = showCommentCount;
  };
  legacyInput.onchange = (_) => {
    useLegacy = !useLegacy;
    legacyInput.checked = useLegacy;
  };
  keepCAInput.onchange = (_) => {
    keepCA = !keepCA;
    keepCAInput.checked = keepCA;
  };
  scaleInput.onchange = (_) => {
    scale = Number(scaleInput.value);
  };
  fpsInput.onchange = (_) => {
    fps = Number(fpsInput.value);
  };
  window.api.onResponse((data) => {
    console.log(data);
    if (data.target !== "main") return;
    if (typeGuard.main.selectMovie(data)) {
      movieMessage.innerText = data.message;
      duration = data.data?.duration || 0;
    } else if (typeGuard.main.selectComment(data)) {
      commentMessage.innerText = `${data.data.length}スレッド`;
    } else if (typeGuard.main.progress(data)) {
      progress(genProgress, data.generated, totalFrames);
      progress(conProgress, data.converted, totalFrames);
    } else if (typeGuard.main.start(data)) {
      document.body.style.pointerEvents = "none";
      totalFrames = Math.ceil(duration * fps);
    } else {
    }
  });
  const progress = (element: HTMLElement, current: number, max: number) => {
    element.innerText = `${Math.floor(
      (current / max) * 100
    )}% (${current}/${max})`;
    element.style.background = `linear-gradient(90deg,#006400 0%,#006400 ${
      (current / max) * 100
    }%,#000000 ${(current / max) * 100}%,#000000 100%)`;
  };
};
if (window.location.search === "") {
  init();
}
