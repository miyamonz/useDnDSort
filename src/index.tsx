import React from "react";
import { render } from "react-dom";

import { useDnDSort } from "./useDnDSort";

type Style<T> = React.HTMLAttributes<T>["style"];

const bodyStyle: Style<HTMLDivElement> = {
  height: "100vh",
  display: "flex",
  overflow: "hidden",
  alignItems: "center",
  justifyContent: "center",
};

const containerStyle: Style<HTMLDivElement> = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  width: "100%",
  maxWidth: "350px",
  maxHeight: "500px",
};

const imageCardStyle: Style<HTMLDivElement> = {
  cursor: "grab",
  userSelect: "none",
  width: "100px",
  height: "130px",
  overflow: "hidden",
  border: "solid",
  borderRadius: "5px",
  margin: 3,
};

/**
 * @description 並び替えしたい画像URLの配列
 */
const imageList: string[] = Array.from({ length: 9 }).map((_, i) =>
  i.toString()
);

/**
 * @description ドラッグ＆ドロップ並び替えサンプルのコンポーネント
 */
const SortSampleApp = () => {
  const results = useDnDSort(imageList);

  return (
    <div style={bodyStyle}>
      <div style={containerStyle}>
        {results.map((item) => (
          <div
            key={item.key}
            style={{
              ...imageCardStyle,
              backgroundColor: `hsl(${
                ((imageList.findIndex((l) => l === item.value) /
                  imageList.length) *
                  360) /
                1.5
              }, 60%,70%)`,
            }}
            {...item.events}
          >
            {item.value}
          </div>
        ))}
      </div>
    </div>
  );
};

let rootElement = document.getElementById("root");

// rootElementが無ければ作成してdocument.bodyに追加する
if (!rootElement) {
  rootElement = document.createElement("div");
  rootElement.id = "root";
  document.body.appendChild(rootElement);
}

render(<SortSampleApp />, rootElement);
