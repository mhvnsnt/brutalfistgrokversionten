import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as string, i as object, t as _enum } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/photobooth-CMLmHz7a.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var Input = object({
	prompt: string().min(8).max(1200),
	imageBase64: string().max(6e6).optional(),
	mode: _enum(["portrait", "stage"]).default("portrait")
});
var generateBoothArt_createServerFn_handler = createServerRpc({
	id: "3a26ed3112df3c87e18fd433b94bd4b6b51bb3fac9f6521cf1ac8721970e38aa",
	name: "generateBoothArt",
	filename: "src/lib/photobooth.ts"
}, (opts) => generateBoothArt.__executeServer(opts));
var generateBoothArt = createServerFn({ method: "POST" }).validator((input) => Input.parse(input)).handler(generateBoothArt_createServerFn_handler, async ({ data }) => {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		error: "Image booth is unavailable in this environment."
	};
	const prompt = data.mode === "stage" ? `${data.prompt}. Cinematic fighting-game stage concept art, wide establishing shot, dramatic lighting, no logos, no readable signage.` : `${data.prompt}. High-resolution fighting-game character select portrait, painted concept art, bust from mid-chest up, sharp facial detail, dramatic rim light, dark metallic backdrop. Not pixelated, not 8-bit, not low resolution.`;
	try {
		if (data.imageBase64) {
			const edited = await fetch("https://api.x.ai/v1/images/edits", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					model: "grok-imagine-image",
					prompt: `Use the uploaded photo as a hard pose / identity control (ControlNet-style). Keep silhouette, camera angle, face, and body type. ${prompt}`,
					image: data.imageBase64,
					n: 1,
					response_format: "b64_json"
				})
			});
			if (edited.ok) {
				const body = await edited.json();
				const art = body.data?.[0]?.b64_json ? `data:image/png;base64,${body.data[0].b64_json}` : body.data?.[0]?.url;
				if (art) return {
					ok: true,
					image: art
				};
			}
		}
		const res = await fetch("https://api.x.ai/v1/images/generations", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "grok-imagine-image",
				prompt,
				n: 1,
				response_format: "b64_json"
			})
		});
		if (!res.ok) return {
			ok: false,
			error: `Studio returned ${res.status}`
		};
		const body = await res.json();
		const art = body.data?.[0]?.b64_json ? `data:image/png;base64,${body.data[0].b64_json}` : body.data?.[0]?.url;
		if (!art) return {
			ok: false,
			error: "Studio returned an empty frame."
		};
		return {
			ok: true,
			image: art
		};
	} catch {
		return {
			ok: false,
			error: "Studio request failed."
		};
	}
});
//#endregion
export { generateBoothArt_createServerFn_handler };
