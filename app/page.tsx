"use client";

import { useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  role: "user" | "ai";
  content: string;
};

type ResumeVersion = {
  id: number;
  label: string;
  createdAt: Date;
  content: string;
};

export default function HomePage() {
  // A 区状态
  const [aTab, setATab] = useState<"jd" | "resume">("jd");
  const [jdText, setJdText] = useState("");
  const [jdSaved, setJdSaved] = useState(false);
  const [uploadedResumeName, setUploadedResumeName] = useState<string | null>(
    null
  );
  const [uploadedResumeText, setUploadedResumeText] = useState<string>("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // B 区聊天状态
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "ai",
      content:
        "你好，我是小黄狗AI。先在右上方填写要投递岗位的招聘需求，并上传你之前的简历；或者在下方聊天区域和我详细聊聊你的职业经历，我会帮你生成更匹配的简历。"
    }
  ]);
  const [hasUserProvidedExperience, setHasUserProvidedExperience] =
    useState(false);

  // C 区简历版本状态
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [generationCountToday, setGenerationCountToday] = useState(0);
  const [lastGenerationDateKey, setLastGenerationDateKey] = useState<
    string | null
  >(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const hasJD = jdText.trim().length > 0;
  const hasPersonalInfo = !!uploadedResumeName || hasUserProvidedExperience;
  const canGenerate = hasJD && hasPersonalInfo;

  const activeVersion = useMemo(
    () => resumeVersions.find((v) => v.id === activeVersionId) ?? null,
    [resumeVersions, activeVersionId]
  );

  const handleSaveJd = () => {
    if (!jdText.trim()) {
      window.alert("请先填写招聘需求，再保存");
      return;
    }
    setJdSaved(true);
  };

  const handleUploadChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-resume", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        window.alert(
          data.error ??
            "上传并解析简历文件失败，请稍后重试，或尝试上传其他格式的简历文件。"
        );
        setUploadingResume(false);
        return;
      }

      const data = (await response.json()) as {
        fileName: string;
        resumeText: string;
      };

      setUploadedResumeName(data.fileName);
      setUploadedResumeText(data.resumeText);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("上传并解析简历失败：", error);
      window.alert("上传并解析简历失败，请检查网络后重试。");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleClearUpload = () => {
    setUploadedResumeName(null);
    setUploadedResumeText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendChat = () => {
    const content = chatInput.trim();
    if (!content) return;

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", content },
      {
        id: prev.length + 2,
        role: "ai",
        content:
          "收到，你的这些补充信息我已经记下了，后续生成简历时会一起考虑。"
      }
    ]);
    setChatInput("");
    setHasUserProvidedExperience(true);
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };

  const buildVersionLabel = (dateKey: string, index: number) => {
    const parts = dateKey.split("-");
    const month = parts[1];
    const day = parts[2];
    return `${month}月-${day}日-${index}`;
  };

  const buildFallbackResumeContent = (versionIndex: number) => {
    const latestUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    return [
      `【第 ${versionIndex} 版简历预览（本地占位文案）】`,
      "",
      "当前为本地占位内容，因为调用生成接口失败或尚未接入真实大模型。",
      "",
      hasJD ? `- 招聘需求摘要：${jdText.slice(0, 120)}...` : "",
      uploadedResumeName
        ? `- 已上传之前的简历文件：${uploadedResumeName}`
        : "- 未上传之前的简历文件",
      latestUserMessage
        ? `- 最近一次你的补充说明：${latestUserMessage.content.slice(
            0,
            160
          )}...`
        : "- 暂无额外补充说明（建议在聊天区域多告诉我一些你的项目和成就）"
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleGenerateResume = async () => {
    if (!hasJD) {
      window.alert("请填入对方的招聘需求");
      return;
    }
    if (!hasPersonalInfo) {
      window.alert("请上传自己之前的简历，或者跟我详细聊聊你的职业经历");
      return;
    }

    const key = todayKey();
    let nextIndex = generationCountToday + 1;
    if (lastGenerationDateKey !== key) {
      nextIndex = 1;
    }

    setIsGenerating(true);

    let contentFromApi: string | null = null;

    try {
      const response = await fetch("/api/generate-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jobDescription: jdText,
          userResumeText: uploadedResumeText,
          chatMessages: messages,
          lastVersionText: activeVersion?.content ?? "",
          targetOptions: {
            language: "zh",
            tone: "professional",
            length: "one_page"
          }
        })
      });

      if (response.ok) {
        const data = (await response.json()) as { resumeText?: string };
        if (data.resumeText && typeof data.resumeText === "string") {
          contentFromApi = data.resumeText;
        }
      } else {
        // 可以在控制台输出错误，方便调试
        // eslint-disable-next-line no-console
        console.error("生成接口返回错误状态：", response.status);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("调用生成接口失败：", error);
    }

    const finalContent =
      contentFromApi ?? buildFallbackResumeContent(nextIndex);

    setResumeVersions((prev) => {
      const id = prev.length ? prev[0].id + 1 : 1;
      const label = buildVersionLabel(key, nextIndex);
      const createdAt = new Date();
      const version: ResumeVersion = {
        id,
        label,
        createdAt,
        content: finalContent
      };

      const nextList = [version, ...prev];
      setActiveVersionId(id);
      return nextList;
    });

    setGenerationCountToday(nextIndex);
    setLastGenerationDateKey(key);
    setIsGenerating(false);
  };

  const handleExportResume = () => {
    if (!activeVersion) {
      window.alert("请先生成一份简历");
      return;
    }

    window.alert(
      `当前 demo 暂未接入真实导出功能。\n你可以先复制预览中的内容，或使用浏览器的打印/另存为 PDF 功能导出。\n\n导出版本：${activeVersion.label}`
    );
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const resetAll = () => {
    setJdText("");
    setUploadedResumeName(null);
    setChatInput("");
    setMessages([
      {
        id: 1,
        role: "ai",
        content:
          "你好，我是小黄狗AI。先在右上方填写要投递岗位的招聘需求，并上传你之前的简历；或者在下方聊天区域和我详细聊聊你的职业经历，我会帮你生成更匹配的简历。"
      }
    ]);
    setHasUserProvidedExperience(false);
    setResumeVersions([]);
    setActiveVersionId(null);
    setGenerationCountToday(0);
    setLastGenerationDateKey(null);
    setIsGenerating(false);
    setATab("jd");
    setShowResetConfirm(false);
  };

  const generateButtonClassName =
    "px-4 py-2.5 rounded-md text-xs font-medium transition-colors " +
    (canGenerate && !isGenerating
      ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
      : "bg-gray-200 text-gray-500 cursor-default");

  const exportButtonClassName =
    "px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 顶部标题栏 */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-2xl bg-yellow-300 flex items-center justify-center text-slate-900 shadow-sm">
            <span className="text-xl leading-none" aria-hidden="true">
              🐶
            </span>
            <span className="absolute -top-1 -right-1 px-1.5 py-[2px] rounded-full bg-sky-600 text-[9px] font-semibold leading-none text-white shadow-sm">
              AI
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-lg tracking-tight">
              小黄狗 · 改简历
            </span>
            <span className="text-[11px] text-slate-500">
              AI 驱动的求职简历调优助手
            </span>
          </div>
        </div>

        <button
          className="text-sm px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
          onClick={() => setShowResetConfirm(true)}
        >
          清空重新来
        </button>
      </header>

      {/* 主体三区布局：左 C 区，右 A/B 区 */}
      <main className="px-4 py-4">
        <div className="mx-auto flex gap-4 h-[calc(100vh-88px)] max-w-7xl">
          {/* C 区：简历预览 + 底部按钮 */}
          <section className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* 步骤三标题 */}
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                  3
                </div>
                <div className="text-xs font-medium text-slate-800">
                  步骤三：生成并预览你的简历
                </div>
              </div>
            </div>

            {/* 简历版本 Tabs */}
            <div className="border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
              {resumeVersions.length === 0 ? (
                <span className="text-xs text-slate-400">
                  还没有生成简历，先在右侧填写招聘需求、上传简历并补充你的职业信息，再点击下方「生成简历」
                </span>
              ) : (
                resumeVersions.map((v) => (
                  <button
                    key={v.id}
                    className={
                      "px-3 py-1 rounded-full text-xs border transition-colors whitespace-nowrap " +
                      (v.id === activeVersionId
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100")
                    }
                    onClick={() => setActiveVersionId(v.id)}
                  >
                    {v.label}
                  </button>
                ))
              )}
            </div>

            {/* 简历预览主体 */}
            <div className="flex-1 overflow-auto px-6 py-4 bg-slate-50">
              <div className="mx-auto max-w-3xl bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                {activeVersion ? (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {activeVersion.content}
                  </pre>
                ) : (
                  <div className="text-sm text-slate-500 space-y-2">
                    <p className="font-medium text-slate-700">
                      这里是你的简历预览区
                    </p>
                    <p>
                      先在右侧上方区域粘贴目标岗位的招聘需求，再上传你之前的简历文件，或者在右侧下方的聊天区域和我详细聊聊你的职业经历。准备好之后点击下方「生成简历」，我会为你生成一版更匹配的简历，并在这里展示出来。
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 底部按钮区 */}
            <div className="border-t border-slate-200 px-6 py-3 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    className={generateButtonClassName}
                    onClick={handleGenerateResume}
                  >
                    {isGenerating ? "生成中..." : "生成简历"}
                  </button>
                  <button
                    className={exportButtonClassName}
                    onClick={handleExportResume}
                  >
                    导出简历
                  </button>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                状态说明：当填写完招聘需求，并上传简历或在聊天区域提供过职业经历后，「生成简历」会点亮可用。
              </div>
            </div>
          </section>

          {/* 右侧 A/B 区 */}
          <section className="w-[440px] flex flex-col gap-4">
            {/* A 区：JD / 上传之前简历 */}
            <div className="flex-[3] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              {/* 步骤一标题 */}
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    1
                  </div>
                  <div className="text-xs font-medium text-slate-800">
                    步骤一：填写招聘需求并上传之前的简历
                  </div>
                </div>
              </div>

              {/* A 区顶部 Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  className={
                    "flex-1 py-2 text-sm font-medium border-b-2 transition-colors " +
                    (aTab === "jd"
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800 bg-slate-50")
                  }
                  onClick={() => setATab("jd")}
                >
                  招聘需求
                </button>
                <button
                  className={
                    "flex-1 py-2 text-sm font-medium border-b-2 transition-colors " +
                    (aTab === "resume"
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800 bg-slate-50")
                  }
                  onClick={() => setATab("resume")}
                >
                  上传之前简历
                </button>
              </div>

              {/* A 区内容 */}
              <div className="flex-1 p-4 overflow-auto">
                {aTab === "jd" ? (
                  <div className="flex flex-col h-full">
                    <label className="text-xs font-medium text-slate-700 mb-2">
                      将你要投递岗位的招聘 JD
                      文案粘贴在这里，我会根据这些要求来优化简历内容。
                    </label>
                    <textarea
                      className="flex-1 w-full text-sm rounded-md border border-slate-300 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                      value={jdText}
                      onChange={(e) => {
                        setJdText(e.target.value);
                        if (jdSaved) {
                          setJdSaved(false);
                        }
                      }}
                      placeholder="例如：岗位职责、任职要求、加分项等完整的招聘文案。建议粘贴原文，便于我更好地理解对方的需求。"
                    />
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>已输入 {jdText.trim().length} 字，建议不少于 200 字</span>
                      <div className="flex items-center gap-2">
                        {jdSaved && (
                          <span className="text-emerald-600">已保存</span>
                        )}
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                          onClick={handleSaveJd}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-slate-600">
                      上传你之前写好的简历文件，我会在此基础上，结合招聘需求和你在 B
                      区补充的信息，为你生成更针对性的版本。
                    </p>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-[10px] text-white font-bold">
                        1
                      </span>
                      支持 PDF、Word 格式，仅可上传一份文件，重复上传会覆盖之前的文件。
                    </label>
                    <div className="mt-1">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        ref={fileInputRef}
                        onChange={handleUploadChange}
                        disabled={uploadingResume}
                        className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800 disabled:file:bg-slate-400 disabled:file:text-slate-200"
                      />
                    </div>
                    {uploadedResumeName ? (
                      <div className="mt-2 flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
                        <div className="text-emerald-700">
                          已上传文件：
                          <span className="font-medium">
                            {uploadedResumeName}
                          </span>
                          <span className="ml-1 text-slate-400">
                            （已自动解析为文本，可随时删除后重新上传）
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ml-2 px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                          onClick={handleClearUpload}
                        >
                          删除文件
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-md px-3 py-2">
                        暂未上传简历文件，你也可以只通过下方聊天区域“和我聊天”的方式，把你的经历详细告诉我。
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* B 区：聊天对话框 */}
            <div className="flex-[4] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    2
                  </div>
                  <div className="text-sm font-medium text-slate-800">
                    步骤二：和 AI 聊聊你的经历
                  </div>
                </div>
                <div className="text-[11px] text-slate-400">
                  你说得越细，我帮你写得越准
                </div>
              </div>

              {/* 聊天消息列表 */}
              <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={
                      "flex " +
                      (msg.role === "user" ? "justify-end" : "justify-start")
                    }
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed " +
                        (msg.role === "user"
                          ? "bg-slate-900 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm")
                      }
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* 聊天输入区 */}
              <div className="border-t border-slate-200 px-3 py-2">
                <div className="flex items-end gap-2">
                  <textarea
                    className="flex-1 text-xs rounded-md border border-slate-300 px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInput.trim()) {
                          handleSendChat();
                        }
                      }
                    }}
                    placeholder="可以从“最近三段工作经历、关键项目成果、带来的业务指标提升、擅长的技能”等角度聊起。"
                  />
                  <button
                    className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                  >
                    发送
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Enter 发送，Shift+Enter 换行
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* 重新来确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 w-full max-w-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              确认清空所有内容，重新开始吗？
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              此操作会清空当前页面上的所有输入、聊天记录和已生成的简历版本，无法恢复。
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-1.5 rounded-md text-xs border border-slate-300 text-slate-700 hover:bg-slate-100"
                onClick={() => setShowResetConfirm(false)}
              >
                取消
              </button>
              <button
                className="px-4 py-1.5 rounded-md text-xs bg-slate-900 text-white hover:bg-slate-800"
                onClick={resetAll}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

