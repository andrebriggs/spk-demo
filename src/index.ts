import clear from "clear"
import * as constants from "./constant_values";
import rimraf from "rimraf";
import figlet from "figlet"
import chalk from "chalk"
import cli  from "clui"
import inquirer from 'inquirer'
import { exec } from "../../spk/src/lib/shell";
// import { logger } from "../../spk/src/logger";
import { execute as hldExecute, initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import fs from "fs-extra";
import * as common from "./utils";

import path from "path";
import simplegit from "simple-git/promise"
import { IGitApi } from "azure-devops-node-api/GitApi";
import { GitObjectType } from "azure-devops-node-api/interfaces/GitInterfaces";
import * as bi from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as vsoNodeApi from "azure-devops-node-api";
import { GitRepository, TfvcChangesetRef } from "azure-devops-node-api/interfaces/TfvcInterfaces";
let gitApi: IGitApi | undefined;
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";

const Spinner = cli.Spinner
const spawn = require('child_process').spawn

const init = async () => {
    clear()
    console.log(
        chalk.blueBright("Welcome SPK Quick Start!")
        )   
}

const installHelper = (command: string, onSuccess: { (): void; (): void }, spinner: cli.Spinner) => {
    return new Promise((resolve, reject) => {
        var process = spawn(command, { shell: true })
        spinner.start()
        process.on('exit', () => {
            spinner.stop()
            onSuccess()
            resolve()
        })
    })
}

const installSpinner = async (installSubject: string) => {
    const spinner = new Spinner("Installing "+installSubject)
    return installHelper(
        // 'yarn add -D prettier',
        'sleep 5',
        () => console.log(chalk.green("Done installing "+installSubject)),
        spinner
    )
}

const askIfJsorTs = () => {
    const questions = [
        {
            name: 'ENV',
            type: 'list',
            choices: ['.Typescript', '.Javascript'],
            message: 'Please, select if this is a JavaScript or Typescript project',
            filter: function(val: string) {
                return val === '.Typescript' ? 'ts' : 'js'
            },
        },
    ]
    return inquirer.prompt(questions)
}

function isEmpty(str: string) {
    return (!str || 0 === str.length);
}

// const requireLetterAndNumber = value => {
//     if (/\w/.test(value) && /\d/.test(value)) {
//       return true;
//     }

const askOrganization = () => {
    const questions = [
        {
            name: 'azdo_org_name',
            type: 'input',
            message: 'Enter {organization name}\n',
            validate: function(value: string) {
                var pass = value.match(
                    /^\S*$/ //No Spaces
                );
                if (pass) {
                  return true;
                }
          
                return 'Organization names must start with a letter or number, followed by letters, numbers or hyphens, and must end with a letter or number.';
              }
        },
        {
            name: 'azdo_project_name',
            type: 'input',
            message: 'Enter {project name}\n'
            // validate: function(value: string) {
            //     var pass = value.match(
            //         /[^A-Za-z0-9-]+/ //See https://www.regextester.com
            //     );
            //     if (pass) {
            //       return true;
            //     }
            //     //TODO: If the project name has spaces use %20
            //     return 'Project names must start with a letter or number, followed by letters, percent, numbers or hyphens, and must end with a letter or number.';
            //   }
        },
        {
            type: 'password',
            message: 'Enter your AzDO personal access token',
            name: 'azdo_pat',
            mask: '*',
            validate: (value: string) => {
                if(isEmpty(value)){
                    return 'Must enter a personal access token with read/write/manage permissions'
                }
                return true;
            }
        }
    ]

    return inquirer.prompt(questions)
}

export const pushBranch = async (branchName: string): Promise<void> => {
    try {
      await exec("git", ["push", "-u", "origin", `${branchName}`]);
    } catch (_) {
      throw Error(`Unable to push git branch ${branchName}: ` + _);
    }
  };



let manifestRepoFiles: string[] = ["README.md"];
// let hldRepoFiles: string[] = ["README.md"];
// let appRepoFiles: string[] = ["README.md"];



function logCurrentDirectory() {
    console.log('Current directory: ' + process.cwd());
}

const createDirectory = (dirName: string) => {
    fs.mkdirpSync(dirName)
};

const getFullPath = (relativeItem: string): string => {
    return path.join(process.cwd(), relativeItem);
};

const moveToRelativePath = (relativePath: string) => {
    process.chdir(relativePath);
};

const moveToPath = (relativePath: string) => {
    process.chdir(path.join(process.cwd(),relativePath));
};
const moveToAbsPath = (absPath: string) => {
    process.chdir(absPath);
};

const homedir = require('os').homedir();
const WORKSPACE_DIR = path.resolve(path.join(homedir,constants.WORKSPACE));

async function findRepoInAzureOrg(repoName: string) : Promise<GitRepository> {
    const vstsCollectionLevel: vsoNodeApi.WebApi = await common.getWebApi(); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    const respositories: GitRepository[] = await gitApi.getRepositories();

    if (respositories) {
        console.log(`found ${respositories.length} respositories`);
        var foundRepo = respositories.find(repo => repo.name==repoName);
        if (foundRepo){       
            console.log("We found: "+foundRepo.name)
            return foundRepo;
        }
    }
    else{
        console.log("Found no repos...")
    }
    return {}; //I don't like returning an empty object
}

async function deleteRepoInAzureOrg(repo: GitRepository, projectName: string) {
    const vstsCollectionLevel: vsoNodeApi.WebApi = await common.getWebApi(); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    if(repo.id){
        await gitApi.deleteRepository(repo.id, projectName)
        console.log("Deleted repository "+repo.name)
    }
    else{
        throw new Error(
            'Repository Id is undefined, cannot delete repository'
          )
    }
}

async function createRepoInAzureOrg(repoName: string, projectName: string) : Promise<GitRepository> {
    const vstsCollectionLevel: vsoNodeApi.WebApi = await common.getWebApi(); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    const createOptions: GitInterfaces.GitRepositoryCreateOptions = <GitInterfaces.GitRepositoryCreateOptions>{name: repoName,project: projectName};
    return await gitApi.createRepository(createOptions,projectName);
}


(async () => {

        // //Find repo
        // if (respositories) {
        //     console.log(`found ${respositories.length} respositories`);
        //     var foundRepo = respositories.find(repo => repo.name=="manifest_repo");
        //     if (foundRepo){
        //         console.log("We found: "+foundRepo.name)
        //     }
        //     // for(let repo of respositories){
        //     //     console.log(repo.name)
        //     // }
        // }
        // else{
        //     console.log("Found no repos...")
        // }



    init()
    console.log(`The WORKSPACE_DIR is ${WORKSPACE_DIR}`)
    if(fs.existsSync(WORKSPACE_DIR)){
        rimraf.sync(WORKSPACE_DIR);
    }
    // var currentPath = getFullPath(constants.WORKSPACE)
    createDirectory(WORKSPACE_DIR)
    moveToAbsPath(WORKSPACE_DIR)
        
    createDirectory(constants.MANIFEST_REPO)
    moveToRelativePath(constants.MANIFEST_REPO)

    var gitRepo = await findRepoInAzureOrg(constants.MANIFEST_REPO);
    let resultRepo: GitRepository;
    if(gitRepo.id){       
        console.log("Found remote repo "+constants.MANIFEST_REPO+". Attempting to delete")
        await deleteRepoInAzureOrg(gitRepo,constants.AZDO_PROJECT);
    }
    resultRepo = await createRepoInAzureOrg(constants.MANIFEST_REPO,constants.AZDO_PROJECT)
    console.log("Result repo: "+resultRepo.remoteUrl);

    // resultRepo.remoteUrl
    try{
        logCurrentDirectory()
        const git = simplegit();
        if (!await git.checkIsRepo()){
            await git.init()
            console.log(`Git init called in ${process.cwd()}`)
        }
        
        fs.createFileSync("README.md");
        
        // Add files
        await git.add("./README.md")

        //Get git status and get various information
        var statusResult = await git.status()
        
        console.log("Files in local Git:")
        for( let fileName of statusResult.files) {
            console.log("\t"+fileName.path);
        };

        console.log("Files added to Git:")
        for( let fileName of statusResult.created) {
            console.log("\t"+fileName);
        };

        console.log(chalk.yellow("Files not added to Git:"))
        for( let fileName of statusResult.not_added) {
            console.log("\t"+fileName);
        };
        
        //Commit and check the local git log
        await git.commit("Initial commit for Manifest repo")

        var resultLog = await git.log()
        console.log("Log Messages from Git:")
        for( let logField of resultLog.all) {
            console.log("\t"+logField.date +" --> "+logField.message);
        };

        // We know AzDO url style so hack it for now instead of discovering via API
        const remoteURL=
        `dev.azure.com/${constants.AZDO_ORG}/${constants.AZDO_PROJECT}/_git/${constants.MANIFEST_REPO}`

        const remote = `https://${constants.USER}:${constants.ACCESS_TOKEN}@${remoteURL}`;

        // Push to remote
        await git.addRemote('origin', remote)
        await git.push('origin', 'master');

        console.log("Finished pushing manifest repo!") 
    }
    catch(err)
    {
        //TODO err displays access token
        console.log(`An error occured: ${err}`)
    }





 

    // createDirectory(constants.HLD_REPO)
    // createDirectory(constants.APP_REPO)

    // logCurrentDirectory()
    
    // const answer = await askIfJsorTs()
    // const answer = askOrganization()
    // answer.then(answers => {
    //     console.log("Org Name:\t"+answers.azdo_org_name);
    //     console.log("Project Name:\t"+answers.azdo_project_name);
    //     console.log("https://dev.azure.com/"+answers.azdo_org_name+"/"+answers.azdo_project_name)      
    // });
   
    // fs.mkdir(HLD_REPO,()=> {logger.info(`Wrote dir ${ HLD_REPO }`)})
    // exec("git", ["init"]);
    // logger.info(`Current dir ${process.cwd}`)
    // hldInitialize(HLD_REPO,false);
    // exec("git",["add", "-A"])
    // exec("git",["commit", "-m","'initial commit'"])
    // gitApi?.getRepositories

    // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

    // await installSpinner('Manifest repository')
    // await installSpinner('HLD repository')
    // await installSpinner('Application repository')
})()





