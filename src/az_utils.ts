import * as vm from "azure-devops-node-api";
import * as lim from "azure-devops-node-api/interfaces/LocationsInterfaces";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import * as vsoNodeApi from "azure-devops-node-api";
import { logger } from "../../spk/src/logger";

export async function getApi(serverUrl: string, accessToken:string): Promise<vm.WebApi> {
    return new Promise<vm.WebApi>(async (resolve, reject) => {
        try {
            let authHandler = vm.getPersonalAccessTokenHandler(accessToken);
            let option = undefined;

            let vsts: vm.WebApi = new vm.WebApi(serverUrl, authHandler, option);
            let connData: lim.ConnectionData = await vsts.connect();
            // logger.info(`Hello ${connData.authenticatedUser.providerDisplayName}`);
            resolve(vsts);
        }
        catch (err) {
            reject(err);
        }
    });
}

export async function getWebApi(azureOrgUrl: string, accessToken: string): Promise<vm.WebApi> {
    return await getApi(azureOrgUrl,accessToken);
}

export async function findRepoInAzureOrg(azureOrgUrl: string, accessToken: string, repoName: string) : Promise<GitRepository> {
    const vstsCollectionLevel: vsoNodeApi.WebApi = await getWebApi(azureOrgUrl,accessToken); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    const respositories: GitRepository[] = await gitApi.getRepositories();

    if (respositories) {
        logger.info(`found ${respositories.length} respositories`);
        var foundRepo = respositories.find(repo => repo.name==repoName);
        if (foundRepo){       
            logger.info("We found: "+foundRepo.name)
            return foundRepo;
        }
    }
    else{
        logger.info("Found no repos...")
    }
    return {}; //I don't like returning an empty object
}

export async function deleteRepoInAzureOrg(azureOrgUrl: string, accessToken: string, repo: GitRepository, projectName: string) {
    logger.info("Found remote repo "+repo.name+". Attempting to delete")
    const vstsCollectionLevel: vsoNodeApi.WebApi = await getWebApi(azureOrgUrl,accessToken); //org url
    const gitApi = await vstsCollectionLevel.getGitApi();
    if(repo.id){
        await gitApi.deleteRepository(repo.id, projectName)
        logger.info("Deleted repository "+repo.name)
    }
    else{
        throw new Error(
            'Repository Id is undefined, cannot delete repository'
          )
    }
}