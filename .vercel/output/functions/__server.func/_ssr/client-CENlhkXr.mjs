//#region node_modules/.nitro/vite/services/ssr/assets/client-CENlhkXr.js
function thenable(value) {
	return Promise.resolve(value);
}
function chain(result = {
	data: [],
	error: null
}) {
	const api = {};
	for (const m of [
		"select",
		"insert",
		"update",
		"upsert",
		"delete",
		"eq",
		"neq",
		"gt",
		"lt",
		"gte",
		"lte",
		"in",
		"is",
		"order",
		"limit",
		"range",
		"maybeSingle",
		"single",
		"match",
		"filter",
		"or",
		"not",
		"ilike",
		"contains",
		"rpc"
	]) api[m] = (..._args) => chain(result);
	api.then = (resolve, reject) => thenable(result).then(resolve, reject);
	return api;
}
function createClient() {
	return {
		auth: {
			getSession: async () => ({
				data: { session: null },
				error: null
			}),
			getUser: async () => ({
				data: { user: null },
				error: null
			}),
			onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
			signInWithPassword: async () => ({
				data: {
					user: null,
					session: null
				},
				error: { message: "Cloud auth is offline in this build" }
			}),
			signUp: async () => ({
				data: {
					user: null,
					session: null
				},
				error: { message: "Cloud auth is offline in this build" }
			}),
			signOut: async () => ({ error: null })
		},
		from: (..._args) => chain(),
		rpc: (..._args) => chain(),
		channel: (..._args) => {
			const ch = {};
			ch.on = (..._a) => ch;
			ch.subscribe = (..._a) => ({ status: "offline" });
			ch.unsubscribe = (..._a) => ch;
			return ch;
		},
		removeChannel() {}
	};
}
//#endregion
export { createClient as t };
