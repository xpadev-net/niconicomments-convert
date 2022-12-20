export type apiResponseToBinaryDownloader = {
  target: "downloader";
};
export type apiResponseDownloadProgress = {
  type: "downloadProgress";
  step: number;
  progress: number;
};

export type apiResponsesToBinaryDownloader = apiResponseDownloadProgress;

export {};
