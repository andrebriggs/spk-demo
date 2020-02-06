import chalk from "chalk";
import inquirer from "inquirer";
import { hasValue } from "../../spk/src/lib/validator";
import { getAuthUserName } from "./az_utils";
import { build as buildSPKConfigYaml } from "./SPKConfigBuilder";

export interface IAnswers {
  userName: string;
  firstName: string;
}

const askOrganization = async (): Promise<{[x: string]: {} }> => {
  const questions = [{
    message: 'Enter {organization name}\n',
    name: 'azdo_org_name',
    type: 'input',
    validate: (value: string) => {
      if (!hasValue(value)) {
        return "Must enter an organization";
      }

      const pass = value.match(
        /^\S*$/ // No Spaces
      );
      if (pass) {
        return true;
      }
      return 'Organization names must start with a letter or number, followed by letters, numbers or hyphens, and must end with a letter or number.';
    }
  }, {
    message: 'Enter {project name}\n',
    name: 'azdo_project_name',
    type: 'input',
    validate: (value: string) => {
      if (!hasValue(value)) {
        return "Must enter a project name";
      }
      return true;
    }
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
  }, {
    mask: '*',
    message: 'Enter your AzDO personal access token',
    name: 'azdo_pat',
    type: 'password',
    validate: (value: string) => {
      if (!hasValue(value)) {
        return 'Must enter a personal access token with read/write/manage permissions';
      }
      return true;
    }
  }];

  return inquirer.prompt(questions);
};

export const ask = async () => {
  const answer = await askOrganization();
  console.log(chalk.yellow("Org Name:\t" + answer.azdo_org_name));
  console.log(chalk.yellow("Project Name:\t" + answer.azdo_project_name));

  buildSPKConfigYaml({
    azure_devops: {
      access_token: answer.azdo_pat as string,
      org: answer.azdo_org_name as string,
      project: answer.azdo_project_name as string
    }
  });
};

export const userInfo = async (): Promise<IAnswers> => {
  const userName = await getAuthUserName();
  return {
    firstName: userName.split(" ")[0],
    userName
  };
};

