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

// Peak values
let peakKneeFlexion = 0;
let peakTrunkLean = 0;
let peakSide = "--";


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

  const angle =
    Math.atan2(
      Math.abs(dx),
      Math.abs(dy)
    ) *
    180 / Math.PI;

  return angle;
}


// ==========================
// VISIBILITY
// ==========================

function getVisibility(point) {

  if (point.visibility === undefined) {
    return 1;
  }

  return point.visibility;
}


function chooseBestSide(
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip,
  leftKnee,
  rightKnee,
  leftAnkle,
  rightAnkle
) {

  const leftScore =
    Math.min(
      getVisibility(leftShoulder),
      getVisibility(leftHip),
      getVisibility(leftKnee),
      getVisibility(leftAnkle)
    );

  const rightScore =
    Math.min(
      getVisibility(rightShoulder),
      getVisibility(rightHip),
      getVisibility(rightKnee),
      getVisibility(rightAnkle)
    );

  if (leftScore >= rightScore) {

    return {
      side: "Left",
      shoulder: leftShoulder,
      hip: leftHip,
      knee: leftKnee,
      ankle: leftAnkle
    };

  } else {

    return {
      side: "Right",
      shoulder: rightShoulder,
      hip: rightHip,
      knee: rightKnee,
      ankle: rightAnkle
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


      // DRAW SKELETON
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


      // LANDMARKS
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


      // LEFT KNEE
      const leftGeometricAngle =
        calculateAngle(
          leftHip,
          leftKnee,
          leftAnkle
        );

      const leftKneeFlexion =
        180 - leftGeometricAngle;


      // RIGHT KNEE
      const rightGeometricAngle =
        calculateAngle(
          rightHip,
          rightKnee,
          rightAnkle
        );

      const rightKneeFlexion =
        180 - rightGeometricAngle;


      // DIFFERENCE
      const kneeDifference =
        Math.abs(
          leftKneeFlexion -
          rightKneeFlexion
        );


      // BEST SIDE
      const bestSide =
        chooseBestSide(
          leftShoulder,
          rightShoulder,
          leftHip,
          rightHip,
          leftKnee,
          rightKnee,
          leftAnkle,
          rightAnkle
        );


      const bestGeometricAngle =
        calculateAngle(
          bestSide.hip,
          bestSide.knee,
          bestSide.ankle
        );

      const bestKneeFlexion =
        180 - bestGeometricAngle;


      const trunkLean =
        calculateTrunkLean(
          bestSide.shoulder,
          bestSide.hip
        );


      // ==========================
      // PEAK SQUAT CAPTURE
      // ==========================

      if (
        bestKneeFlexion >
        peakKneeFlexion
      ) {

        peakKneeFlexion =
          bestKneeFlexion;

        peakTrunkLean =
          trunkLean;

        peakSide =
          bestSide.side;

        document
          .getElementById(
            "peakKnee"
          )
          .textContent =
          peakKneeFlexion
            .toFixed(1) +
          "°";

        document
          .getElementById(
            "peakTrunk"
          )
          .textContent =
          peakTrunkLean
            .toFixed(1) +
          "°";

        document
          .getElementById(
            "peakSide"
          )
          .textContent =
          peakSide;
      }


      // ==========================
      // LIVE DISPLAY
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


// ==========================
// RESET PEAK
// ==========================

window.resetPeak = function() {

  peakKneeFlexion = 0;
  peakTrunkLean = 0;
  peakSide = "--";

  document
    .getElementById(
      "peakKnee"
    )
    .textContent =
    "--°";

  document
    .getElementById(
      "peakTrunk"
    )
    .textContent =
    "--°";

  document
    .getElementById(
      "peakSide"
    )
    .textContent =
    "--";
};
