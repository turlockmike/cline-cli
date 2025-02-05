import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import { ModelProvider } from "../"
import {
	ModelProviderOptions,
	mistralDefaultModelId,
	MistralModelId,
	mistralModels,
	ModelInfo,
} from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStream } from "../transform/stream"

export class MistralProvider implements ModelProvider {
	private options: ModelProviderOptions
	private client: Mistral

	constructor(options: ModelProviderOptions) {
		this.options = options
		this.client = new Mistral({
			serverURL: "https://codestral.mistral.ai",
			apiKey: this.options.mistralApiKey,
		})
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const stream = await this.client.chat.stream({
			model: this.getModel().id,
			temperature: 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
			stream: true,
		})

		for await (const chunk of stream) {
			const delta = chunk.data.choices[0]?.delta
			if (delta?.content) {
				let content: string = ""
				if (typeof delta.content === "string") {
					content = delta.content
				} else if (Array.isArray(delta.content)) {
					content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
				}
				yield {
					type: "text",
					text: content,
				}
			}

			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}

	getModel(): { id: MistralModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId as MistralModelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
	}
}