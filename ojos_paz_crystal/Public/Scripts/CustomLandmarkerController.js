// CustomLandmarkerController.js
// Version: 1.0.0
// Event: Lens Initialized
// Description: The main script that controls the Custom Landmarker Events

// @ui {"widget":"label", "label":"Landmarker State's drop down, allows you to see the"}
// @ui {"widget":"label", "label":"different states of Landmarker in the Lens Studio."}
// @ui {"widget":"label", "label":"This allows you to design each state of the Lens."}
// @ui {"widget":"label", "label":""}
// @ui {"widget":"label", "label":"NOTE: This state selection only applies to Lens Studio's"}
// @ui {"widget":"label", "label":"preview. When using the Lens on device, it will"}
// @ui {"widget":"label", "label":"automatically switch between states."}
// @ui {"widget":"label", "label":""}
// @input int mode = 0 {"widget":"combobox", "values":[{"label":"Landmarker Found", "value":0}, {"label":"Landmarker Is Near", "value":1}, {"label":"Landmarker Is Far", "value":2}, {"label":"Landmarker Is Loading", "value":3}, {"label":"Landmarker Failed To Load", "value":4}], "label":"Landmarker State"}
// @ui {"widget":"separator"}

// @ui {"widget":"label", "label":"Send Behavior Trigger allows you to send a"}
// @ui {"widget":"label", "label":"Custom Trigger to the Behavior Script for"}
// @ui {"widget":"label", "label":"setting up interactions."}
// @ui {"widget":"label", "label":"For more information visit Behavior's guide"}
// @ui {"widget":"label", "label":""}
// @input bool sendBehaviorTrigger
// @ui {"widget":"group_start","label":"Behavior Triggers", "showIf":"sendBehaviorTrigger"}
// @input string onLocationFound = "OnLocationFound"
// @input string onLocationLost = "OnLocationLost"
// @input string onDownloaded = "OnLocationDownloaded"
// @input string onDownloadFail = "OnLocationFailed"
// @ui {"widget":"group_end"}
// @ui {"widget":"separator"}
// @ui {"widget":"label", "label":""}
// @input bool advanced
// @ui {"widget":"group_start","label":"Properties", "showIf":"advanced"}
// @input Component.DeviceLocationTrackingComponent locationTracking
// @input Component.Script hintController
// @input SceneObject landmarkerContent
// @input Component.RenderMeshVisual landmarkerMesh
// @input SceneObject segmentation
// @ui {"widget":"group_end"}

var isHintAvailable = false;
var contentChildren = [];
var isEditor = global.deviceInfoSystem.isEditor();
script.api.locationDataDownloaded = false;

function onLensTurnOn() {
    isHintAvailable = validateHintInput();
    var inputValidated = validateInputs();

    if (inputValidated) {
        contentChildren = getAllChildren(script.landmarkerContent);
        toggleContent(false);
        bindTrackingData();
        setDebugMode();
    }
}

function bindTrackingData() {
    script.locationTracking.onLocationFound = wrapFunction(script.locationTracking.onLocationFound, onLocationFound);
    script.locationTracking.onLocationLost = wrapFunction(script.locationTracking.onLocationLost, onLocationGotLost);
    script.locationTracking.onLocationDataDownloaded = wrapFunction(script.locationTracking.onLocationDataDownloaded, onLocationDataDownloaded);
    script.locationTracking.onLocationDataDownloadFailed = wrapFunction(script.locationTracking.onLocationDataDownloadFailed, onLocationDataFailed);
}

function onLocationFound() {
    if (script.sendBehaviorTrigger) {
        global.behaviorSystem.sendCustomTrigger(script.onLocationFound);
    }

    if (isHintAvailable) {
        script.hintController.api.hide();
    }

    toggleContent(true);
    // Add you own custom logic here when location found
}

function onLocationGotLost() {
    if (script.sendBehaviorTrigger) {
        global.behaviorSystem.sendCustomTrigger(script.onLocationLost);
    }

    toggleContent(false);
    // Add you own custom logic here when location lost
}

function onLocationDataDownloaded() {
    if (script.sendBehaviorTrigger && global.behaviorSystem) {
        global.behaviorSystem.sendCustomTrigger(script.onDownloaded);
    }

    if (isEditor && script.mode == 3) {
        return;
    }
    script.api.locationDataDownloaded = true;

    // Add you own custom logic here
}

function onLocationDataFailed() {
    if (script.sendBehaviorTrigger && global.behaviorSystem) {
        global.behaviorSystem.sendCustomTrigger(script.onDownloadFail);
    }
    script.api.locationDataDownloaded = false;

    // Add you own custom logic here when location data cannot be downloaded
}

function onUpdate() {
    setHintState();
}

function setHintState() {
    if (!isHintAvailable || isEditor) {
        return;
    }

    if (script.locationTracking.locationProximityStatus == LocationProximityStatus.WithinRange) {
        script.hintController.api.changeToPointAtHint();
    } else {
        script.hintController.api.changeToGoToHint();
    }
}

function validateHintInput() {
    // Make sure to Hint Controller exist and its a exact Hint Controller script
    if (!script.hintController) {
        print("WARNING: Make sure to add the Hint Controller to the script, to make sure the Hint works fine");
        return false;
    } else {
        if (!script.hintController.api) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.changeToGoToHint) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.changeToPointAtHint) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.show) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.changeToLandmarkerFailed) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.disableHint) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }

        if (!script.hintController.api.changeToLoading) {
            print("ERROR: Make sure to set the correct Hint Controller to the script.");
            return false;
        }
    }

    return true;
}

function validateInputs() {
    if (!script.locationTracking) {
        print("ERROR: Please add the Location Tracking component to the script.");
        return false;
    }
    if (!script.landmarkerContent) {
        print("ERROR: Please add the root scene object which contains all the content for landmarker to the script.");
        return false;
    }
    if (!script.landmarkerMesh) {
        print("ERROR: Please add the Landmarker Render Mesh Visual component to the script.");
        return false;
    }
    return true;
}

function setDebugMode() {
    // Making sure that edit mode is only available while working in Lens Studio
    if (!isEditor) {
        return;
    }

    if (script.segmentation) {
        script.segmentation.enabled = false;
    }

    switch (script.mode) {
        case 0:
            // If edit mode is set to when the landmarker is found
            toggleContent(true);
            
            if (script.sendBehaviorTrigger) {
                global.behaviorSystem.sendCustomTrigger(script.onLocationFound);
            }
        
            if (isHintAvailable) {
                script.api.locationDataDownloaded = true;
                script.hintController.api.disableHint();
            }
            break;
        case 1:
            // If edit mode is set to when the landmarker is near
            toggleContent(false);

            if (isHintAvailable) {
                script.api.locationDataDownloaded = true;
                script.hintController.api.hideLoadingHint();
                script.hintController.api.changeToPointAtHint();
            }
            break;
        case 2:
            // If edit mode is set to when the landmarker is far
            toggleContent(false);

            if (isHintAvailable) {
                script.api.locationDataDownloaded = true;
                script.hintController.api.hideLoadingHint();
                script.hintController.api.changeToGoToHint();
            }
            break;
        case 3:
            // If edit mode is set to when the landmarker is loading
            toggleContent(false);

            if (isHintAvailable) {
                script.hintController.api.changeToLoading();
                script.api.locationDataDownloaded = false;
            }
            break;
        case 4:
            // If edit mode is set to when the landmarker is failed to load
            toggleContent(false);

            if (isHintAvailable) {
                script.api.locationDataDownloaded = false;
                script.hintController.api.hideLoadingHint();
                script.hintController.api.changeToLandmarkerFailed();
            }
            break;
    }


}

function toggleContent(status) {
    for (var i = 0; i < contentChildren.length; i++) {
        contentChildren[i].enabled = status;
    }
}

function getAllChildren(sceneObject) {
    var childArr = [];
    putChildrenRecursively(sceneObject, childArr);
    return childArr;
}

function putChildrenRecursively(so, arr) {
    arr.push(so);
    var childrenCount = so.getChildrenCount();
    for (var i = 0; i < childrenCount; i++) {
        putChildrenRecursively(so.getChild(i), arr);
    }
}

function wrapFunction(origFunc, newFunc) {
    if (!origFunc) {
        return newFunc;
    }
    return function() {
        origFunc();
        newFunc();
    };
}

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);

var turnOnEvent = script.createEvent("TurnOnEvent");
turnOnEvent.bind(onLensTurnOn);