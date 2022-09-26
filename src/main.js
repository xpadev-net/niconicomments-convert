
let commentData = null,duration = null, nico = null, useLegacy = false, showFPS = false,
  showCollision = false, showCommentCount = false, keepCA=false,offset=0,generatedFrames = 0,convertedFrames = 0,totalFrames = 0,scale=1;
const fps = 30;
document.getElementById("movie").onclick = () => {
  window.api.request({type:"selectMovie"})
}
document.getElementById("commentData").onclick = () => {
  window.api.request({type:"selectComment"})
}
document.getElementById("start").onclick = () => {
  window.api.request({type:"start"});
}
document.getElementById("show-fps").onchange = (e) => {
  showFPS = !showFPS;
  e.target.checked = showFPS;
}
document.getElementById("show-collision").onchange = (e) => {
  showCollision = !showCollision;
  e.target.checked = showCollision;
}
document.getElementById("show-comment-count").onchange = (e) => {
  showCommentCount = !showCommentCount;
  e.target.checked = showCommentCount;
}
document.getElementById("use-legacy").onchange = (e) => {
  useLegacy = !useLegacy;
  e.target.checked = useLegacy;
}
document.getElementById("keep-ca").onchange = (e) => {
  keepCA = !keepCA;
  e.target.checked = keepCA;
}
document.getElementById("scale").onchange = (e) => {
  scale = e.target.value;
}
window.api.onResponse((data)=>{
  console.log(data);
  if (data.type === "selectMovie"){
    document.getElementById("movieMessage").innerText=data.message;
    duration = data.data?.duration || null;
  }else if (data.type === "selectComment"){
    commentData = data.data;
    document.getElementById("commentMessage").innerText=`${data.data.length}スレッド`;
  }else if (data.type === "progress"){
    convertedFrames = data.current;
    document.getElementById("progress").innerText=`generate: ${generatedFrames} / ${totalFrames}\n convert: ${convertedFrames} / ${totalFrames}`;
  }else if (data.type === "start"){
    document.body.style.pointerEvents="none";
    const canvas = document.getElementById("canvas");
    nico = new NiconiComments(canvas, commentData, {
      useLegacy:useLegacy,
      keepCA:keepCA,
      format:"v1",
      scale:Number(scale)
    });
    generatedFrames = convertedFrames = 0;
    totalFrames = Math.ceil(duration*fps);
    const process = async() => {
      document.getElementById("progress").innerText=`generate: ${generatedFrames} / ${totalFrames}\n convert: ${convertedFrames} / ${totalFrames}`;
      let buffer = [];
      for (let i = 0; i < fps; i++){
        console.log(i);
        nico.drawCanvas(Math.ceil(i*(100/fps))+offset);
        buffer.push(canvas.toDataURL("image/png"));
        generatedFrames++;
        if (generatedFrames >= totalFrames){
          window.api.request({type:"buffer",data:buffer});
          window.api.request({type:"end"})
          return;
        }
      }
      window.api.request({type:"buffer",data:buffer});
      offset+=100;
      while (generatedFrames-convertedFrames>200){
        await sleep(100);
      }
      setTimeout(process,0);
    }
    process()
  }
})
const sleep = (time) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};