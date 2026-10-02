import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/+esm";

const video = document.getElementById("camera");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const startCamera = document.getElementById("startCamera");
const startTracking = document.getElementById("startTracking");
const status = document.getElementById("status");

let poseLandmarker;
let drawingUtils;
let stream;
let lastTime = -1;


// ==========================
// CAMERA
// ==========================

startCamera.addEventListener("click", async () => {
  try {

    status.textContent = "Status: opening camera...";

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          exact: "environment"
        }
      },
      audio: false
    });

    video.srcObject = stream;

    await video.play();

    status.textContent = "Status: camera ready";

  } catch (error) {

    console.error(error);

    status.textContent =
      "Status: camera error - " + error.name;
  }
});


// ==========================
// MEDIAPIPE
// ==========================

async function loadPoseLandmarker() {

  status.textContent =
    "Status: loading pose model...";

  const vision =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

  poseLandmarker =
    await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        },

        runningMode: "VIDEO",
        numPoses: 1
      }
    );

  drawingUtils =
    new DrawingUtils(ctx);

  status.textContent =
    "Status: MediaPipe ready";
}


// ==========================
// START TRACKING
// ==========================

startTracking.addEventListener(
  "click",
  async () => {

    if (!video.srcObject) {

      alert("Start Camera dulu.");

      return;
    }

    try {

      if (!poseLandmarker) {
        await loadPoseLandmarker();
      }

      status.textContent =
        "Status: tracking";

      requestAnimationFrame(trackPose);

    } catch (error) {

      console.error(error);

      status.textContent =
        "Status: MediaPipe error";

      alert(error.message);
    }
  }
);


// ==========================
// JOINT ANGLE
// ==========================

function calculateAngle(a, b, c) {

  const radians =
    Math.atan2(
      c.y - b.y,
      c.x - b.x
    ) -
    Math.atan2(
      a.y - b.y,
      a.x - b.x
    );

  let angle =
    Math.abs(
      radians * 180 / Math.PI
    );

  if (angle > 180) {
    angle = 360 - angle;
  }

  return angle;
}


// ==========================
// TRUNK LEAN
// ==========================

function calculateTrunkLean(
  shoulder,
  hip
) {

  const dx =
    shoulder.x - hip.x;

  const dy =
    shoulder.y - hip.y;

  /*
  Angle relative to vertical.

  0° = upright trunk

  Higher angle =
  more trunk inclination
  */

  const angle =
    Math.atan2(
      Math.abs(dx),
      Math.abs(dy)
    ) *
    180 / Math.PI;

  return angle;
}


// ==========================
// CHOOSE BEST SIDE
// ==========================

function getVisibility(point) {

  if (
    point.visibility === undefined
  ) {
    return 1;
  }

  return point.visibility;
}


function chooseTrunkSide(
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {

  const leftScore =
    Math.min(
      getVisibility(leftShoulder),
      getVisibility(leftHip)
    );

  const rightScore =
    Math.min(
      getVisibility(rightShoulder),
      getVisibility(rightHip)
    );

  if (leftScore >= rightScore) {

    return {
      shoulder: leftShoulder,
      hip: leftHip,
      side: "left"
    };

  } else {

    return {
      shoulder: rightShoulder,
      hip: rightHip,
      side: "right"
    };
  }
}


// ==========================
// TRACKING
// ==========================

function trackPose() {

  if (!poseLandmarker) {
    return;
  }

  if (
    video.readyState >= 2 &&
    video.currentTime !== lastTime
  ) {

    lastTime =
      video.currentTime;

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const result =
      poseLandmarker.detectForVideo(
        video,
        performance.now()
      );

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      result.landmarks &&
      result.landmarks.length > 0
    ) {

      const landmarks =
        result.landmarks[0];


      // ==========================
      // DRAW SKELETON
      // ==========================

      drawingUtils.drawConnectors(
        landmarks,
        PoseLandmarker.POSE_CONNECTIONS,
        {
          lineWidth: 3
        }
      );

      drawingUtils.drawLandmarks(
        landmarks,
        {
          radius: 4
        }
      );


      // ==========================
      // LANDMARKS
      // ==========================

      const leftShoulder =
        landmarks[11];

      const rightShoulder =
        landmarks[12];

      const leftHip =
        landmarks[23];

      const rightHip =
        landmarks[24];

      const leftKnee =
        landmarks[25];

      const rightKnee =
        landmarks[26];

      const leftAnkle =
        landmarks[27];

      const rightAnkle =
        landmarks[28];


      // ==========================
      // KNEE FLEXION
      // ==========================

      const leftGeometricAngle =
        calculateAngle(
          leftHip,
          leftKnee,
          leftAnkle
        );

      const rightGeometricAngle =
        calculateAngle(
          rightHip,
          rightKnee,
          rightAnkle
        );


      /*
      Clinical knee flexion:

      standing =
      approximately 0°

      squat =
      flexion increases
      */

      const leftKneeFlexion =
        180 -
        leftGeometricAngle;

      const rightKneeFlexion =
        180 -
        rightGeometricAngle;


      const kneeDifference =
        Math.abs(
          leftKneeFlexion -
          rightKneeFlexion
        );


      // ==========================
      // TRUNK LEAN
      // ==========================

      const trunkSide =
        chooseTrunkSide(
          leftShoulder,
          rightShoulder,
          leftHip,
          rightHip
        );


      const trunkLean =
        calculateTrunkLean(
          trunkSide.shoulder,
          trunkSide.hip
        );


      // ==========================
      // UPDATE DISPLAY
      // ==========================

      document
        .getElementById(
          "leftKnee"
        )
        .textContent =
        leftKneeFlexion
          .toFixed(1) +
        "°";


      document
        .getElementById(
          "rightKnee"
        )
        .textContent =
        rightKneeFlexion
          .toFixed(1) +
        "°";


      document
        .getElementById(
          "kneeDifference"
        )
        .textContent =
        kneeDifference
          .toFixed(1) +
        "°";


      document
        .getElementById(
          "trunkLean"
        )
        .textContent =
        trunkLean
          .toFixed(1) +
        "°";


      status.textContent =
        "Status: body detected";

    } else {

      status.textContent =
        "Status: searching body";
    }
  }

  requestAnimationFrame(
    trackPose
  );
}
