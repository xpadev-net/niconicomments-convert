import { FolderOpenOutlined } from "@mui/icons-material";
import type { FC } from "react";

type Props = {
  label: string;
  path: string;
};

const PathDisplay: FC<Props> = ({ label, path }) => {
  return (
    <div>
      <span>{label}</span>
      <span>{path.split(/[/\\]+/g).reverse()[0]}</span>
      <button>
        <FolderOpenOutlined />
      </button>
    </div>
  );
};

export { PathDisplay };
