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
import path from "path";
import simplegit from "simple-git/promise"
import { IGitApi } from "azure-devops-node-api/GitApi";
import { GitObjectType } from "azure-devops-node-api/interfaces/GitInterfaces";
let gitApi: IGitApi | undefined;

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
const git = simplegit();


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

(async () => {
    init()
    if(fs.existsSync(constants.WORKSPACE)){
        rimraf(constants.WORKSPACE, function () { console.log(`Deleted ${constants.WORKSPACE}!`); });
    }
    // var currentPath = getFullPath(constants.WORKSPACE)
    createDirectory(constants.WORKSPACE)
    moveToPath(constants.WORKSPACE)
        
    createDirectory(constants.MANIFEST_REPO)
    moveToRelativePath(constants.MANIFEST_REPO)

    try{
        await git.init()
        console.log("git init called")
        var statusResult = await git.status()
        
        for( let fileName of statusResult.files) {
            console.log(fileName);
        };
        for( let fileName of statusResult.not_added) {
            console.log(fileName);
        };
        // console.log(`Status result: ${statusResult.files.length}`)
    }
    catch(err)
    {
        console.log(err)
    }
    // git.init().then(()=>{
    //     console.log("git init called")
    //     logCurrentDirectory()
    //     fs.createFileSync("README.md");
    //     fs.readdirSync(process.cwd()).forEach(file => {
    //         console.log(file);
    //       });
    // })

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
   
    

    // var currentPath = getFullPath(constants.MANIFEST_REPO)
    // process.chdir(currentPath)
    // logCurrentDirectory()


    // exec("git", ["init"]).then(stdout => console.log(stdout));
    
    
    // git.add("README.md").then(()=>{
    //     exec("git", ["status", "."]).then(stdout => console.log(stdout))
    //     // const stats = git.status();
    // })
    
    // exec("ls", ["-ls"]).then(stdout => console.log(stdout))

    
    // fs.mkdir(HLD_REPO,()=> {logger.info(`Wrote dir ${ HLD_REPO }`)})
    // exec("git", ["init"]);
    // logger.info(`Current dir ${process.cwd}`)
    // hldInitialize(HLD_REPO,false);
    // exec("git",["add", "-A"])
    // exec("git",["commit", "-m","'initial commit'"])
    // gitApi?.getRepositories




    // fs.mkdir(HLD_REPO,()=> {logger.info(`Wrote dir ${ HLD_REPO }`)})
    // fs.mkdir(APP_REPO,()=> {logger.info(`Wrote dir ${ APP_REPO }`)})

    // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

    // await installSpinner('Manifest repository')
    // await installSpinner('HLD repository')
    // await installSpinner('Application repository')
})()





