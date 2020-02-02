import clear from "clear"
import figlet from "figlet"
import chalk from "chalk"
import cli  from "clui"
import inquirer from 'inquirer'

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

function isNotEmpty(str: string) {
    return !isEmpty(str);
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

(async () => {
    init()
    // const answer = await askIfJsorTs()
    const answer = askOrganization()
    answer.then(answers => {
        console.log("Org Name:\t"+answers.azdo_org_name);
        console.log("Project Name:\t"+answers.azdo_project_name);
        console.log("https://dev.azure.com/"+answers.azdo_org_name+"/"+answers.azdo_project_name)
    });
    // console.log(chalk.yellow("You chose wisely 🧙‍♂️"))

    // await installSpinner('Manifest repository')
    // await installSpinner('HLD repository')
    // await installSpinner('Application repository')
})()