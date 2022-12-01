type apiResponseToDownloader = {
  target: "downloader";
};
type apiResponseDownloadProgress = {
  type: "downloadProgress";
  step: number;
  progress: number;
};

type apiResponsesToDownloader = apiResponseDownloadProgress;
