import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "小黄狗AI改简历",
  description: "根据招聘需求智能生成与优化简历的 Web 工具"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

