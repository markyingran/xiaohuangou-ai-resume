import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type GenerateResumeBody = {
  jobDescription: string;
  userResumeText?: string;
  chatMessages?: ChatMessage[];
  lastVersionText?: string;
  targetOptions?: {
    language?: string;
    tone?: string;
    length?: string;
  };
};

function buildDemoResumeText(params: {
  jobDescription: string;
  userResumeText: string;
  chatMessages: ChatMessage[];
  lastVersionText: string;
  targetOptions?: GenerateResumeBody["targetOptions"];
}) {
  const { jobDescription, userResumeText, chatMessages, lastVersionText, targetOptions } =
    params;

  const jdLength = jobDescription.trim().length;
  const hasOldResume = !!userResumeText.trim();
  const hasChat = Array.isArray(chatMessages) && chatMessages.length > 0;

  const latestUserMessage = [...chatMessages]
    .reverse()
    .find((m) => m.role === "user");

  const lines: string[] = [];

  lines.push("【AI 模拟生成的简历预览（Demo）】");
  lines.push("");
  lines.push(
    "当前仍为示例文案，用于联调前端与后端接口。一旦配置好大模型 API Key，你会在这里看到完整的真实简历正文。"
  );
  lines.push("");
  lines.push("—— 本次生成时使用的关键信息 ——");
  lines.push(`- 招聘需求字数：约 ${jdLength} 字`);

  if (hasOldResume) {
    lines.push(
      `- 来自旧简历的文本（截断示例）：${userResumeText
        .replace(/\s+/g, " ")
        .slice(0, 80)}...`
    );
  } else {
    lines.push("- 用户暂未提供可解析的旧简历文本");
  }

  if (hasChat) {
    lines.push(
      `- 对话轮数：${chatMessages.length}，最近一条用户补充说明：${
        latestUserMessage?.content.replace(/\s+/g, " ").slice(0, 80) ?? ""
      }...`
    );
  } else {
    lines.push("- 尚未从对话中获取到关于职业经历的补充说明");
  }

  if (lastVersionText) {
    lines.push(
      "- 存在上一版简历文本，本次将视为在上一版基础上的迭代（Demo 暂未真正使用该内容）"
    );
  }

  if (targetOptions) {
    lines.push(
      `- 目标偏好设置：${JSON.stringify(targetOptions, null, 2)}`
    );
  }

  lines.push("");
  lines.push("—— 未来接入真实大模型后的期望效果 ——");
  lines.push(
    "1. 根据招聘需求，自动筛选和重写用户经历，突出与岗位高度匹配的成就和能力；"
  );
  lines.push(
    "2. 输出结构清晰、指标明确、便于 ATS 解析的一页或多页中文简历；"
  );
  lines.push(
    "3. 支持用户通过对话微调措辞、突出重点，并多次迭代生成不同版本。"
  );

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  let body: GenerateResumeBody;

  try {
    body = (await req.json()) as GenerateResumeBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    jobDescription,
    userResumeText = "",
    chatMessages = [],
    lastVersionText = "",
    targetOptions
  } = body;

  if (!jobDescription || typeof jobDescription !== "string") {
    return NextResponse.json(
      { error: "jobDescription is required" },
      { status: 400 }
    );
  }

  const demoResumeText = buildDemoResumeText({
    jobDescription,
    userResumeText,
    chatMessages,
    lastVersionText,
    targetOptions
  });

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    return NextResponse.json({
      resumeText: demoResumeText,
      summary:
        "Demo 模式下的占位返回结果。尚未配置 OPENAI_API_KEY，因此暂不调用真实大模型。",
      usedSignals: {
        fromJobDescription: true,
        fromOldResume: !!userResumeText.trim(),
        fromChat:
          Array.isArray(chatMessages) && chatMessages.length > 0
      }
    });
  }

  try {
    const messagesForLLM: ChatMessage[] = [
      {
        role: "system",
        content:
          "你是一名资深招聘经理和简历优化专家，熟悉互联网产品、运营、技术等岗位的招聘标准。你的目标是：根据【目标岗位的招聘需求】+【候选人现有简历】+【候选人与 AI 的对话补充信息】，生成一份更匹配目标岗位的中文简历。\n\n要求：\n- 语言专业、简洁、有数字和结果导向；\n- 尽量使用 ATS 友好的格式（少用复杂表格和花哨符号）；\n- 优先突出与招聘需求高度匹配的经历和能力；\n- 对用户不曾提及的内容，不要虚构。"
      },
      {
        role: "user",
        content: [
          "以下是目标岗位的招聘需求（JD）：",
          "----------------",
          jobDescription,
          "----------------",
          "",
          "以下是候选人现有简历文本（如有）：",
          "----------------",
          userResumeText || "（用户未提供旧简历）",
          "----------------",
          "",
          "以下是候选人与 AI 的对话摘要（最新在后）：",
          "----------------",
          chatMessages
            .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
            .join("\n"),
          "----------------",
          lastVersionText
            ? "\n以下是上一版简历全文，你需要在此基础上进行针对性优化，而不是完全重写：\n----------------\n" +
              lastVersionText +
              "\n----------------"
            : "",
          "",
          "请基于以上信息，输出一份「完整的中文简历文本」，包含但不限于以下模块（可根据情况增删）：",
          "- 个人信息（不真实暴露隐私，可用占位符）；",
          "- 个人简介（2～4 句，突出与岗位高度匹配点）；",
          "- 工作经历（按时间倒序，每段包含【背景 / 职责 / 关键成果（含数字）】）；",
          "- 项目经历（如有）；",
          "- 教育背景；",
          "- 技能标签；",
          "",
          "请直接输出简历正文，不要解释，不要添加任何额外说明。"
        ]
          .filter(Boolean)
          .join("\n")
      }
    ];

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: messagesForLLM,
          temperature: 0.7
        })
      }
    );

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error(
        "调用 OpenAI 接口失败：",
        response.status,
        await response.text()
      );

      return NextResponse.json({
        resumeText: demoResumeText,
        summary:
          "调用大模型接口失败，已回退为 Demo 模式下的占位文案。请检查 OPENAI_API_KEY 或网络配置。",
        usedSignals: {
          fromJobDescription: true,
          fromOldResume: !!userResumeText.trim(),
          fromChat:
            Array.isArray(chatMessages) && chatMessages.length > 0
        }
      });
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const resumeTextFromLLM =
      data.choices?.[0]?.message?.content?.trim();

    if (!resumeTextFromLLM) {
      return NextResponse.json({
        resumeText: demoResumeText,
        summary:
          "大模型返回内容为空，已回退为 Demo 模式下的占位文案。",
        usedSignals: {
          fromJobDescription: true,
          fromOldResume: !!userResumeText.trim(),
          fromChat:
            Array.isArray(chatMessages) && chatMessages.length > 0
        }
      });
    }

    return NextResponse.json({
      resumeText: resumeTextFromLLM,
      summary:
        "已根据招聘需求、旧简历与对话信息生成的真实简历文本。",
      usedSignals: {
        fromJobDescription: true,
        fromOldResume: !!userResumeText.trim(),
        fromChat:
          Array.isArray(chatMessages) && chatMessages.length > 0
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("调用 OpenAI 接口异常：", error);

    return NextResponse.json({
      resumeText: demoResumeText,
      summary:
        "调用大模型接口异常，已回退为 Demo 模式下的占位文案。",
      usedSignals: {
        fromJobDescription: true,
        fromOldResume: !!userResumeText.trim(),
        fromChat:
          Array.isArray(chatMessages) && chatMessages.length > 0
      }
    });
  }
}


