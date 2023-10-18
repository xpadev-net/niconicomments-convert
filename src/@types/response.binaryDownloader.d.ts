export type ApiResponseToBinaryDownloader = {
  target: "downloader";
};
export type ApiResponseDownloadProgress = {
  type: "downloadProgress";
  name: string;
  progress: number;
};

export type ApiResponsesToBinaryDownloader = ApiResponseDownloadProgress;

export {};
