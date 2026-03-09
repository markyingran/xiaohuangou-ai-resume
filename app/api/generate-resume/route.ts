import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type FactMetric = {
  label?: string;
  value: string;
  direction?: string;
};

type Fact = {
  id: string;
  source: "resume" | "chat";
  type: "experience" | "project" | "skill" | "education" | "metric" | "other";
  rawText: string;
  normalized: string;
  company?: string;
  title?: string;
  timeRange?: string;
  tags?: string[];
  metrics?: FactMetric[];
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

async function callChatCompletion(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}) {
  const { baseUrl, apiKey, model, messages } = params;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error(
      "调用 DashScope(OpenAI 兼容) 接口失败：",
      response.status,
      await response.text()
    );
    throw new Error("LLM request failed");
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM returned empty content");
  }

  return content;
}

async function extractFacts(params: {
  jobDescription: string;
  userResumeText: string;
  chatMessages: ChatMessage[];
  baseUrl: string;
  apiKey: string;
  model: string;
}): Promise<Fact[] | null> {
  const {
    jobDescription,
    userResumeText,
    chatMessages,
    baseUrl,
    apiKey,
    model
  } = params;

  const system: ChatMessage = {
    role: "system",
    content:
      "你是一名严谨的“事实抽取助手”，只负责从【候选人已经提供的资料】中找出已经存在的事实，绝对不能编造新的经历或数字。\n\n资料来源只有三种：\n1）候选人上传的原始简历文本；\n2）候选人与 AI 的对话补充说明；\n3）目标岗位的 JD（只能用来判断哪些事实重要，不能当作候选人的经历）。\n\n你的任务：\n- 只抽取候选人真的写过 / 说过的事实，按 JSON 结构输出；\n- 不要把 JD 里的需求点当成候选人的经历；\n- 不要自己编年份、公司、职位、指标、项目名称。\n\n输出格式：\n- 必须是合法 JSON，对象顶层字段为：{ \"facts\": Fact[] }\n- 每个 Fact 至少包含：id、source、type、rawText、normalized，可选字段 company、title、timeRange、metrics、tags。\n- 如果你不确定某个信息是否真实出现过，就不要写进 facts。\n\n只输出 JSON，不要任何解释性文字。"
  };

  const user: ChatMessage = {
    role: "user",
    content: [
      "以下是目标岗位的招聘需求（JD）（仅用于判断哪些事实更重要，不能当作候选人经历）：",
      "----------------",
      jobDescription || "（用户未提供 JD）",
      "----------------",
      "",
      "以下是候选人上传的原始简历文本：",
      "----------------",
      userResumeText || "（用户未提供旧简历）",
      "----------------",
      "",
      "以下是候选人与 AI 的对话内容（如有，最新在后）：",
      "----------------",
      chatMessages
        .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
        .join("\n"),
      "----------------",
      "",
      "请根据【候选人原始简历】和【对话】抽取候选人的真实经历和事实，并按前面说明的 JSON 结构输出。",
      "只输出 JSON，对象顶层为 { \"facts\": [...] }。"
    ]
      .filter(Boolean)
      .join("\n")
  };

  try {
    const content = await callChatCompletion({
      baseUrl,
      apiKey,
      model,
      messages: [system, user]
    });

    const parsed = JSON.parse(content) as { facts?: Fact[] };
    if (!parsed.facts || !Array.isArray(parsed.facts)) {
      throw new Error("facts missing in JSON");
    }
    return parsed.facts;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("事实抽取阶段失败，回退为单阶段生成：", error);
    return null;
  }
}

async function generateResumeWithFacts(params: {
  jobDescription: string;
  facts: Fact[] | null;
  lastVersionText: string;
  userResumeText: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}): Promise<string> {
  const {
    jobDescription,
    facts,
    lastVersionText,
    userResumeText,
    baseUrl,
    apiKey,
    model
  } = params;

  const factsSummary =
    facts && facts.length > 0
      ? facts
          .map((f, index) => `${index + 1}. ${f.normalized || f.rawText}`)
          .join("\n")
      : "（事实抽取阶段失败或无可用事实，请谨慎生成，尽量少编造新内容。）";

  const system: ChatMessage = {
    role: "system",
    content:
      "你是一名资深招聘经理和简历优化专家，现在收到了一份“已抽取好的事实列表”（facts）、候选人的原始简历全文和一份岗位 JD。\n\n极其重要的规则：\n0）如果候选人在原始简历中已经写出了真实的姓名、邮箱、手机号、公司名称等，请在输出简历中【原样保留这些内容】，不得用 X、* 或其他占位符替换，也不得删除。\n1）你写简历时，应尽量覆盖 facts 列表中出现的所有重要事实，允许做改写、压缩、合并相似内容，但不要随意丢弃关键信息；确实需要省略时，只能省略非常次要、重复的描述。\n2）你只能使用 facts 列表和原始简历中已经存在的事实，允许做润色和结构化表达，但不得凭空新增学校、公司、职位、项目经历。\n3）你可以根据 JD 调整哪些事实要重点写、怎么排序、怎么措辞，但不能编不存在的事实。\n4）凡是不在 facts 列表和原始简历里的内容，却出现在你输出的简历中，一律视为【AI 新增】：包括具体技能名、工具名、产品名、具体数字（百分比、倍数、时长、次数、金额、人数等）、新的成就描述、能力总结、方法论、任何新的公司名、学校名、职位名、时间区间。这些内容必须用 [[AI新增]] 和 [[/AI新增]] 将整段或该部分完整包裹，前端会以黄色高亮展示。\n5）如果某条事实本身就包含数字（例如原简历写了“收入较1月增长158.8%”），你在简历里复述这一数字时，可以不标黄。只有当某个数字 / 技能 / 产品 / 结论在 facts 的 rawText 或 normalized 里完全没出现过时，才算 AI 新增。\n6）如果 JD 要求的能力在 facts 里没有对应事实支撑，你可以在“技能标签”中写成 [[AI新增]]...[[/AI新增]]，但不要把它伪装成真实经历。\n\n输出要求：\n- 输出一份完整的中文简历正文，包含：个人信息、个人简介、工作经历（按时间倒序）、项目经历（如有）、教育背景、技能标签。\n- 除非用户在原始简历中本身就做了脱敏，否则不要把个人信息和公司名称改成占位符。\n- 不要解释规则，不要输出 JSON，也不要输出 facts 原文，只输出简历正文。"
  };

  const user: ChatMessage = {
    role: "user",
    content: [
      "以下是目标岗位的招聘需求（JD）：",
      "----------------",
      jobDescription,
      "----------------",
      "",
      "以下是已经抽取好的候选人“事实列表”（facts，已按重要度和时间大致排序，仅展示 normalized 或 rawText）：",
      "----------------",
      factsSummary,
      "----------------",
      "",
      "以下是候选人原始简历全文（供你核对联系方式和公司名称，请保持其中已经出现过的姓名、邮箱、电话、公司名称的写法，不要用 X 或占位符替换）：",
      "----------------",
      userResumeText || "（用户未提供旧简历）",
      "----------------",
      lastVersionText
        ? "\n以下是上一版简历全文，你可以在此基础上进行针对性优化，而不是完全重写：\n----------------\n" +
          lastVersionText +
          "\n----------------"
        : "",
      "",
      "请根据【JD】和【事实列表】输出一份更加匹配目标岗位的中文简历，遵守 system 消息里的所有约束，尤其是：不得虚构新的经历；不在 facts 列表中的内容，一律用 [[AI新增]]...[[/AI新增]] 标记。",
      "请直接输出简历正文。"
    ]
      .filter(Boolean)
      .join("\n")
  };

  const content = await callChatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: [system, user]
  });

  return content;
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

  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.QWEN_MODEL || "qwen-plus";
  const baseUrl =
    process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";

  if (!apiKey) {
    return NextResponse.json({
      resumeText: demoResumeText,
      summary:
        "Demo 模式下的占位返回结果。尚未配置 DASHSCOPE_API_KEY，因此暂不调用真实大模型。",
      usedSignals: {
        fromJobDescription: true,
        fromOldResume: !!userResumeText.trim(),
        fromChat:
          Array.isArray(chatMessages) && chatMessages.length > 0
      }
    });
  }

  try {
    const facts = await extractFacts({
      jobDescription,
      userResumeText,
      chatMessages,
      baseUrl,
      apiKey,
      model
    });

    const resumeTextFromLLM = await generateResumeWithFacts({
      jobDescription,
      facts,
      lastVersionText,
      userResumeText,
      baseUrl,
      apiKey,
      model
    });

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
    console.error("调用 DashScope(OpenAI 兼容) 接口异常：", error);

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


