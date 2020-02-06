import * as vsoNodeApi from "azure-devops-node-api";
import { IBuildApi } from "azure-devops-node-api/BuildApi";
import { IGitApi } from "azure-devops-node-api/GitApi";
import {
  Build,
  BuildDefinitionReference
} from "azure-devops-node-api/interfaces/BuildInterfaces";
import * as GitInterfaces from "azure-devops-node-api/interfaces/GitInterfaces";
import * as lim from "azure-devops-node-api/interfaces/LocationsInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import { logger } from "../../spk/src/logger";
import * as constants from "./constant_values";

interface IAPIResult {
  api: vsoNodeApi.WebApi;
  connMetadata: lim.ConnectionData;
}

const getApi = async (): Promise<IAPIResult> => {
  const authHandler = vsoNodeApi.getPersonalAccessTokenHandler(constants.ACCESS_TOKEN);
  const option = undefined;
  const vsts = new vsoNodeApi.WebApi(constants.AZDO_ORG_URL, authHandler, option);
  const connData = await vsts.connect();
  return {
    api: vsts,
    connMetadata: connData
  };
};

const getBuildApi = async (): Promise<IBuildApi> => {
  const { api } = await getApi();
  return await api.getBuildApi();
};

const getGitApi = async (): Promise<IGitApi> => {
  const { api } = await getApi();
  return await api.getGitApi();
};

export const getAuthUserName = async (): Promise<string> => {
  const { connMetadata } = await getApi();
  if(connMetadata.authenticatedUser && connMetadata.authenticatedUser.providerDisplayName){
    return connMetadata.authenticatedUser.providerDisplayName;
  }
  return "";
};


export const createRepoInAzureOrg = async (
  repoName: string,
  projectName: string
): Promise<GitRepository> => {
  const gitApi = await getGitApi();
  const createOptions = {
    name: repoName,
    project: projectName
  } as GitInterfaces.GitRepositoryCreateOptions;
  return await gitApi.createRepository(createOptions, projectName);
};

export const findRepoInAzureOrg = async (
  repoName: string
): Promise<GitRepository | null> => {
  const gitApi = await getGitApi();
  const respositories = await gitApi.getRepositories();

  if (respositories) {
    logger.info(`found ${respositories.length} respositories`);
    const foundRepo = respositories.find(repo => repo.name === repoName);
    if (foundRepo) {
      logger.info("We found: " + foundRepo.name);
      return foundRepo;
    }
  }

  logger.info("Found no repos...");
  return null;
};

export const deleteRepoInAzureOrg = async (
  repo: GitRepository,
  projectName: string
) => {
  logger.info("Found remote repo " + repo.name + ". Attempting to delete");
  const gitApi = await getGitApi();

  if (repo.id) {
    await gitApi.deleteRepository(repo.id, projectName);
    logger.info("Deleted repository " + repo.name);
  } else {
    throw new Error(
      'Repository Id is undefined, cannot delete repository'
    );
  }
};

export const getPipelineByName = async (
  pipelineName: string
): Promise<BuildDefinitionReference | undefined> => {
  try {
    logger.info(`Finding pipeline ${pipelineName}`);
    const buildApi = await getBuildApi();
    const defs = await buildApi.getDefinitions(constants.AZDO_PROJECT);
    return defs.find(d => d.name === pipelineName);
  } catch (e) {
    logger.error(e);
    return undefined;
  }
};

export const deletePipeline = async (pipelineName: string, id: number) => {
  try {
    logger.info(`Deleting pipeline ${pipelineName}`);
    const buildApi = await getBuildApi();
    await buildApi.deleteDefinition(constants.AZDO_PROJECT, id);
  } catch (e) {
    logger.error(`Error in deleting pipeline ${pipelineName}`);
    throw e;
  }
};

export const getPipelineBuild = async (pipelineName: string): Promise<Build> => {
  try {
    logger.info(`Getting queue ${pipelineName}`);
    const buildApi = await getBuildApi();
    return await buildApi.getLatestBuild(constants.AZDO_PROJECT, pipelineName);
  } catch (e) {
    logger.error(`Error in getting build ${pipelineName}`);
    throw e;
  }
};