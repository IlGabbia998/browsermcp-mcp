import { Context } from "@/context";
import { ToolResult } from "@/tools/tool";

export async function captureAriaSnapshot(
  context: Context,
  status: string = "",
): Promise<ToolResult> {
  const url = await context.sendSocketMessage("getUrl", undefined);
  const title = await context.sendSocketMessage("getTitle", undefined);
  const snapshot = await context.sendSocketMessage("browser_snapshot", {});

  const snapshotStr =
    typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot);

  return {
    content: [
      {
        type: "text",
        text: `${status ? `${status}\n` : ""}
- Page URL: ${url}
- Page Title: ${title}
- Page Snapshot
\`\`\`yaml
${snapshotStr}
\`\`\`

Use the ref values (e.g. ref='e42') from the snapshot above when calling click, type, hover, selectOption, or fill. Always take a snapshot first to get fresh refs.`,
      },
    ],
  };
}
