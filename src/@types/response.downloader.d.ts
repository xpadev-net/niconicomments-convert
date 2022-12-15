export type apiResponseToDownloader = {
  target: "downloader";
};
export type apiResponseDownloadProgress = {
  type: "downloadProgress";
  step: number;
  progress: number;
};

export type apiResponsesToDownloader = apiResponseDownloadProgress;

export {};
