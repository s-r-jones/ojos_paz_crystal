// ScreenSpaceNormals.js
// Version 0.1.0
// Event: onAwake
// Create normals for selected objects based on their depth. Normals are rendered into the supplied Render Target and can be used for lighting or other effects in Material and VFX Editor.
// @input SceneObject[] objectsForNormalsGen
// @input bool FixDelay {"hint":"When enabled, fix the 1 frame delay introduced when doing operations on a depth render target. This clones everything in objectsForNormalsGen and renders them in a depth-only pre-pass."}
// @input bool advanced
// @ui {"widget":"group_start", "label":"Properties", "showIf" : "advanced"}
// @input bool enableBlur = false {"hint":"Blur the normal map."}
// @input float blurStrength = 4.0 {"showIf":"enableBlur","widget":"slider","min":0.0,"max":10.0,"step":0.01}

// @input Component.Camera mainCamera {"hint":"The main render camera."}
// @input Asset.Texture normalsTarget {"hint":"Render target that will contain the screen space normals."}
// @input Asset.Texture depthTarget {"hint":"Depth Render Target"}
// @input Asset.Texture screenTex {"label": "Screen Texture"}
// @input Asset.Material depthtoNormal {"label": "Depth to Normal"}
// @input Asset.Material blurMat {"label":"Blur Material", "showIf":"enableBlur"}
// @ui {"widget":"group_end"}

var depthLayer = LayerSet.makeUnique();
var normalLayer = LayerSet.makeUnique();

// Create a global array to hold cloned objects
// in case they need to be modified by another script
if (!global.ssn_clonedObj) {
    global.ssn_clonedObj = [];
}
script.ssn_maxRenderOrder = -100000;

initialize();

function initialize() {
    // Break when missing input
    if (!validateInputs()) { 
        return;
    }
    var depthStencilTexture = script.depthTarget;
    
    if (script.FixDelay) {
        // Set up depth camera
        var depthCamera = global.scene.createSceneObject("DepthCam");
        depthCamera.setParent(script.mainCamera.getSceneObject());
        var depthCameraComponent = depthCamera.copyComponent(script.mainCamera);
        depthCameraComponent.renderLayer = depthLayer;
        depthCameraComponent.renderOrder = script.mainCamera.renderOrder - 100;
        
        // Create depth texture
        depthCameraComponent.renderTarget.control.msaa = false;
        depthCameraComponent.depthStencilRenderTarget.depthClearOption = DepthClearOption.CustomValue;
        depthCameraComponent.depthStencilRenderTarget.targetTexture = depthStencilTexture;
        depthCameraComponent.depthStencilRenderTarget.clearDepth = 1.0;   
        
        // Clone objects and assign to depthLayer
        // We need to do this in order for the depth target to be in sync with the final output target,
        // otherwise there is a 1 frame delay
        for (var i = 0; i < script.objectsForNormalsGen.length; i++) {
            // Skip if no scene object is assigned to this slot
            if (!script.objectsForNormalsGen[i]) {
                continue;
            } else {
                componentSearchAndClone(script.objectsForNormalsGen[i], depthLayer);
            }
        }        
    }
    else {
        script.mainCamera.renderTarget.control.msaa = false;
        script.mainCamera.depthStencilRenderTarget.depthClearOption = DepthClearOption.CustomValue;     
        script.mainCamera.depthStencilRenderTarget.targetTexture = depthStencilTexture;
        script.mainCamera.depthStencilRenderTarget.clearDepth = 1.0;
    }

    // Set up normals pass
    createPostEffectForPass(script.depthtoNormal, normalLayer);
    var normalCamera = global.scene.createSceneObject("normalCam");
    normalCamera.setParent(script.mainCamera.getSceneObject());
    normalCameraComponent = normalCamera.copyComponent(script.mainCamera);
    normalCameraComponent.renderLayer = normalLayer;
    normalCameraComponent.renderTarget = script.normalsTarget;
    normalCameraComponent.renderOrder = script.FixDelay ? depthCameraComponent.renderOrder+1 : script.mainCamera.renderOrder+1;

    script.depthtoNormal.mainPass.depthTexture = depthStencilTexture;
    script.depthtoNormal.mainPass.samplers.depthTexture.filtering = FilteringMode.Nearest;

    if (script.enableBlur) {
        setupBlurPasses(depthStencilTexture);
    }

}


function validateInputs() {
    if (!script.mainCamera) {
        print("ERROR: Make sure Camera is set.");
        return false;
    }

    if (!Camera.depthStencilRenderTargetSupported()) {      
        print("ERROR: Device does not support depth stencil render targets.");
        return false;
    }

    for (var j = 0; j < script.objectsForNormalsGen.length; j++) {   
        if (!script.objectsForNormalsGen[j]) {
            print("ERROR: Make sure to select scene objects for normal generation in each input, remove empty input slot if there's any.");
        }
    }
    if (script.objectsForNormalsGen.length == 0) {
        print("ERROR: Please assign at least one scene object for normal generation.");
    }

    if (!script.normalsTarget) {
        print("ERROR: Make sure Normal render target is set.");
        return false;
    }
    if (!script.depthtoNormal) {
        print("ERROR: Make sure Depth to Normal material is set");
        return false;
    }
    if (script.enableBlur) {
        if (!script.blurMat) {
            print("ERROR: Make sure Bilateral Blur material is set");
            return false;
        }
    }    
    return true;
}

// Configure blur materials and create blur passes
function setupBlurPasses(depthStencilTexture) {
    script.blurMat.mainPass.baseTex = script.screenTex;
    script.blurMat.mainPass.samplers.baseTex.wrapU = WrapMode.ClampToEdge;
    script.blurMat.mainPass.samplers.baseTex.wrapV = WrapMode.ClampToEdge;
    script.blurMat.mainPass.depthTex = depthStencilTexture;
    script.blurMat.mainPass.samplers.depthTex.filtering = FilteringMode.Nearest;
    script.blurMat.mainPass.blurDirection = new vec2 (0.0, script.blurStrength);

    var blurMatH = script.blurMat.clone();
    blurMatH.mainPass.blurDirection = new vec2 (script.blurStrength,0.0);
    
    // Do the blur
    createPostEffectForPass(blurMatH, normalLayer);
    createPostEffectForPass(script.blurMat, normalLayer);
}

// Search for a render mesh visual component in a given scene object,
// clone the scene object it's attached to, and add to the depth prepass layer.
// Also duplicate the material and disable the color mask to avoid fragment shader cost
function componentSearchAndClone(meshVisualObject, layer) {
    var objects = [];
    getComponentRecursive(meshVisualObject, "Component.RenderMeshVisual", objects);
    
    var animMixers = [];
    var clonedObject;
    var newObjMat;
    var i;
    var j;
    
    for (i = 0; i < objects.length; i++) {
        
        var targetObject = objects[i].getSceneObject();  
        var animMixerObj = parentComponentSearch(targetObject, "Component.AnimationMixer");
        
        // If an animation mixer is a parent of this object, take a different path
        // This is because animations can have scale operations that would otherwise be applied recursively        
        if (animMixerObj) {
            var foundMatchingMixer = false;
            for (j = 0; j < animMixers.length; j++) {
                if (animMixerObj == animMixers[j]) { 
                    foundMatchingMixer = true;
                }
            }
            if (!foundMatchingMixer) {
                animMixers.push(animMixerObj);
            }
            continue;
        }
        
        clonedObject = targetObject.copyWholeHierarchy(targetObject);
        clonedObject.name = "ssn_" + clonedObject.name;
        clonedObject.getTransform().setLocalPosition(new vec3(0, 0, 0));
        clonedObject.getTransform().setLocalRotation(quat.quatIdentity());
        clonedObject.getTransform().setLocalScale(new vec3(1, 1, 1));
        
        newObjMat = objects[i].mainMaterial.clone();
        newObjMat.mainPass.colorMask = new vec4b(false,false,false,false);            
        clonedObject.getComponent("Component.RenderMeshVisual").mainMaterial = newObjMat;
        clonedObject.layer = layer;
                
        global.ssn_clonedObj.push(clonedObject);
    }
    
    // Get all the MeshVisual children of a cloned AnimationMixer hierarchy and add those to the depth layer
    for (i = 0; i < animMixers.length; i++) {
        
        clonedObject = animMixers[i].copyWholeHierarchy(animMixers[i]);
        clonedObject.name = "ssn_" + clonedObject.name;
        
        clonedObject.getTransform().setLocalPosition(new vec3(0, 0, 0));
        clonedObject.getTransform().setLocalRotation(quat.quatIdentity());
        clonedObject.getTransform().setLocalScale(new vec3(1, 1, 1));
                
        var animObjects = [];
        getComponentRecursive(clonedObject, "Component.RenderMeshVisual", animObjects);

        for (j = 0; j < animObjects.length; j++) {
            newObjMat = animObjects[j].mainMaterial.clone();
            newObjMat.mainPass.colorMask = new vec4b(false,false,false,false);            
            animObjects[j].mainMaterial = newObjMat;
            animObjects[j].getSceneObject().layer = layer;
        }

        global.ssn_clonedObj.push(clonedObject);
    }
}

function getComponentRecursive(rootObject, component, objects) {
    var comps = [];
    comps = rootObject.getComponents(component);
    for (var j = 0; j < comps.length; j++) {
        objects.push(comps[j]);
    }
    for (var i = 0; i < rootObject.getChildrenCount(); i++) {
        var children = rootObject.getChild(i);
        getComponentRecursive(children, component, objects);
    }
}

// Walk up the hierarchy and return a scene object if a given component is found
function parentComponentSearch(srcObj, component) {
    var foundObj = srcObj;
    if (foundObj.getComponent(component)) {
        return foundObj;
    } else {
        if (foundObj.hasParent()) {
            return parentComponentSearch(foundObj.getParent(), component);
        } else {
            return null;
        }
    }
}

function createPostEffectForPass(material, layer) {
    var meshSceneObj = scene.createSceneObject("");
    meshSceneObj.layer = layer;
    meshSceneObj.renderOrder = script.ssn_maxRenderOrder;
    script.ssn_maxRenderOrder++;
    meshSceneObj.createComponent("PostEffectVisual").mainMaterial = material;
    return meshSceneObj;
}