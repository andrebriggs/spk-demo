import * as vsoNodeApi from "azure-devops-node-api";
import {
  Build,
  BuildDefinition,
  BuildDefinitionReference
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import { logger } from "../../spk/src/logger";

export const getApi = async (
  serverUrl: string,
  accessToken: string
): Promise<vsoNodeApi.WebApi> => {
  return new Promise<vsoNodeApi.WebApi>(async (resolve, reject) => {
    try {
      const authHandler = vsoNodeApi.getPersonalAccessTokenHandler(accessToken);
      const option = undefined;

      const vsts: vsoNodeApi.WebApi = new vsoNodeApi.WebApi(serverUrl, authHandler, option);
      await vsts.connect();
      // logger.info(`Hello ${connData.authenticatedUser.providerDisplayName}`);
      resolve(vsts);
    }
    catch (err) {
      reject(err);
    }
  });
};

export const getWebApi = async (
  azureOrgUrl: string,
  accessToken: string
): Promise<vsoNodeApi.WebApi> => {
  return await getApi(azureOrgUrl,accessToken);
};

export const findRepoInAzureOrg = async (
  azureOrgUrl: string,
  accessToken: string,
  repoName: string
): Promise<GitRepository> => {
  const vstsCollectionLevel: vsoNodeApi.WebApi = await getWebApi(azureOrgUrl, accessToken); // org url
  const gitApi = await vstsCollectionLevel.getGitApi();
  const respositories: GitRepository[] = await gitApi.getRepositories();

  if (respositories) {
    logger.info(`found ${respositories.length} respositories`);
    const foundRepo = respositories.find(repo => repo.name === repoName);
    if (foundRepo) {
      logger.info("We found: " + foundRepo.name);
      return foundRepo;
    }
  }
  else {
    logger.info("Found no repos...");
  }
  return {}; // I don't like returning an empty object
};

export const deleteRepoInAzureOrg = async (
  azureOrgUrl: string,
  accessToken: string,
  repo: GitRepository,
  projectName: string
) => {
  logger.info("Found remote repo " + repo.name + ". Attempting to delete");
  const vstsCollectionLevel: vsoNodeApi.WebApi = await getWebApi(azureOrgUrl, accessToken); // org url
  const gitApi = await vstsCollectionLevel.getGitApi();
  if (repo.id) {
    await gitApi.deleteRepository(repo.id, projectName);
    logger.info("Deleted repository " + repo.name);
  }
  else {
    throw new Error(
      'Repository Id is undefined, cannot delete repository'
    );
  }
};

export const getPipelineByName = async (
  azureOrgUrl: string,
  accessToken: string,
  projectName: string,
  pipelineName: string
): Promise<BuildDefinitionReference | undefined> => {
  try {
    logger.info(`Finding pipeline ${pipelineName}`);
    const vstsCollectionLevel = await getWebApi(azureOrgUrl, accessToken);
    const buildApi = await vstsCollectionLevel.getBuildApi();
    const defs = await buildApi.getDefinitions(projectName);
    return defs.find(d => d.name === pipelineName);
  } catch (e) {
    logger.error(e);
    return undefined;
  }
};

export const deletePipeline = async (
  azureOrgUrl: string,
  accessToken: string,
  projectName: string,
  pipelineName: string,
  id: number
) => {
  try {
    logger.info(`Deleting pipeline ${pipelineName}`);
    const vstsCollectionLevel = await getWebApi(azureOrgUrl, accessToken);
    const buildApi = await vstsCollectionLevel.getBuildApi();
    await buildApi.deleteDefinition(projectName, id);
  } catch (e) {
    logger.error(`Error in deleting pipeline ${pipelineName}`);
    throw e;
  }
};

export const getPipelineBuild = async (
  azureOrgUrl: string,
  accessToken: string,
  projectName: string,
  pipelineName: string
): Promise<Build> => {
  try {
    logger.info(`Getting queue ${pipelineName}`);
    const vstsCollectionLevel = await getWebApi(azureOrgUrl, accessToken);
    const buildApi = await vstsCollectionLevel.getBuildApi();
    return await buildApi.getLatestBuild(projectName, pipelineName);
  } catch (e) {
    logger.error(`Error in getting build ${pipelineName}`);
    throw e;
  }
};