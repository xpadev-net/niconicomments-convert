import {
  commentFormat,
  commentOption,
  commentOptionEndPoint,
  commentThread,
  v3MetadataComment,
} from "@/@types/niconico";
import { ChangeEvent, useEffect, useState } from "react";
import {
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
} from "@mui/material";
import Styles from "./CommentOption.module.scss";
import { formatDate } from "@/util/time";
import { SelectField } from "@/components/SelectField";

const forkLabel: { [key: string]: string } = {
  owner: "投稿者コメント",
  default: "通常コメント",
  easy: "かんたんコメント",
  community: "コミュニティ・チャンネルコメント",
  "extra-community": "引用コメント",
  "extra-easy": "引用かんたんコメント",
};

type props = {
  postedDate: string;
  metadata: v3MetadataComment;
  update: (data: commentOption) => void;
};

const CommentOption = ({ update, postedDate, metadata }: props) => {
  const _date = new Date();
  const [startPoint, setStartPoint] = useState<string>(formatDate(_date));
  const [endPoint, setEndPoint] = useState<commentOptionEndPoint>({
    type: "count",
    count: 1000,
  });
  const [format, setFormat] = useState<commentFormat>("xml");
  const [threads, setThreads] = useState<commentThread[]>(
    metadata.threads.map((thread) => {
      return {
        threadId: thread.id,
        fork: thread.fork,
        enable: true,
        label: forkLabel[thread.label] ?? "その他",
      };
    })
  );
  useEffect(() => {
    update({
      start: startPoint,
      end: endPoint,
      format: format,
      threads: threads,
    });
  }, [startPoint, endPoint, format, threads]);
  const onEndPointChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "count") {
      setEndPoint({
        type: "count",
        count: 1000,
      });
    } else {
      setEndPoint({
        type: "date",
        date: postedDate,
      });
    }
  };
  return (
    <div>
      <section>
        <h3>起点</h3>
        <TextField
          className={Styles.input}
          variant={"standard"}
          label="日時"
          type={"datetime-local"}
          value={startPoint}
          onChange={(e) => {
            setStartPoint(e.target.value);
          }}
        />
      </section>
      <section>
        <h3>終点</h3>
        <RadioGroup value={endPoint.type} onChange={onEndPointChange} row>
          <FormControlLabel
            value={"count"}
            control={<Radio />}
            label={"コメント数"}
          />
          <FormControlLabel value={"date"} control={<Radio />} label={"日付"} />
        </RadioGroup>
        {endPoint.type === "count" && (
          <TextField
            className={Styles.input}
            variant={"standard"}
            label="コメント数"
            type={"number"}
            value={endPoint.count}
            onChange={(e) => {
              setEndPoint({ type: "count", count: Number(e.target.value) });
            }}
          />
        )}
        {endPoint.type === "date" && (
          <TextField
            className={Styles.input}
            variant={"standard"}
            label="日時"
            type={"datetime-local"}
            value={endPoint.date}
            onChange={(e) => {
              setEndPoint({ type: "date", date: e.target.value });
            }}
          />
        )}
      </section>
      <section>
        <h3>スレッド</h3>
        {threads.map((thread) => {
          const key = `${thread.threadId}:${thread.fork}`;
          return (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  key={`${key}-switch`}
                  checked={thread.enable}
                  onChange={() => {
                    thread.enable = !thread.enable;
                    setThreads([...threads]);
                  }}
                />
              }
              label={thread.label}
            />
          );
        })}
      </section>
      <section>
        <h3>出力</h3>
        <SelectField label={"フォーマット"}>
          <Select
            label={"フォーマット"}
            variant={"standard"}
            className={Styles.input}
            value={format}
            onChange={(e) => setFormat(e.target.value as commentFormat)}
          >
            <MenuItem disabled value="">
              出力するフォーマットを選択してください
            </MenuItem>
            <MenuItem value="xml">xml</MenuItem>
            <MenuItem value="v1 json">v1 JSON</MenuItem>
            <MenuItem value="legacy json">旧JSON</MenuItem>
          </Select>
        </SelectField>
      </section>
    </div>
  );
};

export { CommentOption };
