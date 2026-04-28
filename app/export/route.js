import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export const maxDuration = 30;

export async function POST(req) {
  const { title, sections } = await req.json();
  // sections: [{heading, content}]

  const children = [];

  // Title
  children.push(new Paragraph({
    text: title || "Raport - Luzny Roman",
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  children.push(new Paragraph({
    text: `Wygenerowano: ${new Date().toLocaleString("pl-PL")}`,
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
  }));

  for (const section of sections) {
    if (!section.content) continue;

    // Section heading
    if (section.heading) {
      children.push(new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: { bottom: { color: "CCCCCC", size: 6, space: 1, style: "single" } },
      }));
    }

    // Content - split by lines
    const lines = section.content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
        continue;
      }

      // Detect markdown-ish headings
      if (trimmed.startsWith("## ")) {
        children.push(new Paragraph({
          text: trimmed.replace("## ", ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }));
      } else if (trimmed.startsWith("# ")) {
        children.push(new Paragraph({
          text: trimmed.replace("# ", ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }));
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/\*\*/g, ""), bold: true })],
          spacing: { after: 100 },
        }));
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        children.push(new Paragraph({
          text: trimmed.slice(2),
          bullet: { level: 0 },
          spacing: { after: 80 },
        }));
      } else if (trimmed.startsWith("|")) {
        // Table row - render as plain text
        children.push(new Paragraph({
          children: [new TextRun({ text: trimmed, font: "Courier New", size: 18 })],
          spacing: { after: 60 },
        }));
      } else {
        children.push(new Paragraph({
          text: trimmed,
          spacing: { after: 120 },
        }));
      }
    }
  }

  const doc = new Document({
    creator: "Luzny Roman",
    title: title || "Raport",
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="roman_raport_${Date.now()}.docx"`,
    },
  });
}
