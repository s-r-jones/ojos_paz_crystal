// AudioAttachedSequence.js
// Allows to toggle scene objects, start/stop tweens or call script api functions in certain moment of time of the audio track
// Event : OnStart
// Version : 0.2.0
// @input Component.AudioComponent audio 
// @ui {"widget":"separator"}
// @input int mode {"widget" : "combobox", "values" : [{"label" : "Time Stamp Sequence", "value" : "0"}, {"label" : "Single Time Stamp", "value" : "1"}]}
// @input float[] timestamps {"label":"Timestamps (sec)", "showIf" : "mode", "showIfValue" : "0"}
// @input float timestamp {"label":"Timestamp (sec)", "showIf" : "mode", "showIfValue" : "1"}
// @ui {"widget":"separator", "showIf" : "mode", "showIfValue" : "1"}
// @input int actionType {"widget" : "combobox", "values" : [{"label" : "Enable/Disable Object", "value" : "0"}, {"label" : "Start/Stop Tweens", "value" : "1"}, {"label" : "Call Api Function", "value" : "2"}, {"label" : "Call Behavior Trigger", "value" : "3"}, {"label" : "Set Text", "value" : "4"}]}

// @input string startActionName = "start" {"showIf" : "actionType", "showIfValue" : 2, "label" : "   Start function name"}
// @input string endActionName = "stop" {"showIf" : "actionType", "showIfValue" : 2, "label" : "   Stop function name"}

// @input SceneObject[] sceneObjects {"label":"Scene Objects",  "showIf" : "actionType", "showIfValue" : "0"}
// @input string tweenName {"showIf" : "actionType", "showIfValue" : 1,  "label" : "   Tween name"}
// @input SceneObject[] tweenObjects {"label":"Tween Objects",  "showIf" : "actionType", "showIfValue" : "1"}
// @input Component.ScriptComponent[] scriptsWithApi {"label":"Scripts With API",  "showIf" : "actionType", "showIfValue" : "2"}
// @input string[] behaviorTriggers {"label":"Trigger Names",  "showIf" : "actionType", "showIfValue" : "3"}
// @input Component textComponent {"label":"Text / 3DText",  "showIf" : "actionType", "showIfValue" : "4"}
// @input string[] textArray {"label":"Text",  "showIf" : "actionType", "showIfValue" : "4"}
// @ui {"widget":"group_start", "label" : "Restart Helper Scripts on the Enabled Scene Object", "showIf" : "actionType", "showIfValue" : "0"}
// @input bool restartTweens  {"label":"Tweens"}
// @input bool restartBehavior {"hint" : "Behavior"}
// @input bool behaviorReinit = true {"label":"       Reinitialize", "showIf" : "restartBehavior", "hint": "reinitialize all enabled behavior scripts"}
// @input bool behaviorCallAwake = true {"label":"        On Awake", "showIf" : "restartBehavior", "hint": "trigger onAwake Event once sceneObject is enabled"}
// @input bool behaviorCallTurnOn = true {"label":"        On Start", "showIf" : "restartBehavior", "hint": "trigger onStart Event once sceneObject is enabled"}
// @ui {"widget":"group_end"}

var prevPos;
var pos;
var current = -1;
var next = 0;
var needReset = false;
var count;

function initialize() {
    if (!script.audio) {
        print("WARNING, please set Audio component input on " + script.getSceneObject().name);
        return;
    }
    if (script.actionType == 4) {
        if (!script.textComponent || (script.textComponent.getTypeName() != "Component.Text" && script.textComponent.getTypeName() != "Component.Text3D")) {
            print("WARNING, please set Text or Text3D component input on " + script.getSceneObject().name);
            return;
        }
    }

    var event = script.createEvent("UpdateEvent");
    switch (script.mode) {
        case 0:
            event.bind(sequenceUpdate);
            count = script.timestamps.length;
            break;

        case 1:
            event.bind(singleTimestampUpdate);
            switch (script.actionType) {
                case (0):
                    count = script.sceneObjects.length;
                    break;
                case (1):
                    count = script.tweenObjects.length;
                    break;
                case (2):
                    count = script.scriptsWithApi.length;
                    break;
                case (3):
                    count = script.behaviorTriggers.length;
                    break;
                case (4):
                    count = script.textArray.length;
                    break;
            }
            break;
    }
}

function sequenceUpdate() {
    if (!script.audio.audioTrack || !script.audio.isPlaying()) {
        return;
    }
    pos = script.audio.position;
    if (next < count) {
        while (pos > script.timestamps[next]) {
            resetByIndex(current);
            startByIndex(next);
            current = next;
            next++;
        }
    }
    if (prevPos > pos) {
        next = 0;
    }
    prevPos = pos;
}

function singleTimestampUpdate() {
    if (!script.audio.audioTrack) {
        return;
    }
    pos = script.audio.position;
    if (pos < script.timestamp && needReset) {
        needReset = false;
    }

    if (script.audio.position >= script.timestamp && !needReset) {
        resetAll();
        startAll();
        needReset = true;
    }
}



function startByIndex(idx) {
    if (idx < 0 || idx >= count) {
        return;
    }
    switch (script.actionType) {
        case (0):
            if (script.sceneObjects[idx]) {
                script.sceneObjects[idx].enabled = true;
                resetHelperScripts(script.sceneObjects[idx]);
            }
            break;
        case (1):
            if (global.tweenManager) {
                global.tweenManager.startTween(script.tweenObjects[idx], script.tweenName);
            }
            break;
        case (2):
            if (script.scriptsWithApi[idx] && script.startActionName && script.scriptsWithApi[idx].api[script.startActionName]) {
                script.scriptsWithApi[idx].api[script.startActionName]();
            }
            break;
        case (3):
            if (global.behaviorSystem && script.behaviorTriggers[idx]) {
                global.behaviorSystem.sendCustomTrigger(script.behaviorTriggers[idx]);
            }
            break;
        case (4):
            if (script.textComponent && idx < script.textArray.length) {
                script.textComponent.text = script.textArray[idx];
            }
            break;
    }
}

function resetByIndex(idx) {
    if (idx < 0 || idx >= count) {
        return;
    }
    switch (script.actionType) {
        case (0):
            if (script.sceneObjects[idx]) {
                script.sceneObjects[idx].enabled = false;
            }
            break;
        case (1):
            if (global.tweenManager && global.tweenManager.isPlaying(script.tweenObjects[idx], script.tweenName)) {
                global.tweenManager.stopTween(script.tweenObjects[idx], script.tweenName);
            }
            break;
        case (2):
            if (script.scriptsWithApi[idx] && script.endActionName && script.scriptsWithApi[idx].api[script.endActionName]) {
                script.scriptsWithApi[idx].api[script.endActionName]();
            }
            break;
    }
}

function resetAll() {
    for (var i = 0; i < count; i++) {
        resetByIndex(i);
    }
}
function startAll() {
    for (var i = 0; i < count; i++) {
        startByIndex(i);
    }
}

function resetHelperScripts(so) {
    if (global.behaviorSystem && script.restartBehavior) {
        if (script.behaviorReinit) {
            global.behaviorSystem.sendCustomTrigger("_reinitialize_all_behaviors");
        }
        if (script.behaviorCallAwake) {
            global.behaviorSystem.sendCustomTrigger("_trigger_all_awake_behaviors");
        }
        if (script.behaviorCallTurnOn) {
            global.behaviorSystem.sendCustomTrigger("_trigger_all_turn_on_behaviors");
        }
    }
    if (script.restartTweens) {
        restartAutoTweens(so);
    }
}

function restartAutoTweens(so) {
    var scriptComponents = so.getComponents("Component.ScriptComponent");
    var tweenName;
    var tweenObject;

    for (var i = 0; i < scriptComponents.length; i++) {
        if (scriptComponents[i].playAutomatically == true) {
            tweenName = scriptComponents[i].api.tweenName;
            tweenObject = scriptComponents[i].api.tweenObject;
            global.tweenManager.resetObject(tweenObject, tweenName);
            global.tweenManager.startTween(tweenObject, tweenName);
        }
    }
    var childrenCount = so.getChildrenCount();
    for (var j = 0; j < childrenCount; j++) {
        restartAutoTweens(so.getChild(j));
    }
}

initialize();