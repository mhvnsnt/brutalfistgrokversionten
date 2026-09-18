import { a as __toESM } from "../_runtime.mjs";
import { l as require_react } from "./@react-three/drei+[...].mjs";
import { i as require_use_gesture_core_actions_cjs, r as require_use_gesture_core_cjs } from "./use-gesture__core.mjs";
//#region node_modules/@use-gesture/react/dist/use-gesture-react.esm.js
var import_use_gesture_core_actions_cjs = require_use_gesture_core_actions_cjs();
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_use_gesture_core_cjs = require_use_gesture_core_cjs();
function useRecognizers(handlers, config = {}, gestureKey, nativeHandlers) {
	const ctrl = import_react.useMemo(() => new import_use_gesture_core_cjs.Controller(handlers), []);
	ctrl.applyHandlers(handlers, nativeHandlers);
	ctrl.applyConfig(config, gestureKey);
	import_react.useEffect(ctrl.effect.bind(ctrl));
	import_react.useEffect(() => {
		return ctrl.clean.bind(ctrl);
	}, []);
	if (config.target === void 0) return ctrl.bind.bind(ctrl);
}
function createUseGesture(actions) {
	actions.forEach(import_use_gesture_core_actions_cjs.registerAction);
	return function useGesture(_handlers, _config) {
		const { handlers, nativeHandlers, config } = (0, import_use_gesture_core_cjs.parseMergedHandlers)(_handlers, _config || {});
		return useRecognizers(handlers, config, void 0, nativeHandlers);
	};
}
function useGesture(handlers, config) {
	return createUseGesture([
		import_use_gesture_core_actions_cjs.dragAction,
		import_use_gesture_core_actions_cjs.pinchAction,
		import_use_gesture_core_actions_cjs.scrollAction,
		import_use_gesture_core_actions_cjs.wheelAction,
		import_use_gesture_core_actions_cjs.moveAction,
		import_use_gesture_core_actions_cjs.hoverAction
	])(handlers, config || {});
}
//#endregion
export { useGesture as t };
