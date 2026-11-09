import { z } from "zod";

export const privateNt4Tool = "_power_tool_nt4";
export const wpilibNt4Key = "mcp-wpilib/wpilib-nt4";

const target = { host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535) };
const owner = z.uuid();
const topic = z.string().startsWith("/").max(1024);
const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);
const publication = z.discriminatedUnion("type", [
  z.object({ type: z.literal("boolean"), value: z.boolean() }),
  z.object({ type: z.literal("double"), value: z.number().finite() }),
  z.object({ type: z.literal("int"), value: z.number().int() }),
  z.object({ type: z.literal("string"), value: z.string() })
]);
export const nt4BridgeRequest = z.union([
  z.object({ action: z.literal("probe"), ...target }),
  z.object({ action: z.literal("attach"), owner, ...target }),
  z.object({ action: z.enum(["heartbeat", "release"]), owner }),
  z.object({ action: z.literal("read"), owner, topicNames: z.boolean(), scopes: z.array(z.object({
    prefix: topic, intervalMs: z.number().int().min(10).max(10_000)
  })).max(256) }),
  z.intersection(z.object({ action: z.literal("publish"), owner, name: topic }), publication)
]);
export type Nt4BridgeRequest = z.infer<typeof nt4BridgeRequest>;

export const nt4BridgeReply = z.object({
  ready: z.boolean(),
  topicNames: z.array(z.string()).optional(),
  updates: z.array(z.object({
    name: z.string(), type: z.string(), lastChangedTime: z.number().optional(),
    raw: z.string().optional(), value: z.union([scalar, z.array(scalar.nullable()), z.null()]).optional()
  })).optional()
});
export type Nt4BridgeReply = z.infer<typeof nt4BridgeReply>;
