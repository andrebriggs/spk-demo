import clear from "clear"
import figlet from "figlet"
import chalk from "chalk"
import cli  from "clui"
import inquirer from 'inquirer'
import { exec } from "../../spk/src/lib/shell";
import { logger } from "../../spk/src/logger";
import { execute as hldExecute, initialize as hldInitialize} from "../../spk/src/commands/hld/init";
import fs from "fs-extra";
import path from "path";
import simplegit from "simple-git/promise"
import { IGitApi } from "azure-devops-node-api/GitApi";
let gitApi: IGitApi | undefined;


const Spinner = cli.Spinner
const spawn = require('child_process').spawn

const init = async () => {
    clear()
    console.log(
        chalk.blue("Welcome to the world of SPK")
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
            message: 'Enter {organization name}\n',// of Azure DevOps? (i.e. https://dev.azure.com/{organizationName})',
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
            message: 'Enter {project name}\n'// in Azure DevOps organization? (i.e. https://dev.azure.com/orgName/{projectName})',
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

const ACCESS_TOKEN="rmsajzlsff3x34e64dmc63c2agrrvdzq3hcwpi7j5do3q7j3o3ca"
const AZDO_ORG="abrig"
const AZDO_PROJECT="spk"
const MANIFEST_REPO="manifest-repo";
const HLD_REPO="hld-repo";
const APP_REPO="fabrikam-app-repo";
let dirList: string[] = [MANIFEST_REPO, HLD_REPO, APP_REPO];
let manifestRepoFiles: string[] = ["README.md"];
// let hldRepoFiles: string[] = ["README.md"];
// let appRepoFiles: string[] = ["README.md"];
const git = simplegit();
(async () => {

    // try{
    //     // Delete dirs. 
    //     fs.rmdir(MANIFEST_REPO,()=>{})
    //     fs.rmdir(HLD_REPO,()=>{})
    //     fs.rmdir(APP_REPO,()=>{})
    // }
    // catch(err){
    //     console.error(`Error deleting dirs!\n${err}`)
    // }

    init()
    if(fs.existsSync("test-env")){
        fs.removeSync("test-env")
    }

    fs.mkdirSync("test-env")
    process.chdir(path.join("test-env"))
    console.log('New directory: ' + process.cwd());
    
    for (let dirName of dirList) {
        if(fs.existsSync(dirName)){
            console.log(`Current dir to delete: ${dirName}`)
            exec("rm", ["-rf",dirName])
                .then(stdout => console.log(stdout))
                .catch(stderr => console.error(stderr)); //Hack to recursively force delete
            // fs.rmdir(dirName).then(()=>{})
            // .catch(err=>{logger.error(`Error deleting ${dirName}\n${err}`)})
        }
    }
    // const answer = await askIfJsorTs()
    const answer = askOrganization()
    answer.then(answers => {
        console.log("Org Name:\t"+answers.azdo_org_name);
        console.log("Project Name:\t"+answers.azdo_project_name);
        console.log("https://dev.azure.com/"+answers.azdo_org_name+"/"+answers.azdo_project_name)
        
        
        fs.mkdirSync(MANIFEST_REPO)
        logger.info(`Wrote dir ${ MANIFEST_REPO }`);
        process.chdir(path.join(MANIFEST_REPO))
        console.log('New directory: ' + process.cwd());
        git.init().then(()=>{
            console.log("git init called")
            console.log('Current directory: ' + process.cwd());
            fs.createFileSync("README.md");
        })
        // exec("git", ["init"]).then(stdout => console.log(stdout));
        
        
        git.add("README.md").then(()=>{
            exec("git", ["status", "."]).then(stdout => console.log(stdout))
            // const stats = git.status();
        })
        
        exec("ls", ["-ls"]).then(stdout => console.log(stdout))

        
        // fs.mkdir(HLD_REPO,()=> {logger.info(`Wrote dir ${ HLD_REPO }`)})
        // exec("git", ["init"]);
        // logger.info(`Current dir ${process.cwd}`)
        // hldInitialize(HLD_REPO,false);
        // exec("git",["add", "-A"])
        // exec("git",["commit", "-m","'initial commit'"])
        // gitApi?.getRepositories
    });




    // fs.mkdir(HLD_REPO,()=> {logger.info(`Wrote dir ${ HLD_REPO }`)})
    // fs.mkdir(APP_REPO,()=> {logger.info(`Wrote dir ${ APP_REPO }`)})

    // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

    // await installSpinner('Manifest repository')
    // await installSpinner('HLD repository')
    // await installSpinner('Application repository')
})()