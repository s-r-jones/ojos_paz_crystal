// HintController.js
// Version: 0.0.2
// Event: Lens Initialized
// Description: Control the hint for each state of landmarker detection

// @ui {"widget":"label", "label":"The Hint Controller offers a few different ways"}
// @ui {"widget":"label", "label":"to help navigate users to the Custom Landmarker."}
// @ui {"widget":"label", "label":""}

// @ui {"widget":"group_start","label":"Hint Text"}
// @input string landmarkerName {"label":"Landmarker Name"}
// @ui {"widget":"group_end"}

// @ui {"widget":"group_start","label":"Hint Textures"}
// @input Asset.Texture landmarkerGraphicsTexture {"label":"Landmarker Icon"}
// @ui {"widget":"group_end"}

// @ui {"widget":"separator"}
// @input bool advanced = false
// @input Component.Text hintText {"showIf":"advanced"}
// @input Component.Script landmarkerController {"showIf":"advanced"}
// @input Component.Image landmarkerGraphics {"showIf":"advanced"}
// @input Component.Image hintAnimation {"showIf":"advanced"}
// @input Component.Image landmarkerLoadingPreview {"showIf":"advanced"}
// @input SceneObject loadingRing {"showIf":"advanced"}
// @input SceneObject hintUI {"showIf":"advanced"}
// @input Asset.Texture goToHintTexture {"showIf":"advanced"}
// @input Asset.Texture pointAtHintTexture {"showIf":"advanced"}
// @input Asset.Texture failedTexture {"showIf":"advanced"}

if (!script.landmarkerGraphicsTexture) {
    print("Please add reference to the `Preview Texture` field to the texture you want to show in the hint.");
}

// Options
var waringHintDisplayTime = 3.0;

// States
var warningHintOff = false;
var loadingHintOff = false;
var showHint = true;

// Initialize
initialize();

function initialize() {
    script.api.show = show;
    script.api.hide = hide;
    script.api.disableHint = disableHint;
    script.api.changeToLandmarkerFailed = changeToLandmarkerFailed;
    script.api.changeToGoToHint = changeToGoToHint;
    script.api.changeToPointAtHint = changeToPointAtHint;
    script.api.hideLoadingHint = hideLoadingHint;
    script.api.changeToLoading = changeToLoading;
    script.api.warningHintDisplayTime = waringHintDisplayTime;
    script.landmarkerGraphics.mainPass.baseTex = script.landmarkerGraphicsTexture;
    script.landmarkerLoadingPreview.mainPass.baseTex = script.landmarkerGraphicsTexture;
    //script.hintText.enabled = false;
    showPleaseBeAwareHint();
}

function showPleaseBeAwareHint() {
    print("Showing hint please be aware of your surroundings");
    script.hintComponent = script.getSceneObject().createComponent("Component.HintsComponent");
    script.hintComponent.showHint("lens_hint_warning_please_be_aware_of_your_surroundings", waringHintDisplayTime);
    var event = script.createEvent("DelayedCallbackEvent");
    event.bind(function(eventData) {
        warningHintOff = true;
    });
    event.reset(waringHintDisplayTime);
}

function show() {
    showHint = true;
    if (warningHintOff && loadingHintOff) {
        showActionHint();
    }
}

function hide() {
    showHint = false;
    global.tweenManager.startTween(script.hintUI, "transition_out");
}

function changeToGoToHint() {
    //script.landmarkerGraphics.enabled = true;
    script.hintAnimation.enabled = true;
    script.hintAnimation.mainPass.baseTex = script.pointAtHintTexture;
    //setLocalizedHintText("@goTo");
}

function changeToPointAtHint() {
    //script.landmarkerGraphics.enabled = true;
    script.hintAnimation.enabled = true;
    script.hintAnimation.mainPass.baseTex = script.pointAtHintTexture;
    //setLocalizedHintText("@pointAt");
}

function changeToLandmarkerFailed() {
    //script.landmarkerGraphics.enabled = false;
    script.hintAnimation.enabled = true;
    script.hintAnimation.mainPass.baseTex = script.failedTexture;
    //setLocalizedHintText("@landmarkFailed");
}

function changeToLoading() {
    script.hintAnimation.enabled = false;
    //script.hintText.text = "";
}

function setLocalizedHintText(locKey) {
    script.hintText.text = locKey;
    var curText = script.hintText.text.toString();
    var finalText = curText.replace("{{Name}}", script.landmarkerName);
    script.hintText.text = finalText;
}

function hideLoadingHint() {
    loadingHintOff = true;
    global.tweenManager.startTween(script.hintUI, "loading_graphics_out", disableLoadingHint);
    global.tweenManager.startTween(script.hintUI, "loading_ring_out");
    if (showHint) {
        showActionHint();
    }
}

function showActionHint() {
    script.hintText.enabled = true;
    global.tweenManager.startTween(script.hintUI, "hint_animation_in");
    global.tweenManager.startTween(script.hintUI, "hint_text_in");
    global.tweenManager.startTween(script.hintUI, "landmarker_graphics_in");
}

function disableLoadingHint() {
    script.landmarkerLoadingPreview.enabled = false;
    script.loadingRing.enabled = false;
}

function disableHint() {
    script.hintUI.enabled = false;
}

script.createEvent("UpdateEvent").bind(function(eventData) {
    if (global.scene.isRecording()) {
        script.hintUI.enabled = false;
        return;
    }
    if (warningHintOff && script.landmarkerController.api.locationDataDownloaded && !loadingHintOff) {
        hideLoadingHint();
    }
});