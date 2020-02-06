import fs from "fs";
import path from "path";
import { Config, defaultConfigDir } from "../../spk/src/config";
import { IConfigYaml } from "../../spk/src/types";

const template = `azure_devops:
  access_token: @@PAT@@
  org: @@ORG_NAME@@
  project: @@PROJECT@@
`;

export const build = (conf: IConfigYaml) => {
  const values = template.replace(
    '@@PAT@@', conf.azure_devops?.access_token!).replace(
    '@@ORG_NAME@@', conf.azure_devops?.org!).replace(
    '@@PROJECT@@', conf.azure_devops?.project!);

  const targetFile = path.join(defaultConfigDir(), "config.yaml");
  fs.writeFileSync(targetFile, values);
};

export const getProject = (): string => {
  return Config().azure_devops?.project!;
};

export const getOrganizationName = (): string => {
  return Config().azure_devops?.org!;
};

export const getPersonalAccessToken = (): string => {
  return Config().azure_devops?.access_token!;
};

export const getOrganizationUrl = (): string => {
  const conf = Config();
  return `https://dev.azure.com/${conf.azure_devops?.org}`;
};

export const getDevOpsPath = (): string => {
  const conf = Config();
  return `${getOrganizationUrl()}/${conf.azure_devops?.project}`;
};
