// Stub for popularLabs module

export interface PopularRepo {
  name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
}

export const fallbackRepos: PopularRepo[] = [
  {
    name: 'test-repo',
    html_url: 'https://github.com/test/test-repo',
    description: 'Test repository',
    stargazers_count: 42,
  },
];

export let pickPopularRepoResult: any = undefined;

export async function pickPopularRepo(_title: string, _placeHolder: string): Promise<any> {
  return pickPopularRepoResult;
}

export function setPickPopularRepoResult(result: any): void {
  pickPopularRepoResult = result;
}

export function resetPopularLabsStub(): void {
  pickPopularRepoResult = undefined;
}
