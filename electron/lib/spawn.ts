import * as child_process from "child_process";

function spawn (cmd:string,args?: string[],options?: child_process.SpawnOptionsWithoutStdio):Promise<spawnResult>{
  return new Promise<spawnResult>((resolve,reject)=>{
    let stdout = "",stderr = "";
    let p = child_process.spawn(cmd,args,options);
    p.on('exit', (code)=>{
      if (code === 0){
        resolve({
          stderr,stdout,code
        });
      }else{
        reject({
          stderr,stdout,code
        });
      }
    });
    p.stdout.setEncoding('utf-8');
    p.stdout.on('data', (data)=>{
      stdout+=data;
    });
    p.stderr.on('data', (data)=>{
      stderr+=data;
    });
  })
}
export {spawn};