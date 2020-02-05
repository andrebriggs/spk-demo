import fs from "fs-extra";
import { logger } from "../../spk/src/logger";
import { exec } from "../../spk/src/lib/shell";

function deleteDirectories() {
    try{
        // Delete dirs. 
        fs.rmdir(MANIFEST_REPO,()=>{})
        fs.rmdir(HLD_REPO,()=>{})
        fs.rmdir(APP_REPO,()=>{})
    }
    catch(err){
        console.error(`Error deleting dirs!\n${err}`)
    }
};

function deleteDirectoriesV2(dirList: string[]) {
    for (let dirName of dirList) {
        if(fs.existsSync(dirName)){
            console.log(`Current dir to delete: ${dirName}`)
            exec("rm", ["-rf",dirName])
                .then(stdout => console.log(stdout))
                .catch(stderr => console.error(stderr)); //Hack to recursively force delete
            fs.rmdir(dirName).then(()=>{})
            .catch(err=>{logger.error(`Error deleting ${dirName}\n${err}`)})
        }
    }
};