import fs from "fs-extra";
import { logger } from "../../spk/src/logger";
import { exec } from "../../spk/src/lib/shell";
import * as constants from "./constant_values";
import * as vm from "azure-devops-node-api";
import * as lim from "azure-devops-node-api/interfaces/LocationsInterfaces";

// function deleteDirectories() {
//     try{
//         // Delete dirs. 
//         fs.rmdir(MANIFEST_REPO,()=>{})
//         fs.rmdir(HLD_REPO,()=>{})
//         fs.rmdir(APP_REPO,()=>{})
//     }
//     catch(err){
//         console.error(`Error deleting dirs!\n${err}`)
//     }
// };

// function deleteDirectoriesV2(dirList: string[]) {
//     for (let dirName of dirList) {
//         if(fs.existsSync(dirName)){
//             console.log(`Current dir to delete: ${dirName}`)
//             exec("rm", ["-rf",dirName])
//                 .then(stdout => console.log(stdout))
//                 .catch(stderr => console.error(stderr)); //Hack to recursively force delete
//             fs.rmdir(dirName).then(()=>{})
//             .catch(err=>{logger.error(`Error deleting ${dirName}\n${err}`)})
//         }
//     }
// };

export async function getApi(serverUrl: string): Promise<vm.WebApi> {
    return new Promise<vm.WebApi>(async (resolve, reject) => {
        try {
            let token = constants.ACCESS_TOKEN;// getEnv("API_TOKEN");
            let authHandler = vm.getPersonalAccessTokenHandler(token);
            let option = undefined;

            // The following sample is for testing proxy
            // option = {
            //     proxy: {
            //         proxyUrl: "http://127.0.0.1:8888"
            //         // proxyUsername: "1",
            //         // proxyPassword: "1",
            //         // proxyBypassHosts: [
            //         //     "github\.com"
            //         // ],
            //     },
            //     ignoreSslError: true
            // };

            // The following sample is for testing cert
            // option = {
            //     cert: {
            //         caFile: "E:\\certutil\\doctest\\ca2.pem",
            //         certFile: "E:\\certutil\\doctest\\client-cert2.pem",
            //         keyFile: "E:\\certutil\\doctest\\client-cert-key2.pem",
            //         passphrase: "test123",
            //     },
            // };

            let vsts: vm.WebApi = new vm.WebApi(serverUrl, authHandler, option);
            let connData: lim.ConnectionData = await vsts.connect();
            // console.log(`Hello ${connData.authenticatedUser.providerDisplayName}`);
            resolve(vsts);
        }
        catch (err) {
            reject(err);
        }
    });
}

function getEnv(name: string): string {
    let val = process.env[name];
    if (!val) {
        console.error(`${name} env var not set`);
        process.exit(1);
    }
    return val;
}

export function getProject(): string {
    return constants.AZDO_PROJECT;// getEnv("API_PROJECT");
}

export async function getWebApi(serverUrl?: string): Promise<vm.WebApi> {
    serverUrl = serverUrl || constants.AZDO_ORG_URL//getEnv("API_URL");
    return await getApi(serverUrl);
}