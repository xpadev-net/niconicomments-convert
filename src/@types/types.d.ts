interface Window {
  api: {
    request: (data: apiRequestType) => void;
    onResponse: (callback: (data: apiResponseType) => void) => void;
    remove: (callback: (data: apiResponseType) => void) => void;
  };
}

type apiRequestType =
  | (apiRequestsFromController & apiRequestFromController)
  | (apiRequestsFromRenderer & apiRequestFromRenderer);
type apiResponseType =
  | (apiResponsesToController & apiResponseToController)
  | (apiResponsesToRenderer & apiResponseToRenderer)
  | (apiResponsesToDownloader & apiResponseToDownloader);

type inputFormats =
  | formattedLegacyComment[]
  | rawApiResponse[]
  | ownerComment[]
  | v1Thread[]
  | XMLDocument
  | string;
type inputFormatTypes =
  | "formatted"
  | "niconicome"
  | "legacy"
  | "owner"
  | "legacyOwner"
  | "v1";

type options = {
  showCollision: boolean;
  showCommentCount: boolean;
  keepCA: boolean;
  scale: number;
};
type spawnResult = { stdout: string; stderr: string; code: number };
