// Declares extension points for agent session type augmentation.
export type ACTAgentAgentSessionSkillSourceAugmentation = never;

declare module "actagent/plugin-sdk/agent-sessions" {
  interface Skill {
    // ACTAgent relies on the source identifier returned by skill loaders.
    source: string;
  }
}
