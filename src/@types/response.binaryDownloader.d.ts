export type apiResponseToBinaryDownloader = {
  target: "downloader";
};
export type apiResponseDownloadProgress = {
  type: "downloadProgress";
  name: string;
  progress: number;
};

export type apiResponsesToBinaryDownloader = apiResponseDownloadProgress;

export {};
