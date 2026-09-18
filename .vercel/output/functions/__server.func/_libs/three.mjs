import { $ as MirroredRepeatWrapping, A as Interpolant, B as LinearMipmapNearestFilter, C as FileLoader, Ct as Texture, D as InstancedMesh, Dt as Vector3, E as InstancedBufferAttribute, Et as Vector2, F as LineBasicMaterial, H as Loader, I as LineLoop, J as Matrix4, K as Material, L as LineSegments, M as InterpolateLinear, N as Line, O as InterleavedBuffer, Ot as VectorKeyframeTrack, Q as MeshStandardMaterial, R as LinearFilter, St as SpotLight, T as ImageBitmapLoader, U as LoaderUtils, V as LinearSRGBColorSpace, X as MeshBasicMaterial, Y as Mesh, Z as MeshPhysicalMaterial, _t as SRGBColorSpace, at as OrthographicCamera, b as ColorManagement, bt as SkinnedMesh, dt as PointsMaterial, et as NearestFilter, ft as PropertyBinding, g as BufferGeometry, gt as RepeatWrapping, h as BufferAttribute, it as Object3D, j as InterpolateDiscrete, k as InterleavedBufferAttribute, lt as PointLight, m as Box3, mt as QuaternionKeyframeTrack, nt as NearestMipmapNearestFilter, ot as PerspectiveCamera, p as Bone, pt as Quaternion, q as MathUtils, rt as NumberKeyframeTrack, tt as NearestMipmapLinearFilter, u as AnimationClip, ut as Points, v as ClampToEdgeWrapping, vt as Skeleton, w as Group, wt as TextureLoader, x as DirectionalLight, xt as Sphere, y as Color, z as LinearMipmapLinearFilter } from "./@react-three/drei+[...].mjs";
//#region node_modules/three/examples/jsm/utils/BufferGeometryUtils.js
/**
* Converts the given geometry to the `TrianglesDrawMode` draw mode, which
* corresponds to the `gl.TRIANGLES` primitive in WebGL. The conversion only
* rewrites the index, so the geometry is modified in place and returned.
*
* @param {BufferGeometry} geometry - The geometry to convert.
* @param {number} drawMode - The current draw mode.
* @return {BufferGeometry} The converted geometry using `TrianglesDrawMode`.
*/
function toTrianglesDrawMode(geometry, drawMode) {
	if (drawMode === 0) {
		console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
		return geometry;
	}
	if (drawMode === 2 || drawMode === 1) {
		let index = geometry.getIndex();
		if (index === null) {
			const indices = [];
			const position = geometry.getAttribute("position");
			if (position !== void 0) {
				for (let i = 0; i < position.count; i++) indices.push(i);
				geometry.setIndex(indices);
				index = geometry.getIndex();
			} else {
				console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.");
				return geometry;
			}
		}
		const numberOfTriangles = index.count - 2;
		const newIndices = [];
		if (drawMode === 2) for (let i = 1; i <= numberOfTriangles; i++) {
			newIndices.push(index.getX(0));
			newIndices.push(index.getX(i));
			newIndices.push(index.getX(i + 1));
		}
		else for (let i = 0; i < numberOfTriangles; i++) if (i % 2 === 0) {
			newIndices.push(index.getX(i));
			newIndices.push(index.getX(i + 1));
			newIndices.push(index.getX(i + 2));
		} else {
			newIndices.push(index.getX(i + 2));
			newIndices.push(index.getX(i + 1));
			newIndices.push(index.getX(i));
		}
		if (newIndices.length / 3 !== numberOfTriangles) console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
		geometry.setIndex(newIndices);
		geometry.clearGroups();
		return geometry;
	} else {
		console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
		return geometry;
	}
}
//#endregion
//#region node_modules/three/examples/jsm/utils/SkeletonUtils.js
/**
* Clones the given 3D object and its descendants, ensuring that any `SkinnedMesh` instances are
* correctly associated with their bones. Bones are also cloned, and must be descendants of the
* object passed to this method. Other data, like geometries and materials, are reused by reference.
*
* @param {Object3D} source - The 3D object to clone.
* @return {Object3D} The cloned 3D object.
*/
function clone(source) {
	const sourceLookup = /* @__PURE__ */ new Map();
	const cloneLookup = /* @__PURE__ */ new Map();
	const clone = source.clone();
	parallelTraverse(source, clone, function(sourceNode, clonedNode) {
		sourceLookup.set(clonedNode, sourceNode);
		cloneLookup.set(sourceNode, clonedNode);
	});
	clone.traverse(function(node) {
		if (!node.isSkinnedMesh) return;
		const clonedMesh = node;
		const sourceMesh = sourceLookup.get(node);
		const sourceBones = sourceMesh.skeleton.bones;
		clonedMesh.skeleton = sourceMesh.skeleton.clone();
		clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);
		clonedMesh.skeleton.bones = sourceBones.map(function(bone) {
			return cloneLookup.get(bone);
		});
		clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
	});
	return clone;
}
function parallelTraverse(a, b, callback) {
	callback(a, b);
	for (let i = 0; i < a.children.length; i++) parallelTraverse(a.children[i], b.children[i], callback);
}
//#endregion
//#region node_modules/three/examples/jsm/loaders/GLTFLoader.js
/**
* A loader for the glTF 2.0 format.
*
* [glTF](https://www.khronos.org/gltf/) (GL Transmission Format) is an [open format specification]{@link https://github.com/KhronosGroup/glTF/tree/main/specification/2.0)
* for efficient delivery and loading of 3D content. Assets may be provided either in JSON (.gltf) or binary (.glb)
* format. External files store textures (.jpg, .png) and additional binary data (.bin). A glTF asset may deliver
* one or more scenes, including meshes, materials, textures, skins, skeletons, morph targets, animations, lights,
* and/or cameras.
*
* `GLTFLoader` uses {@link ImageBitmapLoader} whenever possible. Be advised that image bitmaps are not
* automatically GC-collected when they are no longer referenced, and they require special handling during
* the disposal process.
*
* `GLTFLoader` supports the following glTF 2.0 extensions:
* - KHR_draco_mesh_compression
* - KHR_lights_punctual
* - KHR_materials_anisotropy
* - KHR_materials_clearcoat
* - KHR_materials_dispersion
* - KHR_materials_emissive_strength
* - KHR_materials_ior
* - KHR_materials_specular
* - KHR_materials_transmission
* - KHR_materials_iridescence
* - KHR_materials_unlit
* - KHR_materials_volume
* - KHR_mesh_quantization
* - KHR_meshopt_compression
* - KHR_texture_basisu
* - KHR_texture_transform
* - EXT_materials_bump
* - EXT_meshopt_compression
* - EXT_mesh_gpu_instancing
* - EXT_texture_avif
* - EXT_texture_webp
*
* The following glTF 2.0 extensions are supported by separately registered plugins:
* - KHR_gaussian_splatting
* - [KHR_materials_variants](https://github.com/takahirox/three-gltf-extensions)
* - [MSFT_texture_dds](https://github.com/takahirox/three-gltf-extensions)
* - [KHR_animation_pointer](https://github.com/needle-tools/three-animation-pointer)
* - [NEEDLE_progressive](https://github.com/needle-tools/gltf-progressive)
*
* ```js
* const loader = new GLTFLoader();
*
* // Optional: Provide a DRACOLoader instance to decode compressed mesh data
* const dracoLoader = new DRACOLoader();
* dracoLoader.setDecoderPath( '/examples/jsm/libs/draco/' );
* loader.setDRACOLoader( dracoLoader );
*
* const gltf = await loader.loadAsync( 'models/gltf/duck/duck.gltf' );
* scene.add( gltf.scene );
* ```
*
* @augments Loader
* @three_import import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
*/
var GLTFLoader = class extends Loader {
	/**
	* Constructs a new glTF loader.
	*
	* @param {LoadingManager} [manager] - The loading manager.
	*/
	constructor(manager) {
		super(manager);
		this.dracoLoader = null;
		this.ktx2Loader = null;
		this.meshoptDecoder = null;
		this.pluginCallbacks = [];
		this.register(function(parser) {
			return new GLTFMaterialsClearcoatExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsDispersionExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFTextureBasisUExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFTextureWebPExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFTextureAVIFExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsSheenExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsTransmissionExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsVolumeExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsIorExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsEmissiveStrengthExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsSpecularExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsIridescenceExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsAnisotropyExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMaterialsBumpExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFLightsExtension(parser);
		});
		this.register(function(parser) {
			return new GLTFMeshoptCompression(parser, EXTENSIONS.EXT_MESHOPT_COMPRESSION);
		});
		this.register(function(parser) {
			return new GLTFMeshoptCompression(parser, EXTENSIONS.KHR_MESHOPT_COMPRESSION);
		});
		this.register(function(parser) {
			return new GLTFMeshGpuInstancing(parser);
		});
	}
	/**
	* Starts loading from the given URL and passes the loaded glTF asset
	* to the `onLoad()` callback.
	*
	* @param {string} url - The path/URL of the file to be loaded. This can also be a data URI.
	* @param {function(GLTFLoader~LoadObject)} onLoad - Executed when the loading process has been finished.
	* @param {onProgressCallback} onProgress - Executed while the loading is in progress.
	* @param {onErrorCallback} onError - Executed when errors occur.
	*/
	load(url, onLoad, onProgress, onError) {
		const scope = this;
		let resourcePath;
		if (this.resourcePath !== "") resourcePath = this.resourcePath;
		else if (this.path !== "") {
			const relativeUrl = LoaderUtils.extractUrlBase(url);
			resourcePath = LoaderUtils.resolveURL(relativeUrl, this.path);
		} else resourcePath = LoaderUtils.extractUrlBase(url);
		this.manager.itemStart(url);
		const _onError = function(e) {
			if (onError) onError(e);
			else console.error(e);
			scope.manager.itemError(url);
			scope.manager.itemEnd(url);
		};
		const loader = new FileLoader(this.manager);
		loader.setPath(this.path);
		loader.setResponseType("arraybuffer");
		loader.setRequestHeader(this.requestHeader);
		loader.setWithCredentials(this.withCredentials);
		loader.load(url, function(data) {
			try {
				scope.parse(data, resourcePath, function(gltf) {
					onLoad(gltf);
					scope.manager.itemEnd(url);
				}, _onError);
			} catch (e) {
				_onError(e);
			}
		}, onProgress, _onError);
	}
	/**
	* Sets the given Draco loader to this loader. Required for decoding assets
	* compressed with the `KHR_draco_mesh_compression` extension.
	*
	* @param {DRACOLoader} dracoLoader - The Draco loader to set.
	* @return {GLTFLoader} A reference to this loader.
	*/
	setDRACOLoader(dracoLoader) {
		this.dracoLoader = dracoLoader;
		return this;
	}
	/**
	* Sets the given KTX2 loader to this loader. Required for loading KTX2
	* compressed textures.
	*
	* @param {KTX2Loader} ktx2Loader - The KTX2 loader to set.
	* @return {GLTFLoader} A reference to this loader.
	*/
	setKTX2Loader(ktx2Loader) {
		this.ktx2Loader = ktx2Loader;
		return this;
	}
	/**
	* Sets the given meshopt decoder. Required for decoding assets
	* compressed with the `EXT_meshopt_compression` extension.
	*
	* @param {Object} meshoptDecoder - The meshopt decoder to set.
	* @return {GLTFLoader} A reference to this loader.
	*/
	setMeshoptDecoder(meshoptDecoder) {
		this.meshoptDecoder = meshoptDecoder;
		return this;
	}
	/**
	* Registers a plugin callback. This API is internally used to implement the various
	* glTF extensions but can also used by third-party code to add additional logic
	* to the loader.
	*
	* @param {function(parser:GLTFParser)} callback - The callback function to register.
	* @return {GLTFLoader} A reference to this loader.
	*/
	register(callback) {
		if (this.pluginCallbacks.indexOf(callback) === -1) this.pluginCallbacks.push(callback);
		return this;
	}
	/**
	* Unregisters a plugin callback.
	*
	* @param {Function} callback - The callback function to unregister.
	* @return {GLTFLoader} A reference to this loader.
	*/
	unregister(callback) {
		if (this.pluginCallbacks.indexOf(callback) !== -1) this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1);
		return this;
	}
	/**
	* Parses the given glTF data and returns the resulting group.
	*
	* @param {string|ArrayBuffer} data - The raw glTF data.
	* @param {string} path - The URL base path.
	* @param {function(GLTFLoader~LoadObject)} onLoad - Executed when the loading process has been finished.
	* @param {onErrorCallback} onError - Executed when errors occur.
	*/
	parse(data, path, onLoad, onError) {
		let json;
		const extensions = {};
		const plugins = {};
		const textDecoder = new TextDecoder();
		if (typeof data === "string") json = JSON.parse(data);
		else if (data instanceof ArrayBuffer) {
			if (textDecoder.decode(new Uint8Array(data, 0, 4)) === BINARY_EXTENSION_HEADER_MAGIC) {
				try {
					extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data);
				} catch (error) {
					if (onError) onError(error);
					return;
				}
				json = JSON.parse(extensions[EXTENSIONS.KHR_BINARY_GLTF].content);
			} else json = JSON.parse(textDecoder.decode(data));
		} else json = data;
		if (json.asset === void 0 || json.asset.version[0] < 2) {
			if (onError) onError(/* @__PURE__ */ new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));
			return;
		}
		const parser = new GLTFParser(json, {
			path: path || this.resourcePath || "",
			crossOrigin: this.crossOrigin,
			requestHeader: this.requestHeader,
			manager: this.manager,
			ktx2Loader: this.ktx2Loader,
			meshoptDecoder: this.meshoptDecoder
		});
		parser.fileLoader.setRequestHeader(this.requestHeader);
		for (let i = 0; i < this.pluginCallbacks.length; i++) {
			const plugin = this.pluginCallbacks[i](parser);
			if (!plugin.name) console.error("THREE.GLTFLoader: Invalid plugin found: missing name");
			plugins[plugin.name] = plugin;
			extensions[plugin.name] = true;
		}
		if (json.extensionsUsed) for (let i = 0; i < json.extensionsUsed.length; ++i) {
			const extensionName = json.extensionsUsed[i];
			const extensionsRequired = json.extensionsRequired || [];
			switch (extensionName) {
				case EXTENSIONS.KHR_MATERIALS_UNLIT:
					extensions[extensionName] = new GLTFMaterialsUnlitExtension();
					break;
				case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
					extensions[extensionName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader);
					break;
				case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
					extensions[extensionName] = new GLTFTextureTransformExtension();
					break;
				case EXTENSIONS.KHR_MESH_QUANTIZATION:
					extensions[extensionName] = new GLTFMeshQuantizationExtension();
					break;
				default: if (extensionsRequired.indexOf(extensionName) >= 0 && plugins[extensionName] === void 0) console.warn("THREE.GLTFLoader: Unknown extension \"" + extensionName + "\".");
			}
		}
		parser.setExtensions(extensions);
		parser.setPlugins(plugins);
		parser.parse(onLoad, onError);
	}
	/**
	* Async version of {@link GLTFLoader#parse}.
	*
	* @async
	* @param {string|ArrayBuffer} data - The raw glTF data.
	* @param {string} path - The URL base path.
	* @return {Promise<GLTFLoader~LoadObject>} A Promise that resolves with the loaded glTF when the parsing has been finished.
	*/
	parseAsync(data, path) {
		const scope = this;
		return new Promise(function(resolve, reject) {
			scope.parse(data, path, resolve, reject);
		});
	}
};
function GLTFRegistry() {
	let objects = {};
	return {
		get: function(key) {
			return objects[key];
		},
		add: function(key, object) {
			objects[key] = object;
		},
		remove: function(key) {
			delete objects[key];
		},
		removeAll: function() {
			objects = {};
		}
	};
}
/********** EXTENSIONS ***********/
function getMaterialExtension(parser, materialIndex, extensionName) {
	const materialDef = parser.json.materials[materialIndex];
	if (materialDef.extensions && materialDef.extensions[extensionName]) return materialDef.extensions[extensionName];
	return null;
}
var EXTENSIONS = {
	KHR_BINARY_GLTF: "KHR_binary_glTF",
	KHR_DRACO_MESH_COMPRESSION: "KHR_draco_mesh_compression",
	KHR_LIGHTS_PUNCTUAL: "KHR_lights_punctual",
	KHR_MATERIALS_CLEARCOAT: "KHR_materials_clearcoat",
	KHR_MATERIALS_DISPERSION: "KHR_materials_dispersion",
	KHR_MATERIALS_IOR: "KHR_materials_ior",
	KHR_MATERIALS_SHEEN: "KHR_materials_sheen",
	KHR_MATERIALS_SPECULAR: "KHR_materials_specular",
	KHR_MATERIALS_TRANSMISSION: "KHR_materials_transmission",
	KHR_MATERIALS_IRIDESCENCE: "KHR_materials_iridescence",
	KHR_MATERIALS_ANISOTROPY: "KHR_materials_anisotropy",
	KHR_MATERIALS_UNLIT: "KHR_materials_unlit",
	KHR_MATERIALS_VOLUME: "KHR_materials_volume",
	KHR_TEXTURE_BASISU: "KHR_texture_basisu",
	KHR_TEXTURE_TRANSFORM: "KHR_texture_transform",
	KHR_MESH_QUANTIZATION: "KHR_mesh_quantization",
	KHR_MATERIALS_EMISSIVE_STRENGTH: "KHR_materials_emissive_strength",
	EXT_MATERIALS_BUMP: "EXT_materials_bump",
	EXT_TEXTURE_WEBP: "EXT_texture_webp",
	EXT_TEXTURE_AVIF: "EXT_texture_avif",
	EXT_MESHOPT_COMPRESSION: "EXT_meshopt_compression",
	KHR_MESHOPT_COMPRESSION: "KHR_meshopt_compression",
	EXT_MESH_GPU_INSTANCING: "EXT_mesh_gpu_instancing"
};
/**
* Punctual Lights Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
*
* @private
*/
var GLTFLightsExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;
		this.cache = {
			refs: {},
			uses: {}
		};
	}
	_markDefs() {
		const parser = this.parser;
		const nodeDefs = this.parser.json.nodes || [];
		for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
			const nodeDef = nodeDefs[nodeIndex];
			if (nodeDef.extensions && nodeDef.extensions[this.name] && nodeDef.extensions[this.name].light !== void 0) parser._addNodeRef(this.cache, nodeDef.extensions[this.name].light);
		}
	}
	_loadLight(lightIndex) {
		const parser = this.parser;
		const cacheKey = "light:" + lightIndex;
		let dependency = parser.cache.get(cacheKey);
		if (dependency) return dependency;
		const json = parser.json;
		const lightDef = ((json.extensions && json.extensions[this.name] || {}).lights || [])[lightIndex];
		let lightNode;
		const color = new Color(16777215);
		if (lightDef.color !== void 0) color.setRGB(lightDef.color[0], lightDef.color[1], lightDef.color[2], LinearSRGBColorSpace);
		const range = lightDef.range !== void 0 ? lightDef.range : 0;
		switch (lightDef.type) {
			case "directional":
				lightNode = new DirectionalLight(color);
				lightNode.target.position.set(0, 0, -1);
				lightNode.add(lightNode.target);
				break;
			case "point":
				lightNode = new PointLight(color);
				lightNode.distance = range;
				break;
			case "spot":
				lightNode = new SpotLight(color);
				lightNode.distance = range;
				lightDef.spot = lightDef.spot || {};
				lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== void 0 ? lightDef.spot.innerConeAngle : 0;
				lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== void 0 ? lightDef.spot.outerConeAngle : Math.PI / 4;
				lightNode.angle = lightDef.spot.outerConeAngle;
				lightNode.penumbra = 1 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
				lightNode.target.position.set(0, 0, -1);
				lightNode.add(lightNode.target);
				break;
			default: throw new Error("THREE.GLTFLoader: Unexpected light type: " + lightDef.type);
		}
		lightNode.position.set(0, 0, 0);
		assignExtrasToUserData(lightNode, lightDef);
		if (lightDef.intensity !== void 0) lightNode.intensity = lightDef.intensity;
		lightNode.name = parser.createUniqueName(lightDef.name || "light_" + lightIndex);
		dependency = Promise.resolve(lightNode);
		parser.cache.add(cacheKey, dependency);
		return dependency;
	}
	getDependency(type, index) {
		if (type !== "light") return;
		return this._loadLight(index);
	}
	createNodeAttachment(nodeIndex) {
		const self = this;
		const parser = this.parser;
		const nodeDef = parser.json.nodes[nodeIndex];
		const lightIndex = (nodeDef.extensions && nodeDef.extensions[this.name] || {}).light;
		if (lightIndex === void 0) return null;
		return this._loadLight(lightIndex).then(function(light) {
			return parser._getNodeRef(self.cache, lightIndex, light);
		});
	}
};
/**
* Unlit Materials Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
*
* @private
*/
var GLTFMaterialsUnlitExtension = class {
	constructor() {
		this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;
	}
	getMaterialType() {
		return MeshBasicMaterial;
	}
	extendParams(materialParams, materialDef, parser) {
		const pending = [];
		materialParams.color = new Color(1, 1, 1);
		materialParams.opacity = 1;
		const metallicRoughness = materialDef.pbrMetallicRoughness;
		if (metallicRoughness) {
			if (Array.isArray(metallicRoughness.baseColorFactor)) {
				const array = metallicRoughness.baseColorFactor;
				materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
				materialParams.opacity = array[3];
			}
			if (metallicRoughness.baseColorTexture !== void 0) pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
		}
		return Promise.all(pending);
	}
};
/**
* Materials Emissive Strength Extension
*
* Specification: https://github.com/KhronosGroup/glTF/blob/5768b3ce0ef32bc39cdf1bef10b948586635ead3/extensions/2.0/Khronos/KHR_materials_emissive_strength/README.md
*
* @private
*/
var GLTFMaterialsEmissiveStrengthExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		if (extension.emissiveStrength !== void 0) materialParams.emissiveIntensity = extension.emissiveStrength;
		return Promise.resolve();
	}
};
/**
* Clearcoat Materials Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
*
* @private
*/
var GLTFMaterialsClearcoatExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		if (extension.clearcoatFactor !== void 0) materialParams.clearcoat = extension.clearcoatFactor;
		if (extension.clearcoatTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "clearcoatMap", extension.clearcoatTexture));
		if (extension.clearcoatRoughnessFactor !== void 0) materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;
		if (extension.clearcoatRoughnessTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "clearcoatRoughnessMap", extension.clearcoatRoughnessTexture));
		if (extension.clearcoatNormalTexture !== void 0) {
			pending.push(this.parser.assignTexture(materialParams, "clearcoatNormalMap", extension.clearcoatNormalTexture));
			if (extension.clearcoatNormalTexture.scale !== void 0) {
				const scale = extension.clearcoatNormalTexture.scale;
				materialParams.clearcoatNormalScale = new Vector2(scale, scale);
			}
		}
		return Promise.all(pending);
	}
};
/**
* Materials dispersion Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_dispersion
*
* @private
*/
var GLTFMaterialsDispersionExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_DISPERSION;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		materialParams.dispersion = extension.dispersion !== void 0 ? extension.dispersion : 0;
		return Promise.resolve();
	}
};
/**
* Iridescence Materials Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_iridescence
*
* @private
*/
var GLTFMaterialsIridescenceExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_IRIDESCENCE;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		if (extension.iridescenceFactor !== void 0) materialParams.iridescence = extension.iridescenceFactor;
		if (extension.iridescenceTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "iridescenceMap", extension.iridescenceTexture));
		if (extension.iridescenceIor !== void 0) materialParams.iridescenceIOR = extension.iridescenceIor;
		if (materialParams.iridescenceThicknessRange === void 0) materialParams.iridescenceThicknessRange = [100, 400];
		if (extension.iridescenceThicknessMinimum !== void 0) materialParams.iridescenceThicknessRange[0] = extension.iridescenceThicknessMinimum;
		if (extension.iridescenceThicknessMaximum !== void 0) materialParams.iridescenceThicknessRange[1] = extension.iridescenceThicknessMaximum;
		if (extension.iridescenceThicknessTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "iridescenceThicknessMap", extension.iridescenceThicknessTexture));
		return Promise.all(pending);
	}
};
/**
* Sheen Materials Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
*
* @private
*/
var GLTFMaterialsSheenExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		materialParams.sheenColor = new Color(0, 0, 0);
		materialParams.sheenRoughness = 0;
		materialParams.sheen = 1;
		if (extension.sheenColorFactor !== void 0) {
			const colorFactor = extension.sheenColorFactor;
			materialParams.sheenColor.setRGB(colorFactor[0], colorFactor[1], colorFactor[2], LinearSRGBColorSpace);
		}
		if (extension.sheenRoughnessFactor !== void 0) materialParams.sheenRoughness = extension.sheenRoughnessFactor;
		if (extension.sheenColorTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "sheenColorMap", extension.sheenColorTexture, SRGBColorSpace));
		if (extension.sheenRoughnessTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "sheenRoughnessMap", extension.sheenRoughnessTexture));
		return Promise.all(pending);
	}
};
/**
* Transmission Materials Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
* Draft: https://github.com/KhronosGroup/glTF/pull/1698
*
* @private
*/
var GLTFMaterialsTransmissionExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		if (extension.transmissionFactor !== void 0) materialParams.transmission = extension.transmissionFactor;
		if (extension.transmissionTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "transmissionMap", extension.transmissionTexture));
		return Promise.all(pending);
	}
};
/**
* Materials Volume Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
*
* @private
*/
var GLTFMaterialsVolumeExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		materialParams.thickness = extension.thicknessFactor !== void 0 ? extension.thicknessFactor : 0;
		if (extension.thicknessTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "thicknessMap", extension.thicknessTexture));
		materialParams.attenuationDistance = extension.attenuationDistance || Infinity;
		const colorArray = extension.attenuationColor || [
			1,
			1,
			1
		];
		materialParams.attenuationColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
		return Promise.all(pending);
	}
};
/**
* Materials ior Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior
*
* @private
*/
var GLTFMaterialsIorExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_IOR;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		materialParams.ior = extension.ior !== void 0 ? extension.ior : 1.5;
		if (materialParams.ior === 0) materialParams.ior = 1e3;
		return Promise.resolve();
	}
};
/**
* Materials specular Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
*
* @private
*/
var GLTFMaterialsSpecularExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		materialParams.specularIntensity = extension.specularFactor !== void 0 ? extension.specularFactor : 1;
		if (extension.specularTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "specularIntensityMap", extension.specularTexture));
		const colorArray = extension.specularColorFactor || [
			1,
			1,
			1
		];
		materialParams.specularColor = new Color().setRGB(colorArray[0], colorArray[1], colorArray[2], LinearSRGBColorSpace);
		if (extension.specularColorTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "specularColorMap", extension.specularColorTexture, SRGBColorSpace));
		return Promise.all(pending);
	}
};
/**
* Materials bump Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/EXT_materials_bump
*
* @private
*/
var GLTFMaterialsBumpExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.EXT_MATERIALS_BUMP;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		materialParams.bumpScale = extension.bumpFactor !== void 0 ? extension.bumpFactor : 1;
		if (extension.bumpTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "bumpMap", extension.bumpTexture));
		return Promise.all(pending);
	}
};
/**
* Materials anisotropy Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_anisotropy
*
* @private
*/
var GLTFMaterialsAnisotropyExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_MATERIALS_ANISOTROPY;
	}
	getMaterialType(materialIndex) {
		return getMaterialExtension(this.parser, materialIndex, this.name) !== null ? MeshPhysicalMaterial : null;
	}
	extendMaterialParams(materialIndex, materialParams) {
		const extension = getMaterialExtension(this.parser, materialIndex, this.name);
		if (extension === null) return Promise.resolve();
		const pending = [];
		if (extension.anisotropyStrength !== void 0) materialParams.anisotropy = extension.anisotropyStrength;
		if (extension.anisotropyRotation !== void 0) materialParams.anisotropyRotation = extension.anisotropyRotation;
		if (extension.anisotropyTexture !== void 0) pending.push(this.parser.assignTexture(materialParams, "anisotropyMap", extension.anisotropyTexture));
		return Promise.all(pending);
	}
};
/**
* BasisU Texture Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
*
* @private
*/
var GLTFTextureBasisUExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.KHR_TEXTURE_BASISU;
	}
	loadTexture(textureIndex) {
		const parser = this.parser;
		const json = parser.json;
		const textureDef = json.textures[textureIndex];
		if (!textureDef.extensions || !textureDef.extensions[this.name]) return null;
		const extension = textureDef.extensions[this.name];
		const loader = parser.options.ktx2Loader;
		if (!loader) {
			if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");
			else return null;
		}
		return parser.loadTextureImage(textureIndex, extension.source, loader);
	}
};
/**
* WebP Texture Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_webp
*
* @private
*/
var GLTFTextureWebPExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
	}
	loadTexture(textureIndex) {
		const name = this.name;
		const parser = this.parser;
		const json = parser.json;
		const textureDef = json.textures[textureIndex];
		if (!textureDef.extensions || !textureDef.extensions[name]) return null;
		const extension = textureDef.extensions[name];
		const source = json.images[extension.source];
		let loader = parser.textureLoader;
		if (source.uri) {
			const handler = parser.options.manager.getHandler(source.uri);
			if (handler !== null) loader = handler;
		}
		return parser.loadTextureImage(textureIndex, extension.source, loader);
	}
};
/**
* AVIF Texture Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_avif
*
* @private
*/
var GLTFTextureAVIFExtension = class {
	constructor(parser) {
		this.parser = parser;
		this.name = EXTENSIONS.EXT_TEXTURE_AVIF;
	}
	loadTexture(textureIndex) {
		const name = this.name;
		const parser = this.parser;
		const json = parser.json;
		const textureDef = json.textures[textureIndex];
		if (!textureDef.extensions || !textureDef.extensions[name]) return null;
		const extension = textureDef.extensions[name];
		const source = json.images[extension.source];
		let loader = parser.textureLoader;
		if (source.uri) {
			const handler = parser.options.manager.getHandler(source.uri);
			if (handler !== null) loader = handler;
		}
		return parser.loadTextureImage(textureIndex, extension.source, loader);
	}
};
/**
* meshopt BufferView Compression Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
*
* @private
*/
var GLTFMeshoptCompression = class {
	constructor(parser, name) {
		this.name = name;
		this.parser = parser;
	}
	loadBufferView(index) {
		const json = this.parser.json;
		const bufferView = json.bufferViews[index];
		if (bufferView.extensions && bufferView.extensions[this.name]) {
			const extensionDef = bufferView.extensions[this.name];
			const buffer = this.parser.getDependency("buffer", extensionDef.buffer);
			const decoder = this.parser.options.meshoptDecoder;
			if (!decoder || !decoder.supported) {
				if (json.extensionsRequired && json.extensionsRequired.indexOf(this.name) >= 0) throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");
				else return null;
			}
			return buffer.then(function(res) {
				const byteOffset = extensionDef.byteOffset || 0;
				const byteLength = extensionDef.byteLength || 0;
				const count = extensionDef.count;
				const stride = extensionDef.byteStride;
				const source = new Uint8Array(res, byteOffset, byteLength);
				if (decoder.decodeGltfBufferAsync) return decoder.decodeGltfBufferAsync(count, stride, source, extensionDef.mode, extensionDef.filter).then(function(res) {
					return res.buffer;
				});
				else return decoder.ready.then(function() {
					const result = new ArrayBuffer(count * stride);
					decoder.decodeGltfBuffer(new Uint8Array(result), count, stride, source, extensionDef.mode, extensionDef.filter);
					return result;
				});
			});
		} else return null;
	}
};
/**
* GPU Instancing Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
*
* @private
*/
var GLTFMeshGpuInstancing = class {
	constructor(parser) {
		this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING;
		this.parser = parser;
	}
	createNodeMesh(nodeIndex) {
		const json = this.parser.json;
		const nodeDef = json.nodes[nodeIndex];
		if (!nodeDef.extensions || !nodeDef.extensions[this.name] || nodeDef.mesh === void 0) return null;
		const meshDef = json.meshes[nodeDef.mesh];
		for (const primitive of meshDef.primitives) if (primitive.mode !== WEBGL_CONSTANTS.TRIANGLES && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP && primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN && primitive.mode !== void 0) return null;
		const attributesDef = nodeDef.extensions[this.name].attributes;
		const pending = [];
		const attributes = {};
		for (const key in attributesDef) pending.push(this.parser.getDependency("accessor", attributesDef[key]).then((accessor) => {
			attributes[key] = accessor;
			return attributes[key];
		}));
		if (pending.length < 1) return null;
		pending.push(this.parser.createNodeMesh(nodeIndex));
		return Promise.all(pending).then((results) => {
			const nodeObject = results.pop();
			const meshes = nodeObject.isGroup ? nodeObject.children : [nodeObject];
			const count = results[0].count;
			const instancedMeshes = [];
			for (const mesh of meshes) {
				const m = new Matrix4();
				const p = new Vector3();
				const q = new Quaternion();
				const s = new Vector3(1, 1, 1);
				const instancedMesh = new InstancedMesh(mesh.geometry, mesh.material, count);
				for (let i = 0; i < count; i++) {
					if (attributes.TRANSLATION) p.fromBufferAttribute(attributes.TRANSLATION, i);
					if (attributes.ROTATION) q.fromBufferAttribute(attributes.ROTATION, i);
					if (attributes.SCALE) s.fromBufferAttribute(attributes.SCALE, i);
					instancedMesh.setMatrixAt(i, m.compose(p, q, s));
				}
				let instanceGeometry = null;
				for (const attributeName in attributes) if (attributeName === "_COLOR_0") {
					const attr = attributes[attributeName];
					instancedMesh.instanceColor = new InstancedBufferAttribute(attr.array, attr.itemSize, attr.normalized);
				} else if (attributeName !== "TRANSLATION" && attributeName !== "ROTATION" && attributeName !== "SCALE") {
					if (instanceGeometry === null) {
						const source = instancedMesh.geometry;
						instanceGeometry = new BufferGeometry();
						instanceGeometry.name = source.name;
						for (const name in source.attributes) instanceGeometry.setAttribute(name, source.attributes[name]);
						for (const name in source.morphAttributes) instanceGeometry.morphAttributes[name] = source.morphAttributes[name];
						if (source.index !== null) instanceGeometry.setIndex(source.index);
						instanceGeometry.morphTargetsRelative = source.morphTargetsRelative;
						for (const group of source.groups) instanceGeometry.addGroup(group.start, group.count, group.materialIndex);
						if (source.boundingBox !== null) instanceGeometry.boundingBox = source.boundingBox.clone();
						if (source.boundingSphere !== null) instanceGeometry.boundingSphere = source.boundingSphere.clone();
						instanceGeometry.drawRange.start = source.drawRange.start;
						instanceGeometry.drawRange.count = source.drawRange.count;
						instanceGeometry.userData = Object.assign({}, source.userData);
						instancedMesh.geometry = instanceGeometry;
					}
					const attr = attributes[attributeName];
					instanceGeometry.setAttribute(attributeName, new InstancedBufferAttribute(attr.array, attr.itemSize, attr.normalized));
				}
				Object3D.prototype.copy.call(instancedMesh, mesh);
				this.parser.assignFinalMaterial(instancedMesh);
				instancedMeshes.push(instancedMesh);
			}
			if (nodeObject.isGroup) {
				nodeObject.clear();
				nodeObject.add(...instancedMeshes);
				return nodeObject;
			}
			return instancedMeshes[0];
		});
	}
};
var BINARY_EXTENSION_HEADER_MAGIC = "glTF";
var BINARY_EXTENSION_HEADER_LENGTH = 12;
var BINARY_EXTENSION_CHUNK_TYPES = {
	JSON: 1313821514,
	BIN: 5130562
};
var GLTFBinaryExtension = class {
	constructor(data) {
		this.name = EXTENSIONS.KHR_BINARY_GLTF;
		this.content = null;
		this.body = null;
		const headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH);
		const textDecoder = new TextDecoder();
		this.header = {
			magic: textDecoder.decode(new Uint8Array(data.slice(0, 4))),
			version: headerView.getUint32(4, true),
			length: headerView.getUint32(8, true)
		};
		if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");
		else if (this.header.version < 2) throw new Error("THREE.GLTFLoader: Legacy binary file detected.");
		const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
		const chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH);
		let chunkIndex = 0;
		while (chunkIndex < chunkContentsLength) {
			const chunkLength = chunkView.getUint32(chunkIndex, true);
			chunkIndex += 4;
			const chunkType = chunkView.getUint32(chunkIndex, true);
			chunkIndex += 4;
			if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {
				const contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength);
				this.content = textDecoder.decode(contentArray);
			} else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {
				const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
				this.body = data.slice(byteOffset, byteOffset + chunkLength);
			}
			chunkIndex += chunkLength;
		}
		if (this.content === null) throw new Error("THREE.GLTFLoader: JSON content not found.");
	}
};
/**
* DRACO Mesh Compression Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
*
* @private
*/
var GLTFDracoMeshCompressionExtension = class {
	constructor(json, dracoLoader) {
		if (!dracoLoader) throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");
		this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
		this.json = json;
		this.dracoLoader = dracoLoader;
		this.dracoLoader.preload();
	}
	decodePrimitive(primitive, parser) {
		const json = this.json;
		const dracoLoader = this.dracoLoader;
		const bufferViewIndex = primitive.extensions[this.name].bufferView;
		const gltfAttributeMap = primitive.extensions[this.name].attributes;
		const threeAttributeMap = {};
		const attributeNormalizedMap = {};
		const attributeTypeMap = {};
		for (const attributeName in gltfAttributeMap) {
			const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
			threeAttributeMap[threeAttributeName] = gltfAttributeMap[attributeName];
		}
		for (const attributeName in primitive.attributes) {
			const threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase();
			if (gltfAttributeMap[attributeName] !== void 0) {
				const accessorDef = json.accessors[primitive.attributes[attributeName]];
				attributeTypeMap[threeAttributeName] = WEBGL_COMPONENT_TYPES[accessorDef.componentType].name;
				attributeNormalizedMap[threeAttributeName] = accessorDef.normalized === true;
			}
		}
		return parser.getDependency("bufferView", bufferViewIndex).then(function(bufferView) {
			return new Promise(function(resolve, reject) {
				dracoLoader.decodeDracoFile(bufferView, function(geometry) {
					for (const attributeName in geometry.attributes) {
						const attribute = geometry.attributes[attributeName];
						const normalized = attributeNormalizedMap[attributeName];
						if (normalized !== void 0) attribute.normalized = normalized;
					}
					resolve(geometry);
				}, threeAttributeMap, attributeTypeMap, LinearSRGBColorSpace, reject);
			});
		});
	}
};
/**
* Texture Transform Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
*
* @private
*/
var GLTFTextureTransformExtension = class {
	constructor() {
		this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;
	}
	extendTexture(texture, transform) {
		if ((transform.texCoord === void 0 || transform.texCoord === texture.channel) && transform.offset === void 0 && transform.rotation === void 0 && transform.scale === void 0) return texture;
		texture = texture.clone();
		if (transform.texCoord !== void 0) texture.channel = transform.texCoord;
		if (transform.offset !== void 0) texture.offset.fromArray(transform.offset);
		if (transform.rotation !== void 0) texture.rotation = transform.rotation;
		if (transform.scale !== void 0) texture.repeat.fromArray(transform.scale);
		if (transform.rotation !== void 0) {
			const c = Math.cos(texture.rotation);
			const s = Math.sin(texture.rotation);
			texture.matrix.set(texture.repeat.x * c, texture.repeat.y * s, texture.offset.x, -texture.repeat.x * s, texture.repeat.y * c, texture.offset.y, 0, 0, 1);
			texture.matrixAutoUpdate = false;
		}
		texture.needsUpdate = true;
		return texture;
	}
};
/**
* Mesh Quantization Extension
*
* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
*
* @private
*/
var GLTFMeshQuantizationExtension = class {
	constructor() {
		this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;
	}
};
/********** INTERPOLATION ********/
var GLTFCubicSplineInterpolant = class extends Interpolant {
	constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
		super(parameterPositions, sampleValues, sampleSize, resultBuffer);
	}
	copySampleValue_(index) {
		const result = this.resultBuffer, values = this.sampleValues, valueSize = this.valueSize, offset = index * valueSize * 3 + valueSize;
		for (let i = 0; i !== valueSize; i++) result[i] = values[offset + i];
		return result;
	}
	interpolate_(i1, t0, t, t1) {
		const result = this.resultBuffer;
		const values = this.sampleValues;
		const stride = this.valueSize;
		const stride2 = stride * 2;
		const stride3 = stride * 3;
		const td = t1 - t0;
		const p = (t - t0) / td;
		const pp = p * p;
		const ppp = pp * p;
		const offset1 = i1 * stride3;
		const offset0 = offset1 - stride3;
		const s2 = -2 * ppp + 3 * pp;
		const s3 = ppp - pp;
		const s0 = 1 - s2;
		const s1 = s3 - pp + p;
		for (let i = 0; i !== stride; i++) {
			const p0 = values[offset0 + i + stride];
			const m0 = values[offset0 + i + stride2] * td;
			const p1 = values[offset1 + i + stride];
			const m1 = values[offset1 + i] * td;
			result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;
		}
		return result;
	}
};
var _quaternion = new Quaternion();
var GLTFCubicSplineQuaternionInterpolant = class extends GLTFCubicSplineInterpolant {
	interpolate_(i1, t0, t, t1) {
		const result = super.interpolate_(i1, t0, t, t1);
		_quaternion.fromArray(result).normalize().toArray(result);
		return result;
	}
};
/********** INTERNALS ************/
var WEBGL_CONSTANTS = {
	FLOAT: 5126,
	FLOAT_MAT3: 35675,
	FLOAT_MAT4: 35676,
	FLOAT_VEC2: 35664,
	FLOAT_VEC3: 35665,
	FLOAT_VEC4: 35666,
	LINEAR: 9729,
	REPEAT: 10497,
	SAMPLER_2D: 35678,
	POINTS: 0,
	LINES: 1,
	LINE_LOOP: 2,
	LINE_STRIP: 3,
	TRIANGLES: 4,
	TRIANGLE_STRIP: 5,
	TRIANGLE_FAN: 6,
	UNSIGNED_BYTE: 5121,
	UNSIGNED_SHORT: 5123
};
var WEBGL_COMPONENT_TYPES = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array
};
var WEBGL_FILTERS = {
	9728: NearestFilter,
	9729: LinearFilter,
	9984: NearestMipmapNearestFilter,
	9985: LinearMipmapNearestFilter,
	9986: NearestMipmapLinearFilter,
	9987: LinearMipmapLinearFilter
};
var WEBGL_WRAPPINGS = {
	33071: ClampToEdgeWrapping,
	33648: MirroredRepeatWrapping,
	10497: RepeatWrapping
};
var WEBGL_TYPE_SIZES = {
	"SCALAR": 1,
	"VEC2": 2,
	"VEC3": 3,
	"VEC4": 4,
	"MAT2": 4,
	"MAT3": 9,
	"MAT4": 16
};
var ATTRIBUTES = {
	POSITION: "position",
	NORMAL: "normal",
	TANGENT: "tangent",
	TEXCOORD_0: "uv",
	TEXCOORD_1: "uv1",
	TEXCOORD_2: "uv2",
	TEXCOORD_3: "uv3",
	COLOR_0: "color",
	WEIGHTS_0: "skinWeight",
	JOINTS_0: "skinIndex"
};
var PATH_PROPERTIES = {
	scale: "scale",
	translation: "position",
	rotation: "quaternion",
	weights: "morphTargetInfluences"
};
var INTERPOLATION = {
	CUBICSPLINE: void 0,
	LINEAR: InterpolateLinear,
	STEP: InterpolateDiscrete
};
var ALPHA_MODES = {
	OPAQUE: "OPAQUE",
	MASK: "MASK",
	BLEND: "BLEND"
};
/**
* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
*
* @private
* @param {Object<string, Material>} cache
* @return {Material}
*/
function createDefaultMaterial(cache) {
	if (cache["DefaultMaterial"] === void 0) cache["DefaultMaterial"] = new MeshStandardMaterial({
		color: 16777215,
		emissive: 0,
		metalness: 1,
		roughness: 1,
		transparent: false,
		depthTest: true,
		side: 0
	});
	return cache["DefaultMaterial"];
}
function addUnknownExtensionsToUserData(knownExtensions, object, objectDef) {
	for (const name in objectDef.extensions) if (knownExtensions[name] === void 0) {
		object.userData.gltfExtensions = object.userData.gltfExtensions || {};
		object.userData.gltfExtensions[name] = objectDef.extensions[name];
	}
}
/**
*
* @private
* @param {Object3D|Material|BufferGeometry|Object|AnimationClip} object
* @param {GLTF.definition} gltfDef
*/
function assignExtrasToUserData(object, gltfDef) {
	if (gltfDef.extras !== void 0) {
		if (typeof gltfDef.extras === "object") Object.assign(object.userData, gltfDef.extras);
		else console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, " + gltfDef.extras);
	}
}
/**
* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
*
* @private
* @param {BufferGeometry} geometry
* @param {Array<GLTF.Target>} targets
* @param {GLTFParser} parser
* @return {Promise<BufferGeometry>}
*/
function addMorphTargets(geometry, targets, parser) {
	let hasMorphPosition = false;
	let hasMorphNormal = false;
	let hasMorphColor = false;
	for (let i = 0, il = targets.length; i < il; i++) {
		const target = targets[i];
		if (target.POSITION !== void 0) hasMorphPosition = true;
		if (target.NORMAL !== void 0) hasMorphNormal = true;
		if (target.COLOR_0 !== void 0) hasMorphColor = true;
		if (hasMorphPosition && hasMorphNormal && hasMorphColor) break;
	}
	if (!hasMorphPosition && !hasMorphNormal && !hasMorphColor) return Promise.resolve(geometry);
	const pendingPositionAccessors = [];
	const pendingNormalAccessors = [];
	const pendingColorAccessors = [];
	for (let i = 0, il = targets.length; i < il; i++) {
		const target = targets[i];
		if (hasMorphPosition) {
			const pendingAccessor = target.POSITION !== void 0 ? parser.getDependency("accessor", target.POSITION) : geometry.attributes.position;
			pendingPositionAccessors.push(pendingAccessor);
		}
		if (hasMorphNormal) {
			const pendingAccessor = target.NORMAL !== void 0 ? parser.getDependency("accessor", target.NORMAL) : geometry.attributes.normal;
			pendingNormalAccessors.push(pendingAccessor);
		}
		if (hasMorphColor) {
			const pendingAccessor = target.COLOR_0 !== void 0 ? parser.getDependency("accessor", target.COLOR_0) : geometry.attributes.color;
			pendingColorAccessors.push(pendingAccessor);
		}
	}
	return Promise.all([
		Promise.all(pendingPositionAccessors),
		Promise.all(pendingNormalAccessors),
		Promise.all(pendingColorAccessors)
	]).then(function(accessors) {
		const morphPositions = accessors[0];
		const morphNormals = accessors[1];
		const morphColors = accessors[2];
		if (hasMorphPosition) geometry.morphAttributes.position = morphPositions;
		if (hasMorphNormal) geometry.morphAttributes.normal = morphNormals;
		if (hasMorphColor) geometry.morphAttributes.color = morphColors;
		geometry.morphTargetsRelative = true;
		return geometry;
	});
}
/**
*
* @private
* @param {Mesh} mesh
* @param {GLTF.Mesh} meshDef
*/
function updateMorphTargets(mesh, meshDef) {
	mesh.updateMorphTargets();
	if (meshDef.weights !== void 0) for (let i = 0, il = meshDef.weights.length; i < il; i++) mesh.morphTargetInfluences[i] = meshDef.weights[i];
	if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {
		const targetNames = meshDef.extras.targetNames;
		if (mesh.morphTargetInfluences.length === targetNames.length) {
			mesh.morphTargetDictionary = {};
			for (let i = 0, il = targetNames.length; i < il; i++) mesh.morphTargetDictionary[targetNames[i]] = i;
		} else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.");
	}
}
function createPrimitiveKey(primitiveDef) {
	let geometryKey;
	const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION];
	if (dracoExtension) geometryKey = "draco:" + dracoExtension.bufferView + ":" + dracoExtension.indices + ":" + createAttributesKey(dracoExtension.attributes);
	else geometryKey = primitiveDef.indices + ":" + createAttributesKey(primitiveDef.attributes) + ":" + primitiveDef.mode;
	if (primitiveDef.targets !== void 0) for (let i = 0, il = primitiveDef.targets.length; i < il; i++) geometryKey += ":" + createAttributesKey(primitiveDef.targets[i]);
	return geometryKey;
}
function createAttributesKey(attributes) {
	let attributesKey = "";
	const keys = Object.keys(attributes).sort();
	for (let i = 0, il = keys.length; i < il; i++) attributesKey += keys[i] + ":" + attributes[keys[i]] + ";";
	return attributesKey;
}
function getNormalizedComponentScale(constructor) {
	switch (constructor) {
		case Int8Array: return 1 / 127;
		case Uint8Array: return 1 / 255;
		case Int16Array: return 1 / 32767;
		case Uint16Array: return 1 / 65535;
		default: throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.");
	}
}
function getImageURIMimeType(uri) {
	if (uri.search(/\.jpe?g($|\?)/i) > 0 || uri.search(/^data\:image\/jpeg/) === 0) return "image/jpeg";
	if (uri.search(/\.webp($|\?)/i) > 0 || uri.search(/^data\:image\/webp/) === 0) return "image/webp";
	if (uri.search(/\.ktx2($|\?)/i) > 0 || uri.search(/^data\:image\/ktx2/) === 0) return "image/ktx2";
	return "image/png";
}
var _identityMatrix = new Matrix4();
var GLTFParser = class {
	constructor(json = {}, options = {}) {
		this.json = json;
		this.extensions = {};
		this.plugins = {};
		this.options = options;
		this.cache = new GLTFRegistry();
		this.associations = /* @__PURE__ */ new Map();
		this.primitiveCache = {};
		this.nodeCache = {};
		this.meshCache = {
			refs: {},
			uses: {}
		};
		this.cameraCache = {
			refs: {},
			uses: {}
		};
		this.lightCache = {
			refs: {},
			uses: {}
		};
		this.sourceCache = {};
		this.textureCache = {};
		this.nodeNamesUsed = {};
		let isSafari = false;
		let safariVersion = -1;
		let isFirefox = false;
		let firefoxVersion = -1;
		if (typeof navigator !== "undefined" && typeof navigator.userAgent !== "undefined") {
			const userAgent = navigator.userAgent;
			isSafari = /^((?!chrome|android).)*safari/i.test(userAgent) === true;
			const safariMatch = userAgent.match(/Version\/(\d+)/);
			safariVersion = isSafari && safariMatch ? parseInt(safariMatch[1], 10) : -1;
			isFirefox = userAgent.indexOf("Firefox") > -1;
			firefoxVersion = isFirefox ? userAgent.match(/Firefox\/([0-9]+)\./)[1] : -1;
		}
		if (typeof createImageBitmap === "undefined" || isSafari && safariVersion < 17 || isFirefox && firefoxVersion < 98) this.textureLoader = new TextureLoader(this.options.manager);
		else this.textureLoader = new ImageBitmapLoader(this.options.manager);
		this.textureLoader.setCrossOrigin(this.options.crossOrigin);
		this.textureLoader.setRequestHeader(this.options.requestHeader);
		this.fileLoader = new FileLoader(this.options.manager);
		this.fileLoader.setResponseType("arraybuffer");
		if (this.options.crossOrigin === "use-credentials") this.fileLoader.setWithCredentials(true);
	}
	setExtensions(extensions) {
		this.extensions = extensions;
	}
	setPlugins(plugins) {
		this.plugins = plugins;
	}
	parse(onLoad, onError) {
		const parser = this;
		const json = this.json;
		const extensions = this.extensions;
		this.cache.removeAll();
		this.nodeCache = {};
		this._invokeAll(function(ext) {
			return ext._markDefs && ext._markDefs();
		});
		Promise.all(this._invokeAll(function(ext) {
			return ext.beforeRoot && ext.beforeRoot();
		})).then(function() {
			return Promise.all([
				parser.getDependencies("scene"),
				parser.getDependencies("animation"),
				parser.getDependencies("camera")
			]);
		}).then(function(dependencies) {
			const result = {
				scene: dependencies[0][json.scene || 0],
				scenes: dependencies[0],
				animations: dependencies[1],
				cameras: dependencies[2],
				asset: json.asset,
				parser,
				userData: {}
			};
			addUnknownExtensionsToUserData(extensions, result, json);
			assignExtrasToUserData(result, json);
			return Promise.all(parser._invokeAll(function(ext) {
				return ext.afterRoot && ext.afterRoot(result);
			})).then(function() {
				for (const scene of result.scenes) scene.updateMatrixWorld();
				onLoad(result);
			});
		}).catch(onError);
	}
	/**
	* Marks the special nodes/meshes in json for efficient parse.
	*
	* @private
	*/
	_markDefs() {
		const nodeDefs = this.json.nodes || [];
		const skinDefs = this.json.skins || [];
		const meshDefs = this.json.meshes || [];
		for (let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
			const joints = skinDefs[skinIndex].joints;
			for (let i = 0, il = joints.length; i < il; i++) nodeDefs[joints[i]].isBone = true;
		}
		for (let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
			const nodeDef = nodeDefs[nodeIndex];
			if (nodeDef.mesh !== void 0) {
				this._addNodeRef(this.meshCache, nodeDef.mesh);
				if (nodeDef.skin !== void 0) meshDefs[nodeDef.mesh].isSkinnedMesh = true;
			}
			if (nodeDef.camera !== void 0) this._addNodeRef(this.cameraCache, nodeDef.camera);
		}
	}
	/**
	* Counts references to shared node / Object3D resources. These resources
	* can be reused, or "instantiated", at multiple nodes in the scene
	* hierarchy. Mesh, Camera, and Light instances are instantiated and must
	* be marked. Non-scenegraph resources (like Materials, Geometries, and
	* Textures) can be reused directly and are not marked here.
	*
	* Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
	*
	* @private
	* @param {Object} cache
	* @param {Object3D} index
	*/
	_addNodeRef(cache, index) {
		if (index === void 0) return;
		if (cache.refs[index] === void 0) cache.refs[index] = cache.uses[index] = 0;
		cache.refs[index]++;
	}
	/**
	* Returns a reference to a shared resource, cloning it if necessary.
	*
	* @private
	* @param {Object} cache
	* @param {number} index
	* @param {Object} object
	* @return {Object}
	*/
	_getNodeRef(cache, index, object) {
		if (cache.refs[index] <= 1) return object;
		const ref = object.clone();
		const updateMappings = (original, clone) => {
			const mappings = this.associations.get(original);
			if (mappings != null) this.associations.set(clone, mappings);
			for (const [i, child] of original.children.entries()) updateMappings(child, clone.children[i]);
		};
		updateMappings(object, ref);
		ref.name += "_instance_" + cache.uses[index]++;
		return ref;
	}
	_invokeOne(func) {
		const extensions = Object.values(this.plugins);
		extensions.push(this);
		for (let i = 0; i < extensions.length; i++) {
			const result = func(extensions[i]);
			if (result) return result;
		}
		return null;
	}
	_invokeAll(func) {
		const extensions = Object.values(this.plugins);
		extensions.unshift(this);
		const pending = [];
		for (let i = 0; i < extensions.length; i++) {
			const result = func(extensions[i]);
			if (result) pending.push(result);
		}
		return pending;
	}
	/**
	* Requests the specified dependency asynchronously, with caching.
	*
	* @private
	* @param {string} type
	* @param {number} index
	* @return {Promise<Object3D|Material|Texture|AnimationClip|ArrayBuffer|Object>}
	*/
	getDependency(type, index) {
		const cacheKey = type + ":" + index;
		let dependency = this.cache.get(cacheKey);
		if (!dependency) {
			switch (type) {
				case "scene":
					dependency = this.loadScene(index);
					break;
				case "node":
					dependency = this._invokeOne(function(ext) {
						return ext.loadNode && ext.loadNode(index);
					});
					break;
				case "mesh":
					dependency = this._invokeOne(function(ext) {
						return ext.loadMesh && ext.loadMesh(index);
					});
					break;
				case "accessor":
					dependency = this.loadAccessor(index);
					break;
				case "bufferView":
					dependency = this._invokeOne(function(ext) {
						return ext.loadBufferView && ext.loadBufferView(index);
					});
					break;
				case "buffer":
					dependency = this.loadBuffer(index);
					break;
				case "material":
					dependency = this._invokeOne(function(ext) {
						return ext.loadMaterial && ext.loadMaterial(index);
					});
					break;
				case "texture":
					dependency = this._invokeOne(function(ext) {
						return ext.loadTexture && ext.loadTexture(index);
					});
					break;
				case "skin":
					dependency = this.loadSkin(index);
					break;
				case "animation":
					dependency = this._invokeOne(function(ext) {
						return ext.loadAnimation && ext.loadAnimation(index);
					});
					break;
				case "camera":
					dependency = this.loadCamera(index);
					break;
				default:
					dependency = this._invokeOne(function(ext) {
						return ext != this && ext.getDependency && ext.getDependency(type, index);
					});
					if (!dependency) throw new Error("Unknown type: " + type);
			}
			this.cache.add(cacheKey, dependency);
		}
		return dependency;
	}
	/**
	* Requests all dependencies of the specified type asynchronously, with caching.
	*
	* @private
	* @param {string} type
	* @return {Promise<Array<Object>>}
	*/
	getDependencies(type) {
		let dependencies = this.cache.get(type);
		if (!dependencies) {
			const parser = this;
			const defs = this.json[type + (type === "mesh" ? "es" : "s")] || [];
			dependencies = Promise.all(defs.map(function(def, index) {
				return parser.getDependency(type, index);
			}));
			this.cache.add(type, dependencies);
		}
		return dependencies;
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
	*
	* @private
	* @param {number} bufferIndex
	* @return {Promise<ArrayBuffer>}
	*/
	loadBuffer(bufferIndex) {
		const bufferDef = this.json.buffers[bufferIndex];
		const loader = this.fileLoader;
		if (bufferDef.type && bufferDef.type !== "arraybuffer") throw new Error("THREE.GLTFLoader: " + bufferDef.type + " buffer type is not supported.");
		if (bufferDef.uri === void 0 && bufferIndex === 0) return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body);
		const options = this.options;
		return new Promise(function(resolve, reject) {
			loader.load(LoaderUtils.resolveURL(bufferDef.uri, options.path), resolve, void 0, function() {
				reject(/* @__PURE__ */ new Error("THREE.GLTFLoader: Failed to load buffer \"" + bufferDef.uri + "\"."));
			});
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
	*
	* @private
	* @param {number} bufferViewIndex
	* @return {Promise<ArrayBuffer>}
	*/
	loadBufferView(bufferViewIndex) {
		const bufferViewDef = this.json.bufferViews[bufferViewIndex];
		return this.getDependency("buffer", bufferViewDef.buffer).then(function(buffer) {
			const byteLength = bufferViewDef.byteLength || 0;
			const byteOffset = bufferViewDef.byteOffset || 0;
			return buffer.slice(byteOffset, byteOffset + byteLength);
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
	*
	* @private
	* @param {number} accessorIndex
	* @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
	*/
	loadAccessor(accessorIndex) {
		const parser = this;
		const json = this.json;
		const accessorDef = this.json.accessors[accessorIndex];
		if (accessorDef.bufferView === void 0 && accessorDef.sparse === void 0) {
			const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
			const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
			const normalized = accessorDef.normalized === true;
			const array = new TypedArray(accessorDef.count * itemSize);
			return Promise.resolve(new BufferAttribute(array, itemSize, normalized));
		}
		const pendingBufferViews = [];
		if (accessorDef.bufferView !== void 0) pendingBufferViews.push(this.getDependency("bufferView", accessorDef.bufferView));
		else pendingBufferViews.push(null);
		if (accessorDef.sparse !== void 0) {
			pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.indices.bufferView));
			pendingBufferViews.push(this.getDependency("bufferView", accessorDef.sparse.values.bufferView));
		}
		return Promise.all(pendingBufferViews).then(function(bufferViews) {
			const bufferView = bufferViews[0];
			const itemSize = WEBGL_TYPE_SIZES[accessorDef.type];
			const TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType];
			const elementBytes = TypedArray.BYTES_PER_ELEMENT;
			const itemBytes = elementBytes * itemSize;
			const byteOffset = accessorDef.byteOffset || 0;
			const byteStride = accessorDef.bufferView !== void 0 ? json.bufferViews[accessorDef.bufferView].byteStride : void 0;
			const normalized = accessorDef.normalized === true;
			let array, bufferAttribute;
			if (byteStride && byteStride !== itemBytes) {
				const ibSlice = Math.floor(byteOffset / byteStride);
				const ibCacheKey = "InterleavedBuffer:" + accessorDef.bufferView + ":" + accessorDef.componentType + ":" + ibSlice + ":" + accessorDef.count;
				let ib = parser.cache.get(ibCacheKey);
				if (!ib) {
					array = new TypedArray(bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes);
					ib = new InterleavedBuffer(array, byteStride / elementBytes);
					parser.cache.add(ibCacheKey, ib);
				}
				bufferAttribute = new InterleavedBufferAttribute(ib, itemSize, byteOffset % byteStride / elementBytes, normalized);
			} else {
				if (bufferView === null) array = new TypedArray(accessorDef.count * itemSize);
				else array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize);
				bufferAttribute = new BufferAttribute(array, itemSize, normalized);
			}
			if (accessorDef.sparse !== void 0) {
				const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
				const TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType];
				const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
				const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
				const sparseIndices = new TypedArrayIndices(bufferViews[1], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices);
				const sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize);
				if (bufferView !== null) bufferAttribute = new BufferAttribute(bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized);
				bufferAttribute.normalized = false;
				for (let i = 0, il = sparseIndices.length; i < il; i++) {
					const index = sparseIndices[i];
					bufferAttribute.setX(index, sparseValues[i * itemSize]);
					if (itemSize >= 2) bufferAttribute.setY(index, sparseValues[i * itemSize + 1]);
					if (itemSize >= 3) bufferAttribute.setZ(index, sparseValues[i * itemSize + 2]);
					if (itemSize >= 4) bufferAttribute.setW(index, sparseValues[i * itemSize + 3]);
					if (itemSize >= 5) throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.");
				}
				bufferAttribute.normalized = normalized;
			}
			return bufferAttribute;
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
	*
	* @private
	* @param {number} textureIndex
	* @return {Promise<?Texture>}
	*/
	loadTexture(textureIndex) {
		const json = this.json;
		const options = this.options;
		const sourceIndex = json.textures[textureIndex].source;
		const sourceDef = json.images[sourceIndex];
		let loader = this.textureLoader;
		if (sourceDef.uri) {
			const handler = options.manager.getHandler(sourceDef.uri);
			if (handler !== null) loader = handler;
		}
		return this.loadTextureImage(textureIndex, sourceIndex, loader);
	}
	loadTextureImage(textureIndex, sourceIndex, loader) {
		const parser = this;
		const json = this.json;
		const textureDef = json.textures[textureIndex];
		const sourceDef = json.images[sourceIndex];
		const cacheKey = (sourceDef.uri || sourceDef.bufferView) + ":" + textureDef.sampler;
		if (this.textureCache[cacheKey]) return this.textureCache[cacheKey];
		const promise = this.loadImageSource(sourceIndex, loader).then(function(texture) {
			texture.flipY = false;
			texture.name = textureDef.name || sourceDef.name || "";
			if (texture.name === "" && typeof sourceDef.uri === "string" && sourceDef.uri.startsWith("data:image/") === false) texture.name = sourceDef.uri;
			const sampler = (json.samplers || {})[textureDef.sampler] || {};
			texture.magFilter = WEBGL_FILTERS[sampler.magFilter] || 1006;
			texture.minFilter = WEBGL_FILTERS[sampler.minFilter] || 1008;
			texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || 1e3;
			texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || 1e3;
			texture.generateMipmaps = !texture.isCompressedTexture && texture.minFilter !== 1003 && texture.minFilter !== 1006;
			parser.associations.set(texture, { textures: textureIndex });
			return texture;
		}).catch(function() {
			return null;
		});
		this.textureCache[cacheKey] = promise;
		return promise;
	}
	loadImageSource(sourceIndex, loader) {
		const parser = this;
		const json = this.json;
		const options = this.options;
		if (this.sourceCache[sourceIndex] !== void 0) return this.sourceCache[sourceIndex].then((texture) => texture.clone());
		const sourceDef = json.images[sourceIndex];
		const URL = self.URL || self.webkitURL;
		let sourceURI = sourceDef.uri || "";
		let isObjectURL = false;
		if (sourceDef.bufferView !== void 0) sourceURI = parser.getDependency("bufferView", sourceDef.bufferView).then(function(bufferView) {
			isObjectURL = true;
			const blob = new Blob([bufferView], { type: sourceDef.mimeType });
			sourceURI = URL.createObjectURL(blob);
			return sourceURI;
		});
		else if (sourceDef.uri === void 0) throw new Error("THREE.GLTFLoader: Image " + sourceIndex + " is missing URI and bufferView");
		const promise = Promise.resolve(sourceURI).then(function(sourceURI) {
			return new Promise(function(resolve, reject) {
				let onLoad = resolve;
				if (loader.isImageBitmapLoader === true) onLoad = function(imageBitmap) {
					const texture = new Texture(imageBitmap);
					texture.needsUpdate = true;
					resolve(texture);
				};
				loader.load(LoaderUtils.resolveURL(sourceURI, options.path), onLoad, void 0, reject);
			});
		}).then(function(texture) {
			if (isObjectURL === true) URL.revokeObjectURL(sourceURI);
			assignExtrasToUserData(texture, sourceDef);
			texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType(sourceDef.uri);
			return texture;
		}).catch(function(error) {
			console.error("THREE.GLTFLoader: Couldn't load texture", sourceURI);
			throw error;
		});
		this.sourceCache[sourceIndex] = promise;
		return promise;
	}
	/**
	* Asynchronously assigns a texture to the given material parameters.
	*
	* @private
	* @param {Object} materialParams
	* @param {string} mapName
	* @param {Object} mapDef
	* @param {string} [colorSpace]
	* @return {Promise<Texture>}
	*/
	assignTexture(materialParams, mapName, mapDef, colorSpace) {
		const parser = this;
		return this.getDependency("texture", mapDef.index).then(function(texture) {
			if (!texture) return null;
			if (mapDef.texCoord !== void 0 && mapDef.texCoord > 0) {
				texture = texture.clone();
				texture.channel = mapDef.texCoord;
			}
			if (parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM]) {
				const transform = mapDef.extensions !== void 0 ? mapDef.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM] : void 0;
				if (transform) {
					const gltfReference = parser.associations.get(texture);
					texture = parser.extensions[EXTENSIONS.KHR_TEXTURE_TRANSFORM].extendTexture(texture, transform);
					parser.associations.set(texture, gltfReference);
				}
			}
			if (colorSpace !== void 0) texture.colorSpace = colorSpace;
			materialParams[mapName] = texture;
			return texture;
		});
	}
	/**
	* Assigns final material to a Mesh, Line, or Points instance. The instance
	* already has a material (generated from the glTF material options alone)
	* but reuse of the same glTF material may require multiple threejs materials
	* to accommodate different primitive types, defines, etc. New materials will
	* be created if necessary, and reused from a cache.
	*
	* @private
	* @param {Object3D} mesh Mesh, Line, or Points instance.
	*/
	assignFinalMaterial(mesh) {
		const geometry = mesh.geometry;
		let material = mesh.material;
		const useDerivativeTangents = geometry.attributes.tangent === void 0;
		const useVertexColors = geometry.attributes.color !== void 0;
		const useFlatShading = geometry.attributes.normal === void 0;
		if (mesh.isPoints) {
			const cacheKey = "PointsMaterial:" + material.uuid;
			let pointsMaterial = this.cache.get(cacheKey);
			if (!pointsMaterial) {
				pointsMaterial = new PointsMaterial();
				Material.prototype.copy.call(pointsMaterial, material);
				pointsMaterial.color.copy(material.color);
				pointsMaterial.map = material.map;
				pointsMaterial.sizeAttenuation = false;
				this.cache.add(cacheKey, pointsMaterial);
			}
			material = pointsMaterial;
		} else if (mesh.isLine) {
			const cacheKey = "LineBasicMaterial:" + material.uuid;
			let lineMaterial = this.cache.get(cacheKey);
			if (!lineMaterial) {
				lineMaterial = new LineBasicMaterial();
				Material.prototype.copy.call(lineMaterial, material);
				lineMaterial.color.copy(material.color);
				lineMaterial.map = material.map;
				this.cache.add(cacheKey, lineMaterial);
			}
			material = lineMaterial;
		}
		if (useDerivativeTangents || useVertexColors || useFlatShading) {
			let cacheKey = "ClonedMaterial:" + material.uuid + ":";
			if (useDerivativeTangents) cacheKey += "derivative-tangents:";
			if (useVertexColors) cacheKey += "vertex-colors:";
			if (useFlatShading) cacheKey += "flat-shading:";
			let cachedMaterial = this.cache.get(cacheKey);
			if (!cachedMaterial) {
				cachedMaterial = material.clone();
				if (useVertexColors) cachedMaterial.vertexColors = true;
				if (useFlatShading) cachedMaterial.flatShading = true;
				if (useDerivativeTangents) {
					if (cachedMaterial.normalScale) cachedMaterial.normalScale.y *= -1;
					if (cachedMaterial.clearcoatNormalScale) cachedMaterial.clearcoatNormalScale.y *= -1;
				}
				this.cache.add(cacheKey, cachedMaterial);
				this.associations.set(cachedMaterial, this.associations.get(material));
			}
			material = cachedMaterial;
		}
		mesh.material = material;
	}
	getMaterialType() {
		return MeshStandardMaterial;
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
	*
	* @private
	* @param {number} materialIndex
	* @return {Promise<Material>}
	*/
	loadMaterial(materialIndex) {
		const parser = this;
		const json = this.json;
		const extensions = this.extensions;
		const materialDef = json.materials[materialIndex];
		let materialType;
		const materialParams = {};
		const materialExtensions = materialDef.extensions || {};
		const pending = [];
		if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
			const kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT];
			materialType = kmuExtension.getMaterialType();
			pending.push(kmuExtension.extendParams(materialParams, materialDef, parser));
		} else {
			const metallicRoughness = materialDef.pbrMetallicRoughness || {};
			materialParams.color = new Color(1, 1, 1);
			materialParams.opacity = 1;
			if (Array.isArray(metallicRoughness.baseColorFactor)) {
				const array = metallicRoughness.baseColorFactor;
				materialParams.color.setRGB(array[0], array[1], array[2], LinearSRGBColorSpace);
				materialParams.opacity = array[3];
			}
			if (metallicRoughness.baseColorTexture !== void 0) pending.push(parser.assignTexture(materialParams, "map", metallicRoughness.baseColorTexture, SRGBColorSpace));
			materialParams.metalness = metallicRoughness.metallicFactor !== void 0 ? metallicRoughness.metallicFactor : 1;
			materialParams.roughness = metallicRoughness.roughnessFactor !== void 0 ? metallicRoughness.roughnessFactor : 1;
			if (metallicRoughness.metallicRoughnessTexture !== void 0) {
				pending.push(parser.assignTexture(materialParams, "metalnessMap", metallicRoughness.metallicRoughnessTexture));
				pending.push(parser.assignTexture(materialParams, "roughnessMap", metallicRoughness.metallicRoughnessTexture));
			}
			materialType = this._invokeOne(function(ext) {
				return ext.getMaterialType && ext.getMaterialType(materialIndex);
			});
			pending.push(Promise.all(this._invokeAll(function(ext) {
				return ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams);
			})));
		}
		if (materialDef.doubleSided === true) materialParams.side = 2;
		const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;
		if (alphaMode === ALPHA_MODES.BLEND) {
			materialParams.transparent = true;
			materialParams.depthWrite = false;
		} else {
			materialParams.transparent = false;
			if (alphaMode === ALPHA_MODES.MASK) materialParams.alphaTest = materialDef.alphaCutoff !== void 0 ? materialDef.alphaCutoff : .5;
		}
		if (materialDef.normalTexture !== void 0 && materialType !== MeshBasicMaterial) {
			pending.push(parser.assignTexture(materialParams, "normalMap", materialDef.normalTexture));
			materialParams.normalScale = new Vector2(1, 1);
			if (materialDef.normalTexture.scale !== void 0) {
				const scale = materialDef.normalTexture.scale;
				materialParams.normalScale.set(scale, scale);
			}
		}
		if (materialDef.occlusionTexture !== void 0 && materialType !== MeshBasicMaterial) {
			pending.push(parser.assignTexture(materialParams, "aoMap", materialDef.occlusionTexture));
			if (materialDef.occlusionTexture.strength !== void 0) materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;
		}
		if (materialDef.emissiveFactor !== void 0 && materialType !== MeshBasicMaterial) {
			const emissiveFactor = materialDef.emissiveFactor;
			materialParams.emissive = new Color().setRGB(emissiveFactor[0], emissiveFactor[1], emissiveFactor[2], LinearSRGBColorSpace);
		}
		if (materialDef.emissiveTexture !== void 0 && materialType !== MeshBasicMaterial) pending.push(parser.assignTexture(materialParams, "emissiveMap", materialDef.emissiveTexture, SRGBColorSpace));
		return Promise.all(pending).then(function() {
			const material = new materialType(materialParams);
			if (materialDef.name) material.name = materialDef.name;
			assignExtrasToUserData(material, materialDef);
			parser.associations.set(material, { materials: materialIndex });
			if (materialDef.extensions) addUnknownExtensionsToUserData(extensions, material, materialDef);
			return material;
		});
	}
	/**
	* When Object3D instances are targeted by animation, they need unique names.
	*
	* @private
	* @param {string} originalName
	* @return {string}
	*/
	createUniqueName(originalName) {
		const sanitizedName = PropertyBinding.sanitizeNodeName(originalName || "");
		if (sanitizedName in this.nodeNamesUsed) return sanitizedName + "_" + ++this.nodeNamesUsed[sanitizedName];
		else {
			this.nodeNamesUsed[sanitizedName] = 0;
			return sanitizedName;
		}
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
	*
	* Creates BufferGeometries from primitives.
	*
	* @private
	* @param {Array<GLTF.Primitive>} primitives
	* @return {Promise<Array<BufferGeometry>>}
	*/
	loadGeometries(primitives) {
		const parser = this;
		const extensions = this.extensions;
		const cache = this.primitiveCache;
		function createDracoPrimitive(primitive) {
			return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(primitive, parser).then(function(geometry) {
				return addPrimitiveAttributes(geometry, primitive, parser);
			});
		}
		const pending = [];
		for (let i = 0, il = primitives.length; i < il; i++) {
			const primitive = primitives[i];
			const cacheKey = createPrimitiveKey(primitive);
			const cached = cache[cacheKey];
			if (cached) pending.push(cached.promise);
			else {
				let geometryPromise;
				if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) geometryPromise = createDracoPrimitive(primitive);
				else geometryPromise = addPrimitiveAttributes(new BufferGeometry(), primitive, parser);
				if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) geometryPromise = geometryPromise.then((geometry) => toTrianglesDrawMode(geometry, 1));
				else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) geometryPromise = geometryPromise.then((geometry) => toTrianglesDrawMode(geometry, 2));
				cache[cacheKey] = {
					primitive,
					promise: geometryPromise
				};
				pending.push(geometryPromise);
			}
		}
		return Promise.all(pending);
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
	*
	* @private
	* @param {number} meshIndex
	* @return {Promise<Group|Mesh|SkinnedMesh|Line|Points>}
	*/
	loadMesh(meshIndex) {
		const parser = this;
		const json = this.json;
		const extensions = this.extensions;
		const meshDef = json.meshes[meshIndex];
		const primitives = meshDef.primitives;
		const pending = [];
		for (let i = 0, il = primitives.length; i < il; i++) {
			const material = primitives[i].material === void 0 ? createDefaultMaterial(this.cache) : this.getDependency("material", primitives[i].material);
			pending.push(material);
		}
		pending.push(parser.loadGeometries(primitives));
		return Promise.all(pending).then(async function(results) {
			const materials = results.slice(0, results.length - 1);
			const geometries = results[results.length - 1];
			const meshes = [];
			for (let i = 0, il = geometries.length; i < il; i++) {
				const geometry = geometries[i];
				const primitive = primitives[i];
				let mesh;
				const material = materials[i];
				if (primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === void 0) {
					const needsSkinning = meshDef.isSkinnedMesh === true;
					const hasSkinningAttributes = geometry.hasAttribute("skinIndex") && geometry.hasAttribute("skinWeight");
					if (needsSkinning && hasSkinningAttributes === false) console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled.");
					mesh = needsSkinning && hasSkinningAttributes ? new SkinnedMesh(geometry, material) : new Mesh(geometry, material);
					if (mesh.isSkinnedMesh === true) mesh.normalizeSkinWeights();
				} else if (primitive.mode === WEBGL_CONSTANTS.LINES) mesh = new LineSegments(geometry, material);
				else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) mesh = new Line(geometry, material);
				else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) mesh = new LineLoop(geometry, material);
				else if (primitive.mode === WEBGL_CONSTANTS.POINTS) mesh = new Points(geometry, material);
				else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: " + primitive.mode);
				if (Object.keys(mesh.geometry.morphAttributes).length > 0) updateMorphTargets(mesh, meshDef);
				mesh.name = parser.createUniqueName(meshDef.name || "mesh_" + meshIndex);
				assignExtrasToUserData(mesh, meshDef);
				if (primitive.extensions) addUnknownExtensionsToUserData(extensions, mesh, primitive);
				parser.assignFinalMaterial(mesh);
				meshes.push(mesh);
			}
			for (let i = 0, il = meshes.length; i < il; i++) parser.associations.set(meshes[i], {
				meshes: meshIndex,
				primitives: i
			});
			if (meshes.length === 1) {
				if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, meshes[0], meshDef);
				return meshes[0];
			}
			const group = new Group();
			if (meshDef.extensions) addUnknownExtensionsToUserData(extensions, group, meshDef);
			parser.associations.set(group, { meshes: meshIndex });
			for (let i = 0, il = meshes.length; i < il; i++) group.add(meshes[i]);
			return group;
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
	*
	* @private
	* @param {number} cameraIndex
	* @return {Promise<Camera>|undefined}
	*/
	loadCamera(cameraIndex) {
		let camera;
		const cameraDef = this.json.cameras[cameraIndex];
		const params = cameraDef[cameraDef.type];
		if (!params) {
			console.warn("THREE.GLTFLoader: Missing camera parameters.");
			return;
		}
		if (cameraDef.type === "perspective") camera = new PerspectiveCamera(MathUtils.radToDeg(params.yfov), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6);
		else if (cameraDef.type === "orthographic") camera = new OrthographicCamera(-params.xmag, params.xmag, params.ymag, -params.ymag, params.znear, params.zfar);
		if (cameraDef.name) camera.name = this.createUniqueName(cameraDef.name);
		assignExtrasToUserData(camera, cameraDef);
		return Promise.resolve(camera);
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
	*
	* @private
	* @param {number} skinIndex
	* @return {Promise<Skeleton>}
	*/
	loadSkin(skinIndex) {
		const skinDef = this.json.skins[skinIndex];
		const pending = [];
		for (let i = 0, il = skinDef.joints.length; i < il; i++) pending.push(this._loadNodeShallow(skinDef.joints[i]));
		if (skinDef.inverseBindMatrices !== void 0) pending.push(this.getDependency("accessor", skinDef.inverseBindMatrices));
		else pending.push(null);
		return Promise.all(pending).then(function(results) {
			const inverseBindMatrices = results.pop();
			const jointNodes = results;
			const bones = [];
			const boneInverses = [];
			for (let i = 0, il = jointNodes.length; i < il; i++) {
				const jointNode = jointNodes[i];
				if (jointNode) {
					bones.push(jointNode);
					const mat = new Matrix4();
					if (inverseBindMatrices !== null) mat.fromArray(inverseBindMatrices.array, i * 16);
					boneInverses.push(mat);
				} else console.warn("THREE.GLTFLoader: Joint \"%s\" could not be found.", skinDef.joints[i]);
			}
			return new Skeleton(bones, boneInverses);
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
	*
	* @private
	* @param {number} animationIndex
	* @return {Promise<AnimationClip>}
	*/
	loadAnimation(animationIndex) {
		const json = this.json;
		const parser = this;
		const animationDef = json.animations[animationIndex];
		const animationName = animationDef.name ? animationDef.name : "animation_" + animationIndex;
		const pendingNodes = [];
		const pendingInputAccessors = [];
		const pendingOutputAccessors = [];
		const pendingSamplers = [];
		const pendingTargets = [];
		for (let i = 0, il = animationDef.channels.length; i < il; i++) {
			const channel = animationDef.channels[i];
			const sampler = animationDef.samplers[channel.sampler];
			const target = channel.target;
			const name = target.node;
			const input = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.input] : sampler.input;
			const output = animationDef.parameters !== void 0 ? animationDef.parameters[sampler.output] : sampler.output;
			if (target.node === void 0) continue;
			pendingNodes.push(this.getDependency("node", name));
			pendingInputAccessors.push(this.getDependency("accessor", input));
			pendingOutputAccessors.push(this.getDependency("accessor", output));
			pendingSamplers.push(sampler);
			pendingTargets.push(target);
		}
		return Promise.all([
			Promise.all(pendingNodes),
			Promise.all(pendingInputAccessors),
			Promise.all(pendingOutputAccessors),
			Promise.all(pendingSamplers),
			Promise.all(pendingTargets)
		]).then(function(dependencies) {
			const nodes = dependencies[0];
			const inputAccessors = dependencies[1];
			const outputAccessors = dependencies[2];
			const samplers = dependencies[3];
			const targets = dependencies[4];
			const tracks = [];
			for (let i = 0, il = nodes.length; i < il; i++) {
				const node = nodes[i];
				const inputAccessor = inputAccessors[i];
				const outputAccessor = outputAccessors[i];
				const sampler = samplers[i];
				const target = targets[i];
				if (node === void 0) continue;
				if (node.updateMatrix) node.updateMatrix();
				const createdTracks = parser._createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target);
				if (createdTracks) for (let k = 0; k < createdTracks.length; k++) tracks.push(createdTracks[k]);
			}
			const animation = new AnimationClip(animationName, void 0, tracks);
			assignExtrasToUserData(animation, animationDef);
			return animation;
		});
	}
	createNodeMesh(nodeIndex) {
		const json = this.json;
		const parser = this;
		const nodeDef = json.nodes[nodeIndex];
		if (nodeDef.mesh === void 0) return null;
		return parser.getDependency("mesh", nodeDef.mesh).then(function(mesh) {
			const node = parser._getNodeRef(parser.meshCache, nodeDef.mesh, mesh);
			if (nodeDef.weights !== void 0) node.traverse(function(o) {
				if (!o.isMesh) return;
				for (let i = 0, il = nodeDef.weights.length; i < il; i++) o.morphTargetInfluences[i] = nodeDef.weights[i];
			});
			return node;
		});
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
	*
	* @private
	* @param {number} nodeIndex
	* @return {Promise<Object3D>}
	*/
	loadNode(nodeIndex) {
		const json = this.json;
		const parser = this;
		const nodeDef = json.nodes[nodeIndex];
		const nodePending = parser._loadNodeShallow(nodeIndex);
		const childPending = [];
		const childrenDef = nodeDef.children || [];
		for (let i = 0, il = childrenDef.length; i < il; i++) childPending.push(parser.getDependency("node", childrenDef[i]));
		const skeletonPending = nodeDef.skin === void 0 ? Promise.resolve(null) : parser.getDependency("skin", nodeDef.skin);
		return Promise.all([
			nodePending,
			Promise.all(childPending),
			skeletonPending
		]).then(function(results) {
			const node = results[0];
			const children = results[1];
			const skeleton = results[2];
			if (skeleton !== null) node.traverse(function(mesh) {
				if (!mesh.isSkinnedMesh) return;
				mesh.bind(skeleton, _identityMatrix);
			});
			for (let i = 0, il = children.length; i < il; i++) node.add(children[i]);
			if (node.userData.pivot !== void 0 && children.length > 0) {
				const pivot = node.userData.pivot;
				const pivotChild = children[0];
				node.pivot = new Vector3().fromArray(pivot);
				node.position.x -= pivot[0];
				node.position.y -= pivot[1];
				node.position.z -= pivot[2];
				pivotChild.position.set(0, 0, 0);
				delete node.userData.pivot;
			}
			return node;
		});
	}
	_loadNodeShallow(nodeIndex) {
		const json = this.json;
		const extensions = this.extensions;
		const parser = this;
		if (this.nodeCache[nodeIndex] !== void 0) return this.nodeCache[nodeIndex];
		const nodeDef = json.nodes[nodeIndex];
		const nodeName = nodeDef.name ? parser.createUniqueName(nodeDef.name) : "";
		const pending = [];
		const meshPromise = parser._invokeOne(function(ext) {
			return ext.createNodeMesh && ext.createNodeMesh(nodeIndex);
		});
		if (meshPromise) pending.push(meshPromise);
		if (nodeDef.camera !== void 0) pending.push(parser.getDependency("camera", nodeDef.camera).then(function(camera) {
			return parser._getNodeRef(parser.cameraCache, nodeDef.camera, camera);
		}));
		parser._invokeAll(function(ext) {
			return ext.createNodeAttachment && ext.createNodeAttachment(nodeIndex);
		}).forEach(function(promise) {
			pending.push(promise);
		});
		this.nodeCache[nodeIndex] = Promise.all(pending).then(function(objects) {
			let node;
			if (nodeDef.isBone === true) node = new Bone();
			else if (objects.length > 1) node = new Group();
			else if (objects.length === 1) node = objects[0];
			else node = new Object3D();
			if (node !== objects[0]) for (let i = 0, il = objects.length; i < il; i++) node.add(objects[i]);
			if (nodeDef.name) {
				node.userData.name = nodeDef.name;
				node.name = nodeName;
			}
			assignExtrasToUserData(node, nodeDef);
			if (nodeDef.extensions) addUnknownExtensionsToUserData(extensions, node, nodeDef);
			if (nodeDef.matrix !== void 0) {
				const matrix = new Matrix4();
				matrix.fromArray(nodeDef.matrix);
				node.applyMatrix4(matrix);
			} else {
				if (nodeDef.translation !== void 0) node.position.fromArray(nodeDef.translation);
				if (nodeDef.rotation !== void 0) node.quaternion.fromArray(nodeDef.rotation);
				if (nodeDef.scale !== void 0) node.scale.fromArray(nodeDef.scale);
			}
			if (!parser.associations.has(node)) parser.associations.set(node, {});
			else if (nodeDef.mesh !== void 0 && parser.meshCache.refs[nodeDef.mesh] > 1) {
				const mapping = parser.associations.get(node);
				parser.associations.set(node, { ...mapping });
			}
			parser.associations.get(node).nodes = nodeIndex;
			return node;
		});
		return this.nodeCache[nodeIndex];
	}
	/**
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
	*
	* @private
	* @param {number} sceneIndex
	* @return {Promise<Group>}
	*/
	loadScene(sceneIndex) {
		const extensions = this.extensions;
		const sceneDef = this.json.scenes[sceneIndex];
		const parser = this;
		const scene = new Group();
		if (sceneDef.name) scene.name = parser.createUniqueName(sceneDef.name);
		assignExtrasToUserData(scene, sceneDef);
		if (sceneDef.extensions) addUnknownExtensionsToUserData(extensions, scene, sceneDef);
		const nodeIds = sceneDef.nodes || [];
		const pending = [];
		for (let i = 0, il = nodeIds.length; i < il; i++) pending.push(parser.getDependency("node", nodeIds[i]));
		return Promise.all(pending).then(function(nodes) {
			for (let i = 0, il = nodes.length; i < il; i++) {
				const node = nodes[i];
				if (node.parent !== null) scene.add(clone(node));
				else scene.add(node);
			}
			const reduceAssociations = (node) => {
				const reducedAssociations = /* @__PURE__ */ new Map();
				for (const [key, value] of parser.associations) if (key instanceof Material || key instanceof Texture) reducedAssociations.set(key, value);
				node.traverse((node) => {
					const mappings = parser.associations.get(node);
					if (mappings != null) reducedAssociations.set(node, mappings);
				});
				return reducedAssociations;
			};
			parser.associations = reduceAssociations(scene);
			return scene;
		});
	}
	_createAnimationTracks(node, inputAccessor, outputAccessor, sampler, target) {
		const tracks = [];
		const targetName = node.name ? node.name : node.uuid;
		const targetNames = [];
		function collectMorphTargets(object) {
			if (object.morphTargetInfluences) targetNames.push(object.name ? object.name : object.uuid);
		}
		if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {
			collectMorphTargets(node);
			if (node.isGroup) node.children.forEach(collectMorphTargets);
		} else targetNames.push(targetName);
		let TypedKeyframeTrack;
		switch (PATH_PROPERTIES[target.path]) {
			case PATH_PROPERTIES.weights:
				TypedKeyframeTrack = NumberKeyframeTrack;
				break;
			case PATH_PROPERTIES.rotation:
				TypedKeyframeTrack = QuaternionKeyframeTrack;
				break;
			case PATH_PROPERTIES.translation:
			case PATH_PROPERTIES.scale:
				TypedKeyframeTrack = VectorKeyframeTrack;
				break;
			default: switch (outputAccessor.itemSize) {
				case 1:
					TypedKeyframeTrack = NumberKeyframeTrack;
					break;
				default: TypedKeyframeTrack = VectorKeyframeTrack;
			}
		}
		const interpolation = sampler.interpolation !== void 0 ? INTERPOLATION[sampler.interpolation] : InterpolateLinear;
		const outputArray = this._getArrayFromAccessor(outputAccessor);
		for (let j = 0, jl = targetNames.length; j < jl; j++) {
			const track = new TypedKeyframeTrack(targetNames[j] + "." + PATH_PROPERTIES[target.path], inputAccessor.array, outputArray, interpolation);
			if (sampler.interpolation === "CUBICSPLINE") this._createCubicSplineTrackInterpolant(track);
			tracks.push(track);
		}
		return tracks;
	}
	_getArrayFromAccessor(accessor) {
		let outputArray = accessor.array;
		if (accessor.normalized) {
			const scale = getNormalizedComponentScale(outputArray.constructor);
			const scaled = new Float32Array(outputArray.length);
			for (let j = 0, jl = outputArray.length; j < jl; j++) scaled[j] = outputArray[j] * scale;
			outputArray = scaled;
		}
		return outputArray;
	}
	_createCubicSplineTrackInterpolant(track) {
		track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline(result) {
			return new (this instanceof QuaternionKeyframeTrack ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant)(this.times, this.values, this.getValueSize() / 3, result);
		};
		track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;
	}
};
/**
*
* @private
* @param {BufferGeometry} geometry
* @param {GLTF.Primitive} primitiveDef
* @param {GLTFParser} parser
*/
function computeBounds(geometry, primitiveDef, parser) {
	const attributes = primitiveDef.attributes;
	const box = new Box3();
	if (attributes.POSITION !== void 0) {
		const accessor = parser.json.accessors[attributes.POSITION];
		const min = accessor.min;
		const max = accessor.max;
		if (min !== void 0 && max !== void 0) {
			box.set(new Vector3(min[0], min[1], min[2]), new Vector3(max[0], max[1], max[2]));
			if (accessor.normalized) {
				const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
				box.min.multiplyScalar(boxScale);
				box.max.multiplyScalar(boxScale);
			}
		} else {
			console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
			return;
		}
	} else return;
	const targets = primitiveDef.targets;
	if (targets !== void 0) {
		const maxDisplacement = new Vector3();
		const vector = new Vector3();
		for (let i = 0, il = targets.length; i < il; i++) {
			const target = targets[i];
			if (target.POSITION !== void 0) {
				const accessor = parser.json.accessors[target.POSITION];
				const min = accessor.min;
				const max = accessor.max;
				if (min !== void 0 && max !== void 0) {
					vector.setX(Math.max(Math.abs(min[0]), Math.abs(max[0])));
					vector.setY(Math.max(Math.abs(min[1]), Math.abs(max[1])));
					vector.setZ(Math.max(Math.abs(min[2]), Math.abs(max[2])));
					if (accessor.normalized) {
						const boxScale = getNormalizedComponentScale(WEBGL_COMPONENT_TYPES[accessor.componentType]);
						vector.multiplyScalar(boxScale);
					}
					maxDisplacement.max(vector);
				} else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");
			}
		}
		box.expandByVector(maxDisplacement);
	}
	geometry.boundingBox = box;
	const sphere = new Sphere();
	box.getCenter(sphere.center);
	sphere.radius = box.min.distanceTo(box.max) / 2;
	geometry.boundingSphere = sphere;
}
/**
*
* @private
* @param {BufferGeometry} geometry
* @param {GLTF.Primitive} primitiveDef
* @param {GLTFParser} parser
* @return {Promise<BufferGeometry>}
*/
function addPrimitiveAttributes(geometry, primitiveDef, parser) {
	const attributes = primitiveDef.attributes;
	const pending = [];
	function assignAttributeAccessor(accessorIndex, attributeName) {
		return parser.getDependency("accessor", accessorIndex).then(function(accessor) {
			geometry.setAttribute(attributeName, accessor);
		});
	}
	for (const gltfAttributeName in attributes) {
		const threeAttributeName = ATTRIBUTES[gltfAttributeName] || gltfAttributeName.toLowerCase();
		if (threeAttributeName in geometry.attributes) continue;
		pending.push(assignAttributeAccessor(attributes[gltfAttributeName], threeAttributeName));
	}
	if (primitiveDef.indices !== void 0 && !geometry.index) {
		const accessor = parser.getDependency("accessor", primitiveDef.indices).then(function(accessor) {
			geometry.setIndex(accessor);
		});
		pending.push(accessor);
	}
	if (ColorManagement.workingColorSpace !== "srgb-linear" && "COLOR_0" in attributes) console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${ColorManagement.workingColorSpace}" not supported.`);
	assignExtrasToUserData(geometry, primitiveDef);
	computeBounds(geometry, primitiveDef, parser);
	return Promise.all(pending).then(function() {
		return primitiveDef.targets !== void 0 ? addMorphTargets(geometry, primitiveDef.targets, parser) : geometry;
	});
}
//#endregion
//#region node_modules/three/examples/jsm/libs/meshopt_decoder.module.js
var MeshoptDecoder = (function() {
	var wasm_base = "b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuixkbeeeddddillviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WboY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbrl79IV9Rbwq:VZkdbk:XYi5ud9:du8Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaicefhxcj;abad9Uc;WFbGcjdadca0EhmaialfgPar9Rgoadfhsavaoadz:jjjjbgzceVhHcbhOdndninaeaO9nmeaPax9RaD6mdamaeaO9RaOamfgoae6EgAcsfglc9WGhCabaOad2fhXaAcethQaxaDfhiaOaeaoaeao6E9RhLalcl4cifcd4hKazcj;cbfaAfhYcbh8AazcjdfhEaHh3incbh5dnawTmbaxa8Acd4fRbbh5kcbh8Eazcj;cbfhqinaih8Fdndndndna5a8Ecet4ciGgoc9:fPdebdkaPa8F9RaA6mrazcj;cbfa8EaA2fa8FaAz:jjjjb8Aa8FaAfhixdkazcj;cbfa8EaA2fcbaAz:kjjjb8Aa8FhixekaPa8F9RaK6mva8FaKfhidnaCTmbaPai9RcK6mbaocdtc:q:G:cjbfcj:G:cjbawEhaczhrcbhlinargoc9Wfghaqfhrdndndndndndnaaa8Fahco4fRbbalcoG4ciGcdtfydbPDbedvivvvlvkar9cb83bwar9cb83bbxlkarcbaiRbdai8Xbb9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbaqaofgrcGfcbaicdfa8J9c8N1:NfghRbbag9cjjjjjw:dg8J9qE86bbarcVfcbaha8J9c8M1:NfghRbbag9cjjjjjl:dg8J9qE86bbarc7fcbaha8J9c8L1:NfghRbbag9cjjjjjd:dg8J9qE86bbarctfcbaha8J9c8K1:NfghRbbag9cjjjjje:dg8J9qE86bbarc91fcbaha8J9c8J1:NfghRbbag9cjjjj;ab:dg8J9qE86bbarc4fcbaha8J9cg1:NfghRbbag9cjjjja:dg8J9qE86bbarc93fcbaha8J9ch1:NfghRbbag9cjjjjz:dgg9qE86bbarc94fcbahag9ca1:NfghRbbai8Xbe9c:c:qj:bw9:9c:q;c1:I1e:d9c:b:c:e1z9:gg9cjjjjjz:dg8J9qE86bbarc95fcbaha8J9c8N1:NfgiRbbag9cjjjjjw:dg8J9qE86bbarc96fcbaia8J9c8M1:NfgiRbbag9cjjjjjl:dg8J9qE86bbarc97fcbaia8J9c8L1:NfgiRbbag9cjjjjjd:dg8J9qE86bbarc98fcbaia8J9c8K1:NfgiRbbag9cjjjjje:dg8J9qE86bbarc99fcbaia8J9c8J1:NfgiRbbag9cjjjj;ab:dg8J9qE86bbarc9:fcbaia8J9cg1:NfgiRbbag9cjjjja:dg8J9qE86bbarcufcbaia8J9ch1:NfgiRbbag9cjjjjz:dgg9qE86bbaiag9ca1:NfhixikaraiRblaiRbbghco4g8Ka8KciSg8KE86bbaqaofgrcGfaiclfa8Kfg8KRbbahcl4ciGg8La8LciSg8LE86bbarcVfa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc7fa8Ka8Lfg8KRbbahciGghahciSghE86bbarctfa8Kahfg8KRbbaiRbeghco4g8La8LciSg8LE86bbarc91fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc4fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc93fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc94fa8Kahfg8KRbbaiRbdghco4g8La8LciSg8LE86bbarc95fa8Ka8Lfg8KRbbahcl4ciGg8La8LciSg8LE86bbarc96fa8Ka8Lfg8KRbbahcd4ciGg8La8LciSg8LE86bbarc97fa8Ka8Lfg8KRbbahciGghahciSghE86bbarc98fa8KahfghRbbaiRbigico4g8Ka8KciSg8KE86bbarc99faha8KfghRbbaicl4ciGg8Ka8KciSg8KE86bbarc9:faha8KfghRbbaicd4ciGg8Ka8KciSg8KE86bbarcufaha8KfgrRbbaiciGgiaiciSgiE86bbaraifhixdkaraiRbwaiRbbghcl4g8Ka8KcsSg8KE86bbaqaofgrcGfaicwfa8Kfg8KRbbahcsGghahcsSghE86bbarcVfa8KahfghRbbaiRbeg8Kcl4g8La8LcsSg8LE86bbarc7faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarctfaha8KfghRbbaiRbdg8Kcl4g8La8LcsSg8LE86bbarc91faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc4faha8KfghRbbaiRbig8Kcl4g8La8LcsSg8LE86bbarc93faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc94faha8KfghRbbaiRblg8Kcl4g8La8LcsSg8LE86bbarc95faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc96faha8KfghRbbaiRbvg8Kcl4g8La8LcsSg8LE86bbarc97faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc98faha8KfghRbbaiRbog8Kcl4g8La8LcsSg8LE86bbarc99faha8LfghRbba8KcsGg8Ka8KcsSg8KE86bbarc9:faha8KfghRbbaiRbrgicl4g8Ka8KcsSg8KE86bbarcufaha8KfgrRbbaicsGgiaicsSgiE86bbaraifhixekarai8Pbw83bwarai8Pbb83bbaiczfhikdnaoaC9pmbalcdfhlaoczfhraPai9RcL0mekkaoaC6moaimexokaCmva8FTmvkaqaAfhqa8Ecefg8Ecl9hmbkdndndndnawTmbasa8Acd4fRbbgociGPlbedrbkaATmdaza8Afh8Fazcj;cbfhhcbh8EaEhaina8FRbbhraahocbhlinaoahalfRbbgqce4cbaqceG9R7arfgr86bbaoadfhoaAalcefgl9hmbkaacefhaa8Fcefh8FahaAfhha8Ecefg8Ecl9hmbxikkaATmeaza8Afhaazcj;cbfhhcbhoceh8EaYh8FinaEaofhlaa8Vbbhrcbhoinala8FaofRbbcwtahaofRbbgqVc;:FiGce4cbaqceG9R7arfgr87bbaladfhlaLaocefgofmbka8FaQfh8FcdhoaacdfhaahaQfhha8EceGhlcbh8EalmbxdkkaATmbaocl4h8Eaza8AfRbbhqcwhoa3hlinalRbbaotaqVhqalcefhlaocwfgoca9hmbkcbhhaEh8FaYhainazcj;cbfahfRbbhrcwhoaahlinalRbbaotarVhralaAfhlaocwfgoca9hmbkara8E94aq7hqcbhoa8Fhlinalaqao486bbalcefhlaocwfgoca9hmbka8Fadfh8FaacefhaahcefghaA9hmbkkaEclfhEa3clfh3a8Aclfg8Aad6mbkaXazcjdfaAad2z:jjjjb8AazazcjdfaAcufad2fadz:jjjjb8AaAaOfhOaihxaimbkc9:hoxdkcbc99aPax9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaok:ysezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecjez:kjjjb8Aav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk:4ioiue99dud99dud99dnaeTmbcbhiabhlindndnal8Uebgv:YgoJ:ji:1Salcof8UebgrciVgw:Y:vgDNJbbbZJbbb:;avcu9kEMgq:lJbbb9p9DTmbaq:Ohkxekcjjjj94hkkalclf8Uebhvalcdf8UebhxalarcefciGcetfak87ebdndnax:YgqaDNJbbbZJbbb:;axcu9kEMgm:lJbbb9p9DTmbam:Ohxxekcjjjj94hxkabaiarciGgkfcd7cetfax87ebdndnav:YgmaDNJbbbZJbbb:;avcu9kEMgP:lJbbb9p9DTmbaP:Ohvxekcjjjj94hvkalarcufciGcetfav87ebdndnawaw2:ZgPaPMaoaoN:taqaqN:tamamN:tgoJbbbbaoJbbbb9GE:raDNJbbbZMgD:lJbbb9p9DTmbaD:Ohrxekcjjjj94hrkalakcetfar87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk:Tvirud99eudndnadcl9hmbaeTmeindndnabRbbgiabcefgl8Sbbgvabcdfgo8Sbbgrf9R:YJbbuJabcifgwRbbgdce4adVgDcd4aDVgDcl4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax86bbdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao86bbdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai86bbdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad86bbabclfhbaecufgembxdkkaeTmbindndnab8Vebgiabcdfgl8Uebgvabclfgo8Uebgrf9R:YJbFu9habcofgw8Vebgdce4adVgDcd4aDVgDcl4aDVgDcw4aDVgD:Z:vgqNJbbbZMgk:lJbbb9p9DTmbak:Ohxxekcjjjj94hxkaoax87ebdndnaraif:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohoxekcjjjj94hokalao87ebdndnavaifar9R:YaqNJbbbZMgk:lJbbb9p9DTmbak:Ohixekcjjjj94hikabai87ebdndnaDadcetGadceGV:ZaqNJbbbZMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkawad87ebabcwfhbaecufgembkkk9teiucbcbyd:K:G:cjbgeabcifc98GfgbBd:K:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkk83dbcj:Gdk8Kbbbbdbbblbbbwbbbbbbbebbbdbbblbbbwbbbbc:K:Gdkl8W:qbb";
	var wasm_simd = "b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuixkbbebeeddddilve9Weeeviebeoweuecj:Gdkr;Neqo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949WbwY9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVJ9V29VVbDl79IV9Rbqq:W9Dklbzik94evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaeai86b:q:W:cjbaecitab8Piw83i:q:G:cjbaecefgecjd9hmbkk:JBl8Aud97dur978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnalTmbcuhoaiRbbgrc;WeGc:Ge9hmbarcsGgwce0mbc9:hoalcufadcd4cbawEgDadfgrcKcaawEgqaraq0Egk6mbaialfgxar9RhodnadTgmmbavaoad;8qbbkaicefhPcj;abad9Uc;WFbGcjdadca0EhsdndndnadTmbaoadfhzcbhHinaeaH9nmdaxaP9RaD6miabaHad2fhOaPaDfhAasaeaH9RaHasfae6EgCcsfgocl4cifcd4hXavcj;cbfaoc9WGgQcetfhLavcj;cbfaQci2fhKavcj;cbfaQfhYcbh8Aaoc;ab6hEincbh3dnawTmbaPa8Acd4fRbbh3kcbh5avcj;cbfh8Eindndndndna3a5cet4ciGgoc9:fPdebdkaxaA9RaQ6mwdnaQTmbavcj;cbfa5aQ2faAaQ;8qbbkaAaCfhAxdkaQTmeavcj;cbfa5aQ2fcbaQ;8kbxekaxaA9RaX6moaoclVcbawEhraAaXfhocbhidnaEmbaxao9Rc;Gb6mbcbhlina8EalfhidndndndndndnaAalco4fRbbgqciGarfPDbedibledibkaipxbbbbbbbbbbbbbbbbpklbxlkaiaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiaopbbbpklbaoczfhoxekaiaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcd4ciGarfPDbedibledibkaiczfpxbbbbbbbbbbbbbbbbpklbxlkaiczfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaiczfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaiczfaopbbbpklbaoczfhoxekaiczfaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqcl4ciGarfPDbedibledibkaicafpxbbbbbbbbbbbbbbbbpklbxlkaicafaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaoclffagRb:q:W:cjbfhoxikaicafaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbahaocwffagRb:q:W:cjbfhoxdkaicafaopbbbpklbaoczfhoxekaicafaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbahaocdffagRb:q:W:cjbfhokdndndndndndnaqco4arfPDbedibledibkaic8Wfpxbbbbbbbbbbbbbbbbpklbxlkaic8Wfaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaoclffaqRb:q:W:cjbfhoxikaic8Wfaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Ngicitpbi:q:G:cjbaiRb:q:W:cjbgipsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Ngqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spklbaiaocwffaqRb:q:W:cjbfhoxdkaic8Wfaopbbbpklbaoczfhoxekaic8WfaopbbdaoRbbgicitpbi:q:G:cjbaiRb:q:W:cjbgipsaoRbegqcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpklbaiaocdffaqRb:q:W:cjbfhokalc;abfhialcjefaQ0meaihlaxao9Rc;Fb0mbkkdnaiaQ9pmbaici4hlinaxao9RcK6mwa8EaifhqdndndndndndnaAaico4fRbbalcoG4ciGarfPDbedibledibkaqpxbbbbbbbbbbbbbbbbpkbbxlkaqaopbblaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLg8Fcdp:mea8FpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogapxiiiiiiiiiiiiiiiip8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaoclffagRb:q:W:cjbfhoxikaqaopbbwaopbbbg8Fclp:mea8FpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogapxssssssssssssssssp8Jg8Fp5b9cjF;8;4;W;G;ab9:9cU1:Nghcitpbi:q:G:cjbahRb:q:W:cjbghpsa8Fp5e9cjF;8;4;W;G;ab9:9cU1:Nggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPaaa8Fp9spkbbahaocwffagRb:q:W:cjbfhoxdkaqaopbbbpkbbaoczfhoxekaqaopbbdaoRbbghcitpbi:q:G:cjbahRb:q:W:cjbghpsaoRbeggcitpbi:q:G:cjbp9UpmbedilvorzHOACXQLpPpkbbahaocdffagRb:q:W:cjbfhokalcdfhlaiczfgiaQ6mbkkaohAaoTmoka8EaQfh8Ea5cefg5cl9hmbkdndndndnawTmbaza8Acd4fRbbglciGPlbedwbkaQTmdavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep9Ta8Fpxeeeeeeeeeeeeeeeegap9op9Hp9rg8Fa8Jp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ug8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp9Ug8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep9Ta8Faap9op9Hp9rg8Fp9Ugap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp9Ugap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp9Ugap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp9Ug8Jp9AbbbaladfhlaoczfgoaQ6mbxikkaQTmeavcjdfa8Afhlava8Afpbdbh8Jcbhoinalavcj;cbfaofpblbg8KaYaofpblbg8LpmbzeHdOiAlCvXoQrLg8MaLaofpblbg8NaKaofpblbgypmbzeHdOiAlCvXoQrLg8PpmbezHdiOAlvCXorQLg8Fcep:nea8Fpxebebebebebebebebgap9op:bep9rg8Fa8Jp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ma8PpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwKDYq8AkEx3m5P8Es8Fg8Ka8NaypmwKDYq8AkEx3m5P8Es8Fg8LpmbezHdiOAlvCXorQLg8Fcep:nea8Faap9op:bep9rg8Fp:oeg8Jp9Abbbaladfgla8Ja8Fa8Fpmlvorlvorlvorlvorp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmwDqkwDqkwDqkwDqkp:oeg8Jp9Abbbaladfgla8Ja8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9Abbbaladfgla8Ja8Ka8LpmwDKYqk8AExm35Ps8E8Fg8Fcep:nea8Faap9op:bep9rg8Fp:oegap9Abbbaladfglaaa8Fa8Fpmlvorlvorlvorlvorp:oegap9Abbbaladfglaaa8Fa8FpmwDqkwDqkwDqkwDqkp:oegap9Abbbaladfglaaa8Fa8FpmxmPsxmPsxmPsxmPsp:oeg8Jp9AbbbaladfhlaoczfgoaQ6mbxdkkaQTmbcbhocbalcl4gl9Rc8FGhiavcjdfa8Afhrava8Afpbdbhainaravcj;cbfaofpblbg8JaYaofpblbg8KpmbzeHdOiAlCvXoQrLg8LaLaofpblbg8MaKaofpblbg8NpmbzeHdOiAlCvXoQrLgypmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Faap9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8LaypmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwKDYq8AkEx3m5P8Es8Fg8Ja8Ma8NpmwKDYq8AkEx3m5P8Es8Fg8KpmbezHdiOAlvCXorQLg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9Abbbaradfgraaa8Ja8KpmwDKYqk8AExm35Ps8E8Fg8Faip:Rea8Falp:Tep9qg8Fp9rgap9Abbbaradfgraaa8Fa8Fpmlvorlvorlvorlvorp9rgap9Abbbaradfgraaa8Fa8FpmwDqkwDqkwDqkwDqkp9rgap9Abbbaradfgraaa8Fa8FpmxmPsxmPsxmPsxmPsp9rgap9AbbbaradfhraoczfgoaQ6mbkka8Aclfg8Aad6mbkdnaCad2goTmbaOavcjdfao;8qbbkdnammbavavcjdfaCcufad2fad;8qbbkaCaHfhHc9:hoaAhPaAmbxlkkaeTmbaDalfhrcbhocuhlinaralaD9RglfaD6mdasaeao9Raoasfae6Eaofgoae6mbkaial9RhPkcbc99axaP9RakSEhoxekc9:hokavcj;kbf8Kjjjjbaokwbz:bjjjbkNsezu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnalaeci9UgrcHf6mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgDce0mbavc;abfcFecje;8kbav9cu83iUav9cu83i8Wav9cu83iyav9cu83iaav9cu83iKav9cu83izav9cu83iwav9cu83ibaialfc9WfhqaicefgwarfhldnaeTmbcmcsaDceSEhkcbhxcbhmcbhrcbhicbhoindnalaq9nmbc9:hoxikdndnawRbbgDc;Ve0mbavc;abfaoaDcu7gPcl4fcsGcitfgsydlhzasydbhHdndnaDcsGgsak9pmbavaiaPfcsGcdtfydbaxasEhDaxasTgOfhxxekdndnascsSmbcehOasc987asamffcefhDxekalcefhDal8SbbgscFeGhPdndnascu9mmbaDhlxekalcvfhlaPcFbGhPcrhsdninaD8SbbgOcFbGastaPVhPaOcu9kmeaDcefhDascrfgsc8J9hmbxdkkaDcefhlkcehOaPce4cbaPceG9R7amfhDkaDhmkavc;abfaocitfgsaDBdbasazBdlavaicdtfaDBdbavc;abfaocefcsGcitfgsaHBdbasaDBdlaocdfhoaOaifhidnadcd9hmbabarcetfgsaH87ebasclfaD87ebascdfaz87ebxdkabarcdtfgsaHBdbascwfaDBdbasclfazBdbxekdnaDcpe0mbavaiaqaDcsGfRbbgscl4gP9RcsGcdtfydbaxcefgOaPEhDavaias9RcsGcdtfydbaOaPTgzfgOascsGgPEhsaPThPdndnadcd9hmbabarcetfgHax87ebaHclfas87ebaHcdfaD87ebxekabarcdtfgHaxBdbaHcwfasBdbaHclfaDBdbkavaicdtfaxBdbavc;abfaocitfgHaDBdbaHaxBdlavaicefgicsGcdtfaDBdbavc;abfaocefcsGcitfgHasBdbaHaDBdlavaiazfgicsGcdtfasBdbavc;abfaocdfcsGcitfgDaxBdbaDasBdlaocifhoaiaPfhiaOaPfhxxekaxcbalRbbgsEgHaDc;:eSgDfhOascsGhAdndnascl4gCmbaOcefhzxekaOhzavaiaC9RcsGcdtfydbhOkdndnaAmbazcefhxxekazhxavaias9RcsGcdtfydbhzkdndnaDTmbalcefhDxekalcdfhDal8SbegPcFeGhsdnaPcu9kmbalcofhHascFbGhscrhldninaD8SbbgPcFbGaltasVhsaPcu9kmeaDcefhDalcrfglc8J9hmbkaHhDxekaDcefhDkasce4cbasceG9R7amfgmhHkdndnaCcsSmbaDhsxekaDcefhsaD8SbbglcFeGhPdnalcu9kmbaDcvfhOaPcFbGhPcrhldninas8SbbgDcFbGaltaPVhPaDcu9kmeascefhsalcrfglc8J9hmbkaOhsxekascefhskaPce4cbaPceG9R7amfgmhOkdndnaAcsSmbashlxekascefhlas8SbbgDcFeGhPdnaDcu9kmbascvfhzaPcFbGhPcrhDdninal8SbbgscFbGaDtaPVhPascu9kmealcefhlaDcrfgDc8J9hmbkazhlxekalcefhlkaPce4cbaPceG9R7amfgmhzkdndnadcd9hmbabarcetfgDaH87ebaDclfaz87ebaDcdfaO87ebxekabarcdtfgDaHBdbaDcwfazBdbaDclfaOBdbkavc;abfaocitfgDaOBdbaDaHBdlavaicdtfaHBdbavc;abfaocefcsGcitfgDazBdbaDaOBdlavaicefgicsGcdtfaOBdbavc;abfaocdfcsGcitfgDaHBdbaDazBdlavaiaCTaCcsSVfgicsGcdtfazBdbaiaATaAcsSVfhiaocifhokawcefhwaocsGhoaicsGhiarcifgrae6mbkkcbc99alaqSEhokavc;aef8Kjjjjbaok:clevu8Jjjjjbcz9Rhvdnalaecvf9pmbc9:skdnaiRbbc;:eGc;qeSmbcuskav9cb83iwaicefhoaialfc98fhrdnaeTmbdnadcdSmbcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcdtfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgiBdbalaiBdbawcefgwae9hmbxdkkcbhwindnaoar6mbc9:skaocefhlao8SbbgicFeGhddndnaicu9mmbalhoxekaocvfhoadcFbGhdcrhidninal8SbbgDcFbGaitadVhdaDcu9kmealcefhlaicrfgic8J9hmbxdkkalcefhokabawcetfadc8Etc8F91adcd47avcwfadceGcdtVglydbfgi87ebalaiBdbawcefgwae9hmbkkcbc99aoarSEk;Toio97eue97aec98Ghedndnadcl9hmbaeTmecbhdinababpbbbgicKp:RecKp:Sep;6eglaicwp:RecKp:Sep;6ealp;Geaiczp:RecKp:Sep;6egvp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgwp9op9rp;Keglpxbb;:9cbb;:9cbb;:9cbb;:9calalp;Meaoaop;Meavaravawp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFbbbFbbbFbbbFbbbp9oaipxbbbFbbbFbbbFbbbFp9op9qalavp;Mearp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaoavp;Mearp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgDaDpbbbgipxbbbbbbFFbbbbbbFFgwp9oabpbbbgoaipmbediwDqkzHOAKY8AEgvczp:Reczp:Sep;6eglaoaipmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eavczp:Sep;6egvp;Gealp;Gep;Kep;Legipxbbbbbbbbbbbbbbbbp:2egralpxbbbjbbbjbbbjbbbjgqp9op9rp;Keglpxb;:FSb;:FSb;:FSb;:FSalalp;Meaiaip;Meavaravaqp9op9rp;Keglalp;Mep;Kep;Kep;Jep;Negvp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbp9oaiavp;Mearp;Keczp:Rep9qgialavp;Mearp;KepxFFbbFFbbFFbbFFbbp9oglpmwDKYqk8AExm35Ps8E8Fp9qpkbbabaoawp9oaialpmbezHdiOAlvCXorQLp9qpkbbabcafhbadclfgdae6mbkkk;2ileue97euo97dnaec98GgiTmbcbheinabcKfpx:ji:1S:ji:1S:ji:1S:ji:1SabpbbbglabczfgvpbbbgopmlvorxmPsCXQL358E8Fgrczp:Segwpxibbbibbbibbbibbbp9qp;6egDp;NegqaDaDp;MegDaDp;KealaopmbediwDqkzHOAKY8AEgDczp:Reczp:Sep;6eglalp;MeaDczp:Sep;6egoaop;Mearczp:Reczp:Sep;6egrarp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jep;Mepxbbn0bbn0bbn0bbn0gDp;KepxFFbbFFbbFFbbFFbbgkp9oaqaop;MeaDp;Keczp:Rep9qgoaqalp;MeaDp;Keakp9oaqarp;MeaDp;Keczp:Rep9qgDpmwDKYqk8AExm35Ps8E8Fglp5eawclp:RegqpEi:T:j83ibavalp5baqpEd:T:j83ibabcwfaoaDpmbezHdiOAlvCXorQLgDp5eaqpEe:T:j83ibabaDp5baqpEb:T:j83ibabcafhbaeclfgeai6mbkkkuee97dnadcd4ae2c98GgeTmbcbhdinababpbbbgicwp:Recwp:Sep;6eaicep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbabczfhbadclfgdae6mbkkk:Sodw97euaec98Ghedndnadcl9hmbaeTmecbhdinabpxbbuJbbuJbbuJbbuJabpbbbgicKp:TeglaicYp:Tep9qgvcdp:Teavp9qgvclp:Teavp9qgop;6ep;Negvaicwp:RecKp:SegraipxFbbbFbbbFbbbFbbbgwp9ogDp:Uep;6ep;Mepxbbn0bbn0bbn0bbn0gqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9oavaDarp:Xeaiczp:RecKp:Segip:Uep;6ep;Meaqp;Keawp9op9qavaDaraip:Uep:Xep;6ep;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qavaoalcep:Rep9oalpxebbbebbbebbbebbbp9op9qp;6ep;Meaqp;KecKp:Rep9qpkbbabczfhbadclfgdae6mbxdkkaeTmbcbhdinabczfgkpxbFu9hbFu9hbFu9hbFu9habpbbbglakpbbbgrpmlvorxmPsCXQL358E8Fgvczp:TegqavcHp:Tep9qgicdp:Teaip9qgiclp:Teaip9qgicwp:Teaip9qgop;6ep;NegialarpmbediwDqkzHOAKY8AEgDpxFFbbFFbbFFbbFFbbglp9ograDczp:Segwp:Ueavczp:Reczp:SegDp:Xep;6ep;Mepxbbn0bbn0bbn0bbn0gvp;Kealp9oaiarawaDp:Uep:Xep;6ep;Meavp;Keczp:Rep9qgwaiaoaqcep:Rep9oaqpxebbbebbbebbbebbbp9op9qp;6ep;Meavp;Keczp:ReaiaDarp:Uep;6ep;Meavp;Kealp9op9qgipmwDKYqk8AExm35Ps8E8FpkbbabawaipmbezHdiOAlvCXorQLpkbbabcafhbadclfgdae6mbkkk9teiucbcbydj:G:cjbgeabcifc98GfgbBdj:G:cjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkxebcj:Gdklz:zbb";
	var detector = new Uint8Array([
		0,
		97,
		115,
		109,
		1,
		0,
		0,
		0,
		1,
		4,
		1,
		96,
		0,
		0,
		3,
		3,
		2,
		0,
		0,
		5,
		3,
		1,
		0,
		1,
		12,
		1,
		0,
		10,
		22,
		2,
		12,
		0,
		65,
		0,
		65,
		0,
		65,
		0,
		252,
		10,
		0,
		0,
		11,
		7,
		0,
		65,
		0,
		253,
		15,
		26,
		11
	]);
	var wasmpack = new Uint8Array([
		32,
		0,
		65,
		2,
		1,
		106,
		34,
		33,
		3,
		128,
		11,
		4,
		13,
		64,
		6,
		253,
		10,
		7,
		15,
		116,
		127,
		5,
		8,
		12,
		40,
		16,
		19,
		54,
		20,
		9,
		27,
		255,
		113,
		17,
		42,
		67,
		24,
		23,
		146,
		148,
		18,
		14,
		22,
		45,
		70,
		69,
		56,
		114,
		101,
		21,
		25,
		63,
		75,
		136,
		108,
		28,
		118,
		29,
		73,
		115
	]);
	if (typeof WebAssembly !== "object") return { supported: false };
	var wasm = WebAssembly.validate(detector) ? unpack(wasm_simd) : unpack(wasm_base);
	var instance;
	var ready = WebAssembly.instantiate(wasm, {}).then(function(result) {
		instance = result.instance;
		instance.exports.__wasm_call_ctors();
	});
	function unpack(data) {
		var result = new Uint8Array(data.length);
		for (var i = 0; i < data.length; ++i) {
			var ch = data.charCodeAt(i);
			result[i] = ch > 96 ? ch - 97 : ch > 64 ? ch - 39 : ch + 4;
		}
		var write = 0;
		for (var i = 0; i < data.length; ++i) result[write++] = result[i] < 60 ? wasmpack[result[i]] : (result[i] - 60) * 64 + result[++i];
		return result.buffer.slice(0, write);
	}
	function decode(instance, fun, target, count, size, source, filter) {
		var sbrk = instance.exports.sbrk;
		var count4 = count + 3 & -4;
		var tp = sbrk(count4 * size);
		var sp = sbrk(source.length);
		var heap = new Uint8Array(instance.exports.memory.buffer);
		heap.set(source, sp);
		var res = fun(tp, count, size, sp, source.length);
		if (res == 0 && filter) filter(tp, count4, size);
		target.set(heap.subarray(tp, tp + count * size));
		sbrk(tp - sbrk(0));
		if (res != 0) throw new Error("Malformed buffer data: " + res);
	}
	var filters = {
		NONE: "",
		OCTAHEDRAL: "meshopt_decodeFilterOct",
		QUATERNION: "meshopt_decodeFilterQuat",
		EXPONENTIAL: "meshopt_decodeFilterExp",
		COLOR: "meshopt_decodeFilterColor"
	};
	var decoders = {
		ATTRIBUTES: "meshopt_decodeVertexBuffer",
		TRIANGLES: "meshopt_decodeIndexBuffer",
		INDICES: "meshopt_decodeIndexSequence"
	};
	var workers = [];
	var requestId = 0;
	function createWorker(url) {
		var worker = {
			object: new Worker(url),
			pending: 0,
			requests: {}
		};
		worker.object.onmessage = function(event) {
			var data = event.data;
			worker.pending -= data.count;
			worker.requests[data.id][data.action](data.value);
			delete worker.requests[data.id];
		};
		return worker;
	}
	function initWorkers(count) {
		var source = "self.ready = WebAssembly.instantiate(new Uint8Array([" + new Uint8Array(wasm) + "]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = " + workerProcess.name + ";" + decode.toString() + workerProcess.toString();
		var blob = new Blob([source], { type: "text/javascript" });
		var url = URL.createObjectURL(blob);
		for (var i = workers.length; i < count; ++i) workers[i] = createWorker(url);
		for (var i = count; i < workers.length; ++i) workers[i].object.postMessage({});
		workers.length = count;
		URL.revokeObjectURL(url);
	}
	function decodeWorker(count, size, source, mode, filter) {
		var worker = workers[0];
		for (var i = 1; i < workers.length; ++i) if (workers[i].pending < worker.pending) worker = workers[i];
		return new Promise(function(resolve, reject) {
			var data = new Uint8Array(source);
			var id = ++requestId;
			worker.pending += count;
			worker.requests[id] = {
				resolve,
				reject
			};
			worker.object.postMessage({
				id,
				count,
				size,
				source: data,
				mode,
				filter
			}, [data.buffer]);
		});
	}
	function workerProcess(event) {
		var data = event.data;
		self.ready.then(function(instance) {
			if (!data.id) return self.close();
			try {
				var target = new Uint8Array(data.count * data.size);
				decode(instance, instance.exports[data.mode], target, data.count, data.size, data.source, instance.exports[data.filter]);
				self.postMessage({
					id: data.id,
					count: data.count,
					action: "resolve",
					value: target
				}, [target.buffer]);
			} catch (error) {
				self.postMessage({
					id: data.id,
					count: data.count,
					action: "reject",
					value: error
				});
			}
		});
	}
	return {
		ready,
		supported: true,
		useWorkers: function(count) {
			initWorkers(count);
		},
		decodeVertexBuffer: function(target, count, size, source, filter) {
			decode(instance, instance.exports.meshopt_decodeVertexBuffer, target, count, size, source, instance.exports[filters[filter]]);
		},
		decodeIndexBuffer: function(target, count, size, source) {
			decode(instance, instance.exports.meshopt_decodeIndexBuffer, target, count, size, source);
		},
		decodeIndexSequence: function(target, count, size, source) {
			decode(instance, instance.exports.meshopt_decodeIndexSequence, target, count, size, source);
		},
		decodeGltfBuffer: function(target, count, size, source, mode, filter) {
			decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
		},
		decodeGltfBufferAsync: function(count, size, source, mode, filter) {
			if (workers.length > 0) return decodeWorker(count, size, source, decoders[mode], filters[filter]);
			return ready.then(function() {
				var target = new Uint8Array(count * size);
				decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
				return target;
			});
		}
	};
})();
//#endregion
export { GLTFLoader as n, MeshoptDecoder as t };
