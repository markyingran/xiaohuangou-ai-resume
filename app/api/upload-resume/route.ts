import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

async function parsePdf(buffer: Buffer) {
  const data = await pdfParse(buffer);
  return data.text || "";
}

async function parseDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "简历文件缺失或格式不正确" },
      { status: 400 }
    );
  }

  const fileName = file.name || "resume";
  const lower = fileName.toLowerCase();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let text = "";

  try {
    if (lower.endsWith(".pdf")) {
      text = await parsePdf(buffer);
    } else if (lower.endsWith(".docx")) {
      text = await parseDocx(buffer);
    } else if (lower.endsWith(".doc")) {
      // .doc 旧格式暂不做复杂解析，简单提示
      text =
        "【提示】当前暂未对 .doc 格式做自动解析，请优先上传 PDF 或 .docx 文件。\n\n";
    } else {
      return NextResponse.json(
        { error: "仅支持上传 PDF 或 Word（.doc/.docx）格式的简历文件" },
        { status: 400 }
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("解析简历文件失败：", error);
    return NextResponse.json(
      { error: "解析简历文件失败，请稍后重试或尝试其他格式文件" },
      { status: 500 }
    );
  }

  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  return NextResponse.json({
    fileName,
    resumeText: normalizedText
  });
}

