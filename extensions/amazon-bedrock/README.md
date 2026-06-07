# ACTAgent Amazon Bedrock Provider

Official ACTAgent provider plugin for Amazon Bedrock. It adds Bedrock model discovery, text generation, embeddings, and guardrail-aware provider routing for agents that use AWS-hosted models.

Install from ACTAgent:

```bash
actagent plugin add @actagent/amazon-bedrock-provider
```

Configure AWS credentials and region through your normal ACTAgent credential/profile setup, then select Bedrock models with the `amazon-bedrock/...` provider prefix.
