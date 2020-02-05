import clear from "clear"
import * as constants from "./constant_values";
import rimraf from "rimraf";
import figlet from "figlet"
import chalk from "chalk"
import cli  from "clui"
import inquirer from 'inquirer'
import { exec } from "../../spk/src/lib/shell";

import { execute as hldExecute, initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import fs from "fs-extra";
import * as azOps from "./az_utils";

import path from "path";
import simplegit, { StatusResult, SimpleGit } from "simple-git/promise"
import { IGitApi } from "azure-devops-node-api/GitApi";
import * as vsoNodeApi from "azure-devops-node-api";
import { GitRepository, TfvcChangesetRef } from "azure-devops-node-api/interfaces/TfvcInterfaces";
let gitApi: IGitApi | undefined;
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import { disableVerboseLogging, logger } from "../../spk/src/logger";

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
const installPromiseHelper = (delegate: Promise<void>, onSuccess: { (): void; (): void }, spinner: cli.Spinner) => {
    return new Promise(async (resolve, reject) => {
        
        spinner.start()
        await delegate.then(() => {
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
const installPromiseSpinner = async (installSubject: string, delegate: Promise<void>) => {
    const spinner = new Spinner("Installing "+installSubject)
    return installPromiseHelper(
        // 'yarn add -D prettier',
        delegate,
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
    logger.info('Current directory: ' + process.cwd());
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

async function createRepoInAzureOrg(azureOrgUrl: string, accessToken: string,repoName: string, projectName: string) : Promise<GitRepository> {
    const vstsCollectionLevel: vsoNodeApi.WebApi = await azOps.getWebApi(azureOrgUrl,accessToken); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    const createOptions: GitInterfaces.GitRepositoryCreateOptions = <GitInterfaces.GitRepositoryCreateOptions>{name: repoName,project: projectName};
    return await gitApi.createRepository(createOptions,projectName);
}

const logGitInformation = (gitStatus: StatusResult) =>{
    logger.info("Files in local Git:")
    for( let fileName of gitStatus.files) {
        logger.info("\t"+fileName.path);
    };

    logger.info("Files added to Git:")
    for( let fileName of gitStatus.created) {
        logger.info("\t"+fileName);
    };

    logger.info(chalk.yellow("Files not added to Git:"))
    for( let fileName of gitStatus.not_added) {
        logger.info("\t"+fileName);
    };
}

async function commitAndPushToRemote(git: SimpleGit, azureOrgName: string, azureProjectName: string, accessToken: string, repoName: string) {
       //Commit and check the local git log
       await git.commit(`Initial commit for ${repoName} repo`)

       var resultLog = await git.log()
       logger.info("Log Messages from Git:")
       for( let logField of resultLog.all) {
           logger.info("\t"+logField.date +" --> "+logField.message);
       };

       // We know AzDO url style so hack it for now instead of discovering via API
       const remoteURL=
       `dev.azure.com/${azureOrgName}/${azureProjectName}/_git/${repoName}`

       const remote = `https://${constants.USER}:${accessToken}@${remoteURL}`;

       // Push to remote
       await git.addRemote('origin', remote)
       await git.push('origin', 'master');

       logger.info(`Finished pushing ${repoName} repo!`) 
}


async function scaffoldManifestRepo(){
    //Set up Manifest Repo
    try{
        const currentRepo = constants.MANIFEST_REPO
        const azureOrgUrl = constants.AZDO_ORG_URL 
        const azureOrgName = constants.AZDO_ORG
        const azureProjectName = constants.AZDO_PROJECT
        const accessToken = constants.ACCESS_TOKEN

        moveToAbsPath(WORKSPACE_DIR)
        createDirectory(currentRepo)
        moveToRelativePath(currentRepo)

        var gitRepo = await azOps.findRepoInAzureOrg(azureOrgUrl,accessToken,currentRepo);
        let resultRepo: GitRepository;

        if(gitRepo.id){       
            
            await azOps.deleteRepoInAzureOrg(azureOrgUrl,accessToken,gitRepo,azureProjectName);
        }
        resultRepo = await createRepoInAzureOrg(azureOrgUrl,accessToken,currentRepo,azureProjectName)
        logger.info("Result repo: "+resultRepo.remoteUrl);

        logCurrentDirectory()
        const git = simplegit();
        if (!await git.checkIsRepo()){
            await git.init()
            logger.info(`Git init called in ${process.cwd()}`)
        }
        
        // Create and add files
        fs.createFileSync("README.md");
        await git.add("./README.md")

        await commitAndPushToRemote(git,azureOrgName,azureProjectName,accessToken,currentRepo)
    }
    catch(err)
    {
        //TODO err displays access token
        logger.error(`An error occured: ${err}`)
    }
}

async function scaffoldHLDRepo(){
    //Set up HLD Repo
    try{
        const currentRepo = constants.HLD_REPO
        const azureOrgUrl = constants.AZDO_ORG_URL 
        const azureOrgName = constants.AZDO_ORG
        const azureProjectName = constants.AZDO_PROJECT
        const accessToken = constants.ACCESS_TOKEN

        moveToAbsPath(WORKSPACE_DIR)
        createDirectory(currentRepo)
        moveToRelativePath(currentRepo)

        var gitRepo = await azOps.findRepoInAzureOrg(azureOrgUrl,accessToken,currentRepo);
        let resultRepo: GitRepository;

        if(gitRepo.id){       
            
            await azOps.deleteRepoInAzureOrg(azureOrgUrl,accessToken,gitRepo,azureProjectName);
        }
        resultRepo = await createRepoInAzureOrg(azureOrgUrl,accessToken,currentRepo,azureProjectName)
        logger.info("Result repo: "+resultRepo.remoteUrl);

        logCurrentDirectory()
        const git = simplegit();
        if (!await git.checkIsRepo()){
            await git.init()
            logger.info(`Git init called in ${process.cwd()}`)
        }
        
        // Create and add files
        await hldInitialize(".",false);
        await git.add("./*")
        logGitInformation(await git.status())

        await commitAndPushToRemote(git,azureOrgName,azureProjectName,accessToken,currentRepo)
    }
    catch(err)
    {
        //TODO err displays access token
        logger.info(`An error occured: ${err}`)
    }
}

(async () => {
    //Silent the SPK logger for CLI and File outputs
    logger.transports.forEach((t) => (t.silent = true));

    //Silence dedault logger
    // console.log = function() {}

    init()
    logger.info(`The WORKSPACE_DIR is ${WORKSPACE_DIR}`)
    if(fs.existsSync(WORKSPACE_DIR)){
        rimraf.sync(WORKSPACE_DIR);
    }
    createDirectory(WORKSPACE_DIR);
    await installPromiseSpinner("manifest repo",scaffoldManifestRepo());
    await installPromiseSpinner("hld repo",scaffoldHLDRepo());


    // createDirectory(constants.APP_REPO)

    // logCurrentDirectory()
    
    // const answer = await askIfJsorTs()
    // const answer = askOrganization()
    // answer.then(answers => {
    //     console.log("Org Name:\t"+answers.azdo_org_name);
    //     console.log("Project Name:\t"+answers.azdo_project_name);
    //     console.log("https://dev.azure.com/"+answers.azdo_org_name+"/"+answers.azdo_project_name)      
    // });

    // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

    // await installSpinner('Manifest repository')
    // await installSpinner('HLD repository')
    // await installSpinner('Application repository')
})()





